import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

type Row = Record<string, unknown>;
type Operation = { table: string; kind: "insert" | "update" | "delete"; key: Row; value?: Row };
type Snapshot = { tables: Record<string, Row[]>; keys: Record<string, string[]> };
type Mode = "start" | "reset" | "action" | "view";
const transactions = new WeakSet<object>();
const workByClient = new WeakMap<object, UnitOfWork>();
export const isWorkshopTransaction = (client: SupabaseClient): boolean => transactions.has(client);

export class WorkshopWriteConflict extends Error {
  constructor() { super("The workshop changed. Refresh and try again."); }
}
class WorkshopCommitConflict extends WorkshopWriteConflict {}

/**
 * A server-only unit of work for the existing tabular coordinators. Writes are
 * buffered; SQL owns defaults, constraints, locks and the final atomic commit.
 * Catalog reads remain ordinary Supabase reads. Unsupported writes fail closed.
 * This adapter contains no game decisions and is never a browser client.
 */
class UnitOfWork {
  readonly operations: Operation[] = [];
  readonly tables: Record<string, Row[]>;
  readonly client: SupabaseClient;
  inputDeadline: number | null = null;
  actionContext: string | null = null;
  readonly base: SupabaseClient;
  readonly sessionId: string;
  readonly snapshot: Snapshot;
  constructor(base: SupabaseClient, sessionId: string, snapshot: Snapshot) {
    this.base = base; this.sessionId = sessionId; this.snapshot = snapshot;
    this.tables = structuredClone(snapshot.tables);
    this.client = {
      from: (table: string) => table in this.tables ? new BufferedQuery(this, table) : new CatalogQuery(base.from(table)),
      rpc: (name: string, args: Row) => this.rpc(name, args),
    } as unknown as SupabaseClient;
    transactions.add(this.client);
    workByClient.set(this.client, this);
  }
  key(table: string, row: Row): Row {
    return Object.fromEntries(this.snapshot.keys[table].map(column => [column, row[column]]));
  }
  async newRows(table: string, rows: Row[]): Promise<Row[]> {
    if (!rows.length) return [];
    const { data, error } = await this.base.rpc("prepare_workshop_rows", {
      p_session_id: this.sessionId, p_table: table, p_rows: rows,
    });
    if (error) throw new Error(error.message);
    return data as Row[];
  }
  async rpc(name: string, args: Row) {
    // Preserve the existing Truth Is snapshot API within the outer transaction.
    if (name !== "save_truth_is_snapshot" || args.p_session_id !== this.sessionId) {
      throw new Error(`RPC ${name} must declare its transaction integration.`);
    }
    const current = this.tables.truth_is_sessions[0];
    if ((current?.write_version ?? 0) !== args.p_expected_version) return { data: null, error: null };
    const version = Number(args.p_expected_version) + 1;
    const patch = { phase: args.p_phase, state_json: args.p_state_json, write_version: version };
    const session = new BufferedQuery(this, "truth_is_sessions");
    if (current) await session.update(patch).eq("session_id", this.sessionId);
    else await session.insert({ session_id: this.sessionId, ...patch });
    await new BufferedQuery(this, "truth_is_entries").delete().eq("session_id", this.sessionId);
    const entries = args.p_entries as Row[];
    if (entries.length) await new BufferedQuery(this, "truth_is_entries").insert(entries.map(row => ({ ...row, session_id: this.sessionId })));
    return { data: version, error: null };
  }
}

/** Read-only delegation cannot accidentally bypass the transaction boundary. */
class CatalogQuery {
  private query: ReturnType<SupabaseClient["from"]>;
  constructor(query: ReturnType<SupabaseClient["from"]>) { this.query = query; }
  select(columns?: string, options?: { count?: "exact"; head?: boolean }) { return this.query.select(columns, options); }
  insert(): never { throw new Error("Write to a table outside the workshop transaction manifest."); }
  update(): never { return this.insert(); }
  delete(): never { return this.insert(); }
  upsert(): never { return this.insert(); }
}

class BufferedQuery implements PromiseLike<{ data: Row[] | Row | null; error: null; count?: number }> {
  private filters: Array<(row: Row) => boolean> = [];
  private sorting: Array<[string, boolean]> = [];
  private kind: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private value: Row | Row[] = {};
  private columns = "*";
  private cardinality: "optional" | "required" | null = null;
  private conflict: string[] = [];
  private ignoreDuplicates = false;
  private counted = false;
  private head = false;
  private maximum: number | null = null;
  private execution?: Promise<{ data: Row[] | Row | null; error: null; count?: number }>;
  private work: UnitOfWork;
  private table: string;
  constructor(work: UnitOfWork, table: string) { this.work = work; this.table = table; }
  select(columns = "*", options: { count?: string; head?: boolean } = {}) { this.columns = columns; this.counted = options.count === "exact"; this.head = options.head ?? false; return this; }
  eq(column: string, value: unknown) { this.filters.push(row => row[column] === value); return this; }
  is(column: string, value: unknown) { return this.eq(column, value); }
  in(column: string, values: unknown[]) { this.filters.push(row => values.includes(row[column])); return this; }
  not(column: string, operator: string, value: unknown) { if (operator !== "is") throw new Error("Unsupported buffered filter."); this.filters.push(row => row[column] !== value); return this; }
  order(column: string, options: { ascending?: boolean } = {}) { this.sorting.push([column, options.ascending ?? true]); return this; }
  limit(count: number) { this.maximum = count; return this; }
  maybeSingle() { this.cardinality = "optional"; return this; }
  single() { this.cardinality = "required"; return this; }
  update(value: Row) { this.kind = "update"; this.value = value; return this; }
  insert(value: Row | Row[]) { this.kind = "insert"; this.value = value; return this; }
  upsert(value: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.kind = "upsert"; this.value = value; this.conflict = options.onConflict?.split(",").map(key => key.trim()) ?? this.work.snapshot.keys[this.table];
    this.ignoreDuplicates = options.ignoreDuplicates ?? false; return this;
  }
  delete() { this.kind = "delete"; return this; }
  private async execute() {
    const table = this.work.tables[this.table];
    let rows = table.filter(row => this.filters.every(filter => filter(row)));
    if (this.kind === "insert" || this.kind === "upsert") {
      rows = [];
      for (const input of Array.isArray(this.value) ? this.value : [this.value]) {
        const existing = this.kind === "upsert" ? table.find(row => this.conflict.every(key => row[key] === input[key])) : undefined;
        if (existing) {
          if (!this.ignoreDuplicates) {
            const key = this.work.key(this.table, existing);
            Object.assign(existing, input);
            this.work.operations.push({ table: this.table, kind: "update", key, value: structuredClone(input) });
          }
          rows.push(existing);
        } else {
          const [created] = await this.work.newRows(this.table, [input]);
          table.push(created); rows.push(created);
          this.work.operations.push({ table: this.table, kind: "insert", key: this.work.key(this.table, created), value: structuredClone(created) });
        }
      }
    } else if (this.kind === "update" || this.kind === "delete") {
      for (const row of rows) {
        this.work.operations.push({ table: this.table, kind: this.kind, key: this.work.key(this.table, row), ...(this.kind === "update" ? { value: structuredClone(this.value as Row) } : {}) });
        if (this.kind === "update") Object.assign(row, this.value);
        else table.splice(table.indexOf(row), 1);
      }
    }
    rows = structuredClone(rows);
    if (this.columns.includes("participants")) rows = rows.map(row => ({ ...row, participants: this.work.tables.participants.find(person => person.id === row.participant_id) ?? null }));
    for (const [column, ascending] of [...this.sorting].reverse()) rows.sort((a, b) => {
      const av = a[column] as string | number, bv = b[column] as string | number;
      return (av === bv ? 0 : av < bv ? -1 : 1) * (ascending ? 1 : -1);
    });
    const count = rows.length;
    if (this.maximum !== null) rows = rows.slice(0, this.maximum);
    if (this.cardinality && (rows.length > 1 || (this.cardinality === "required" && rows.length !== 1))) throw new Error("Wrong buffered single-row cardinality.");
    return { data: this.head ? null : this.cardinality ? rows[0] ?? null : rows, error: null, ...(this.counted ? { count } : {}) };
  }
  then<TResult1 = { data: Row[] | Row | null; error: null; count?: number }, TResult2 = never>(
    resolve?: ((value: { data: Row[] | Row | null; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> { this.execution ??= this.execute(); return this.execution.then(resolve, reject); }
}

export async function withWorkshopTransaction<T>(
  admin: SupabaseClient, sessionId: string, mode: Mode,
  decide: (client: SupabaseClient) => Promise<T>, expectedGeneration?: number
): Promise<T> {
  if (isWorkshopTransaction(admin)) return decide(admin);
  const { data, error } = await admin.rpc("load_workshop_transaction", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  const snapshot = data as Snapshot;
  const root = snapshot.tables.sessions.find(row => row.id === sessionId);
  if (!root || (expectedGeneration !== undefined && root.lifecycle_version !== expectedGeneration)
    || (mode === "start" && root.status !== "lobby") || root.status === "cancelled"
    || (mode === "action" && root.status !== "active" && !(root.status === "lobby" && snapshot.tables.cover_story_sessions))) throw new WorkshopWriteConflict();
  if (mode === "reset" && root.status === "lobby") return undefined as T;
  const work = new UnitOfWork(admin, sessionId, snapshot);
  if (mode === "start") await work.client.from("session_state").update({ state_json: {}, phase: "waiting", current_round: 0 }).eq("session_id", sessionId);
  const result = await decide(work.client);
  if (result && typeof result === "object" && (("ok" in result && result.ok === false) || ("error" in result && result.error))) return result;
  if (mode === "start" || mode === "reset") {
    await work.client.from("sessions").update({ status: mode === "start" ? "active" : "lobby", lifecycle_version: Number(root.lifecycle_version) + 1,
      started_at: mode === "start" ? new Date().toISOString() : null, completed_at: null }).eq("id", sessionId);
    if (mode === "reset") await work.client.from("session_state").update({ state_json: {}, phase: "waiting", current_round: 0 }).eq("session_id", sessionId);
  }
  if (!work.operations.length) return result;
  const committed = await admin.rpc("commit_workshop_transaction", { p_session_id: sessionId,
    p_snapshot: snapshot.tables, p_operations: work.operations,
    p_input_deadline: work.inputDeadline === null ? null : new Date(work.inputDeadline).toISOString() });
  if (committed.error) {
    if (committed.error.code === "40001" || committed.error.code === "40P01") throw new WorkshopWriteConflict();
    throw new Error(committed.error.message);
  }
  if (committed.data !== true) throw new WorkshopCommitConflict();
  return result;
}

/** Opaque identity of the game/round/turn/timer, excluding independent inputs. */
export function workshopActionContext(client: SupabaseClient): string {
  const work = workByClient.get(client);
  if (!work) throw new Error("Workshop context requires a transaction snapshot.");
  const root = work.tables.sessions.find(row => row.id === work.sessionId)!;
  const fields = ["phase", "round_index", "reveal_index", "reveal_subphase", "current_round_id", "current_turn_id", "current_reveal_item_id", "current_dive", "current_turn",
    "current_slot", "subphase", "guess_started_at", "write_started_at", "timer_started_at", "total_rounds_played", "current_entry_id"];
  const scope: unknown[] = [root.lifecycle_version];
  const pick = (row: Row) => Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]]));
  for (const [table, rows] of Object.entries(work.tables)) {
    if (["sessions", "session_state", "participants", "session_participants", "workshop_action_receipts", "otsp_rotation_debt"].includes(table)) continue;
    if (table.endsWith("_sessions")) for (const row of rows) {
      scope.push(table, pick(row));
      if (table === "truth_is_sessions") scope.push(pick(row.state_json as Row));
      if (table === "otsp_sessions") {
        const game = row.game_json as Row, round = game.round as Row;
        scope.push(game.phase, game.roundNumber, round.cursor, round.phaseEndsAt);
      }
      if (row.current_turn_id) {
        const turn = work.tables.talk_track_turns?.find(item => item.id === row.current_turn_id);
        if (turn) scope.push(pick(turn));
      }
    }
  }
  return createHash("sha256").update(JSON.stringify(scope)).digest("hex");
}

export function workshopSnapshotRevision(client: SupabaseClient): number {
  const work = workByClient.get(client)!;
  const initial = Number(work.snapshot.tables.session_state[0]?.revision ?? 0);
  return initial + (work.operations.length ? 1 : 0) + work.operations.filter(op => op.table === "session_state" && op.kind === "update").length;
}

/** The protocol supplies its own authoritative timing rule; SQL rechecks it
 * after obtaining the transaction locks, not just at the earlier TS read. */
export function requireWorkshopDeadline(client: SupabaseClient, deadline: number): void {
  if (!Number.isFinite(deadline)) throw new Error("The workshop timer is unavailable.");
  if (Date.now() >= deadline) throw new WorkshopWriteConflict();
  const work = workByClient.get(client);
  if (!work) throw new Error("Input admission requires a workshop transaction.");
  work.inputDeadline = Math.min(work.inputDeadline ?? Infinity, deadline);
}

export function assertWorkshopActionContext(client: SupabaseClient): void {
  const work = workByClient.get(client);
  if (work?.actionContext && work.actionContext !== workshopActionContext(client)) throw new WorkshopWriteConflict();
}

type ActionResult = { ok: true } | { ok: false; status: number; error: string };
export async function withWorkshopAction<T extends ActionResult>(
  admin: SupabaseClient, sessionId: string, actorId: string, action: unknown,
  decide: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  let originalContext: string | undefined;
  // Allow every participant in a supported workshop to win a competing CAS.
  const maxAttempts = 32;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
  try {
    return await withWorkshopTransaction(admin, sessionId, "view", async client => {
      const body = action as Row;
      const work = workByClient.get(client)!;
      const root = work.tables.sessions.find(row => row.id === sessionId)!;
      const operationId = body.operationId;
      if (operationId !== undefined && (typeof operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId))) throw new Error("Invalid operation ID.");
      if (operationId) {
        const previous = work.tables.workshop_action_receipts.find(row => row.operation_id === operationId);
        if (previous) {
          const canonical = (value: unknown): string => JSON.stringify(value, (_, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item as Row).sort(([a], [b]) => a.localeCompare(b))) : item);
          if (previous.actor_id !== actorId || canonical(previous.payload) !== canonical(body)) throw new WorkshopWriteConflict();
          return { ok: true } as T;
        }
      }
      if (root.status !== "active" && !(root.status === "lobby" && work.tables.cover_story_sessions)) throw new WorkshopWriteConflict();
      const context = workshopActionContext(client);
      originalContext ??= context;
      if (context !== originalContext || (body.workshopContext !== undefined && body.workshopContext !== context)) throw new WorkshopWriteConflict();
      if (body.expectedRevision !== undefined && body.expectedRevision !== Number(work.snapshot.tables.session_state[0]?.revision)) throw new WorkshopWriteConflict();
      work.actionContext = context;
      const result = await decide(client);
      if (result.ok && operationId) await client.from("workshop_action_receipts").insert({ session_id: sessionId,
        generation: root.lifecycle_version, operation_id: operationId, actor_id: actorId, payload: body });
      return result;
    });
  } catch (error) {
    if (error instanceof WorkshopCommitConflict && attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * Math.min(200, 25 * (attempt + 1))));
      continue;
    }
    return { ok: false, status: error instanceof WorkshopWriteConflict ? 409 : 500,
      error: error instanceof Error ? error.message : "Could not save the action." } as T;
  }
  }
  throw new WorkshopWriteConflict();
}
