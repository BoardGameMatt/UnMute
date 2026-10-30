/**
 * On the Same Page bot crew. They join a lobby, play through the same
 * endpoints a phone uses, and write a report of anything a person would notice.
 *
 *   npm run bots:on-the-same-page -- --code ABC123 [--count 12] [--base http://localhost:3000]
 *
 * Open the host link yourself (Shared screen) and press Start once eight
 * phones are in. Bots stop when the session completes.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TILE_IDS, type TileId } from "../lib/protocols/on-the-same-page/config";
import type { OtspClientState, OtspPhase, Role } from "../lib/protocols/on-the-same-page/types";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? String(process.argv[i + 1]) : fallback;
}

const CODE = arg("code", "").toUpperCase();
const COUNT = Math.max(1, Math.min(16, Number(arg("count", "12"))));
const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const POLL_MS = Math.max(400, Number(arg("poll-ms", "700")));
const COOKIE = "unmute_participant_id";

if (!CODE) {
  console.error("Usage: npm run bots:on-the-same-page -- --code ABC123 [--count 12]");
  process.exit(1);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const chance = (p: number) => Math.random() < p;
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;
const clock = () => new Date().toISOString().slice(11, 19);

type PersonaKind = "steady" | "hasty" | "careful" | "distracted" | "chatty";

type Persona = {
  kind: PersonaKind;
  blurb: string;
  /** Lap at which this person locks a guess. 0 means final lock only. */
  guessLap: number;
  placeDelay: () => number;
  react: number;
};

const PERSONAS: Record<PersonaKind, Persona> = {
  steady: {
    kind: "steady",
    blurb: "Places next to the last tile and locks a guess around the check-in.",
    guessLap: 2,
    placeDelay: () => rand(400, 1400),
    react: 0.15,
  },
  hasty: {
    kind: "hasty",
    blurb: "Places immediately and guesses on the first lap.",
    guessLap: 1,
    placeDelay: () => rand(150, 500),
    react: 0.05,
  },
  careful: {
    kind: "careful",
    blurb: "Waits until later laps, then pins someone.",
    guessLap: 4,
    placeDelay: () => rand(800, 2200),
    react: 0.08,
  },
  distracted: {
    kind: "distracted",
    blurb: "Places a tile on every turn.",
    guessLap: 5,
    placeDelay: () => rand(400, 1200),
    react: 0.02,
  },
  chatty: {
    kind: "chatty",
    blurb: "Reacts often and pins early.",
    guessLap: 3,
    placeDelay: () => rand(300, 900),
    react: 0.55,
  },
};

const PERSONA_MIX: PersonaKind[] = [
  "steady", "steady", "hasty", "hasty", "careful", "careful",
  "distracted", "chatty", "steady", "hasty", "careful", "chatty",
  "steady", "distracted", "hasty", "careful",
];

const NAMES = [
  "Priya", "Marcus", "Dana", "Theo", "Aisha", "Ben", "Carmen", "Jules",
  "Kenji", "Leah", "Omar", "Rosa", "Sam", "Tasha", "Victor", "Wren",
];

type Severity = "info" | "warn" | "error";
type Anomaly = {
  at: string;
  bot: string;
  persona: PersonaKind;
  phase: string;
  round: number;
  severity: Severity;
  kind: string;
  detail: string;
  humanNote: string;
};

const anomalies: Anomaly[] = [];
const latencies: number[] = [];
let requestCount = 0;
let errorCount = 0;

const REVEAL_ORDER = ["suspicion", "improviser", "guess", "picture", "outcome"];
const PHASE_ORDER: OtspPhase[] = ["deal", "build", "checkin", "final_lock", "reveal", "scoreboard"];

class Bot {
  name: string;
  persona: Persona;
  participantId = "";
  sessionId = "";
  state: OtspClientState | null = null;
  done = false;
  private offsetMs = 0;
  private actedKey = "";
  private guessed = false;
  private pinned = false;
  private reactedRound = 0;
  private expireKey = "";
  private lastPhase = "";
  private lastRound = 0;
  private sawPicture = false;
  private flagged = new Set<string>();

  constructor(name: string, kind: PersonaKind) {
    this.name = name;
    this.persona = PERSONAS[kind];
  }

  flag(severity: Severity, kind: string, detail: string, humanNote: string) {
    const key = `${kind}:${this.lastRound}`;
    if (this.flagged.has(key)) return;
    this.flagged.add(key);
    const s = this.state;
    anomalies.push({
      at: new Date().toISOString(),
      bot: this.name,
      persona: this.persona.kind,
      phase: s?.phase ?? "lobby",
      round: s?.roundNumber ?? 0,
      severity,
      kind,
      detail,
      humanNote,
    });
    const tag = severity === "error" ? "!!" : severity === "warn" ? "! " : "  ";
    console.log(`${clock()} ${tag} ${this.name.padEnd(8)} ${kind}: ${detail}`);
  }

  private serverNow(): number {
    return Date.now() + this.offsetMs;
  }

  private async http(path: string, init?: RequestInit): Promise<{ status: number; body: unknown } | null> {
    const t0 = Date.now();
    requestCount++;
    try {
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        redirect: "manual",
        headers: { ...(init?.headers ?? {}), cookie: `${COOKIE}=${this.participantId}` },
      });
      const ms = Date.now() - t0;
      latencies.push(ms);
      let body: unknown = null;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text.slice(0, 180);
      }
      if (res.status >= 500) {
        errorCount++;
        this.flag("error", "server-error", `${init?.method ?? "GET"} ${path} → ${res.status}`, "The app returned an error.");
      }
      return { status: res.status, body };
    } catch (err) {
      errorCount++;
      this.flag("error", "network-error", `${path}: ${err instanceof Error ? err.message : String(err)}`, "The app couldn't connect.");
      return null;
    }
  }

  adopt(sessionId: string, participantId: string): void {
    this.sessionId = sessionId;
    this.participantId = participantId;
    console.log(`${clock()}    ${this.name.padEnd(8)} resumed (${this.persona.kind})`);
  }

  async join(sessionId: string, teamId: string): Promise<boolean> {
    this.sessionId = sessionId;
    const form = new FormData();
    form.set("sessionId", sessionId);
    form.set("teamId", teamId);
    form.set("displayName", this.name);
    const res = await fetch(`${BASE}/api/join/${CODE}`, { method: "POST", body: form, redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    const pid = /pid=([0-9a-f-]{36})/i.exec(location)?.[1];
    if (!pid) {
      const err = decodeURIComponent(/error=([^&]+)/.exec(location)?.[1] ?? `HTTP ${res.status}`).replace(/\+/g, " ");
      this.flag("error", "join-failed", err, `I couldn't join: "${err}"`);
      return false;
    }
    this.participantId = pid;
    await this.http(`/api/session/${sessionId}/claim-participant?pid=${pid}`);
    console.log(`${clock()}    ${this.name.padEnd(8)} joined (${this.persona.kind})`);
    return true;
  }

  async run(): Promise<void> {
    while (!this.done) {
      await this.poll();
      await this.act();
      await sleep(rand(POLL_MS * 0.6, POLL_MS * 1.2));
    }
  }

  private async poll(): Promise<void> {
    const t0 = Date.now();
    const res = await this.http(`/api/on-the-same-page/session/${this.sessionId}/play`);
    if (!res) return;
    if (res.status === 403) {
      this.done = true;
      return;
    }
    if (res.status !== 200) return;
    const body = res.body as { state?: OtspClientState | null };
    const next = body.state ?? null;
    if (!next) return;
    this.offsetMs = next.serverNow - (t0 + 40);
    this.inspect(next);
    this.state = next;
  }

  private inspect(s: OtspClientState) {
    const prev = this.state;
    if (s.roundNumber !== this.lastRound) {
      this.lastRound = s.roundNumber;
      this.guessed = false;
      this.pinned = false;
      this.actedKey = "";
      this.sawPicture = false;
      console.log(`${clock()}    ${this.name.padEnd(8)} round ${s.roundNumber} as ${s.myRole ?? "—"}`);
    }
    if (s.phase !== this.lastPhase) this.lastPhase = s.phase;

    if (prev && prev.roundNumber === s.roundNumber) {
      const forward = PHASE_ORDER.indexOf(s.phase) >= PHASE_ORDER.indexOf(prev.phase);
      const nextLap = prev.phase === "checkin" && s.phase === "build";
      if (!forward && !nextLap) {
        this.flag("error", "phase-went-backwards", `${prev.phase} → ${s.phase}`, "The screen jumped back a step.");
      }
      if (s.phase === "reveal" && prev.phase === "reveal" && REVEAL_ORDER.indexOf(s.revealStep) < REVEAL_ORDER.indexOf(prev.revealStep)) {
        this.flag("error", "reveal-went-backwards", `${prev.revealStep} → ${s.revealStep}`, "The reveal replayed an earlier beat.");
      }
    }

    const open: OtspPhase[] = ["deal", "build", "checkin", "final_lock"];
    if (s.myRole !== "builder" && s.pictureLabel && open.includes(s.phase)) {
      this.flag("error", "picture-leaked", `Saw "${s.pictureLabel}" during ${s.phase}`, "I could see the picture before the reveal.");
    }
    if (s.myRole === "improviser" && s.pictureLabel && s.phase === "reveal" && !["picture", "outcome"].includes(s.revealStep)) {
      this.flag("error", "picture-early", `Saw "${s.pictureLabel}" on ${s.revealStep}`, "The picture showed up before its beat.");
    }
    if (s.myRole !== "builder" && s.phase !== "reveal" && s.phase !== "scoreboard" && s.improviserId) {
      this.flag("error", "improviser-leaked", `improviserId set during ${s.phase}`, "I could see who was improvising too early.");
    }
    if (s.myRole === "builder" && open.includes(s.phase) && s.guessList.length > 0) {
      this.flag("error", "guess-list-leaked", `${s.guessList.length} guesses visible to a builder`, "I'm building and I can see the guess list.");
    }
    if ((s.myRole === "inspector" || s.myRole === "improviser") && open.includes(s.phase) && s.guessList.length !== 10) {
      this.flag("error", "guess-list-missing", `guess list has ${s.guessList.length}`, "I should be choosing from ten pictures.");
    }
    if (s.myRole === "builder" && s.pictureLabel) this.sawPicture = true;
    if (s.myRole === "builder" && s.phase === "build" && !s.pictureLabel && !this.sawPicture) {
      this.flag("error", "builder-blind", "No picture label on my turn", "I'm building and the picture isn't on my phone.");
    }
    if (s.placements.length > 25) {
      this.flag("error", "too-many-tiles", `${s.placements.length} tiles`, "The board has more tiles than a round allows.");
    }
    const cells = new Set(s.placements.map((p) => `${p.row},${p.col}`));
    if (cells.size !== s.placements.length) {
      this.flag("error", "stacked-tiles", "Two tiles share a cell", "Two tiles landed on the same square.");
    }
  }

  private async post(action: Record<string, unknown>): Promise<boolean> {
    const res = await this.http(`/api/on-the-same-page/session/${this.sessionId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action),
    });
    if (!res) return false;
    if (res.status === 409) return false;
    if (res.status !== 200) {
      const msg = JSON.stringify(res.body).slice(0, 140);
      if (!msg.includes("Already") && !msg.includes("Not your turn") && !msg.includes("Wait")) {
        this.flag("warn", "action-rejected", `${action.type} → ${res.status} ${msg}`, "A tap didn't go through.");
      }
      return false;
    }
    const body = res.body as { state?: OtspClientState | null };
    if (body.state) this.state = body.state;
    return true;
  }

  private emptyCell(s: OtspClientState): { row: number; col: number } | null {
    const taken = new Set(s.placements.map((p) => `${p.row},${p.col}`));
    const free: { row: number; col: number }[] = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (!taken.has(`${row},${col}`)) free.push({ row, col });
      }
    }
    if (free.length === 0) return null;
    const mine = [...s.placements].reverse().find((p) => p.participantId === s.selfId);
    if (mine && this.persona.kind !== "hasty") {
      const near = free.filter((c) => Math.abs(c.row - mine.row) + Math.abs(c.col - mine.col) <= 2);
      if (near.length > 0) return pick(near);
    }
    return pick(free);
  }

  private async act(): Promise<void> {
    const s = this.state;
    if (!s || this.done) return;
    const now = this.serverNow();
    const grace = s.phase === "build" ? 2000 : 0;
    const holding = s.phase === "scoreboard" || (s.phase === "reveal" && s.revealStep === "outcome");
    if (!holding && now >= s.phaseEndsAt + grace) {
      const key = `${s.roundNumber}:${s.phase}:${s.revealStep}:${s.phaseEndsAt}`;
      if (this.expireKey !== key) {
        this.expireKey = key;
        await this.post({ type: "expire" });
      }
    }

    if (s.isMyTurn) {
      const key = `${s.roundNumber}:${s.lap}:${s.phaseEndsAt}`;
      if (this.actedKey !== key) {
        this.actedKey = key;
        await sleep(this.persona.placeDelay());
        const cell = this.emptyCell(s);
        if (!cell) return;
        const tile = pick(TILE_IDS) as TileId;
        const ok = await this.post({ type: "place", tile, row: cell.row, col: cell.col });
        if (ok) console.log(`${clock()}    ${this.name.padEnd(8)} placed ${tile} at ${cell.row},${cell.col}`);
      }
    }

    const lap = s.lap;
    const wantsGuess = lap >= this.persona.guessLap;
    if (s.canGuess && !this.guessed && wantsGuess && s.guessList.length > 0 && chance(0.35)) {
      const item = pick(s.guessList);
      if (await this.post({ type: "guess", itemId: item.id })) {
        this.guessed = true;
        console.log(`${clock()}    ${this.name.padEnd(8)} guessed "${item.label}"`);
      }
    }

    if (s.canPin && !this.pinned && lap >= 2 && chance(0.2)) {
      const others = s.placers.filter((p) => p.id !== s.selfId);
      const target = pick(others);
      if (target && (await this.post({ type: "pin", targetId: target.id }))) {
        this.pinned = true;
        console.log(`${clock()}    ${this.name.padEnd(8)} pinned ${target.name}`);
      }
    }

    if (s.canReact && this.reactedRound !== s.roundNumber && chance(this.persona.react * 0.15)) {
      const kind = pick(["with_you", "not_sure", "lost", "see_it"] as const);
      if (await this.post({ type: "react", kind, tileKey: null })) {
        this.reactedRound = s.roundNumber;
      }
    }
  }
}

function pct(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}

function writeReport(startedAt: Date, sessionId: string, bots: Bot[]): string {
  const dir = resolve(process.cwd(), "bot-reports");
  mkdirSync(dir, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = join(dir, `on-the-same-page-${CODE}-${stamp}`);
  const real = anomalies.filter((a) => a.severity !== "info");
  const lines = [
    `# On the Same Page bot run — ${CODE}`,
    "",
    `- Started: ${startedAt.toISOString()}`,
    `- Ended: ${new Date().toISOString()}`,
    `- Target: ${BASE}`,
    `- Session: ${sessionId}`,
    `- Bots: ${bots.length}`,
    `- Requests: ${requestCount}, server errors: ${errorCount}`,
    `- Latency p50 ${pct(latencies, 50)}ms · p95 ${pct(latencies, 95)}ms`,
    "",
    "## Verdict",
    "",
    real.some((a) => a.severity === "error")
      ? "**Problems found.**"
      : real.length
        ? "**Warnings only.**"
        : "**Clean run.**",
    "",
  ];
  for (const a of real.slice(0, 40)) {
    lines.push(`- ${a.severity} ${a.bot} (${a.persona}) ${a.kind}: ${a.detail}`);
  }
  lines.push("", "## Players", "");
  for (const b of bots) {
    const role = b.state?.myRole ?? "—";
    lines.push(`- ${b.name} (${b.persona.kind}) last seen as ${role} in ${b.state?.phase ?? "lobby"} round ${b.state?.roundNumber ?? 0}`);
  }
  writeFileSync(`${base}.md`, lines.join("\n"));
  return `${base}.md`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: session, error } = await admin
    .from("sessions")
    .select("id, team_id, status, protocols ( slug )")
    .eq("join_code", CODE)
    .maybeSingle();
  if (error || !session) throw new Error(error?.message ?? "Session not found");
  const protocol = session.protocols as { slug?: string } | { slug?: string }[] | null;
  const slug = Array.isArray(protocol) ? protocol[0]?.slug : protocol?.slug;
  if (slug !== "on-the-same-page") throw new Error(`Session ${CODE} is ${slug ?? "unknown"}, not On the Same Page.`);
  if (session.status !== "lobby" && session.status !== "active") {
    throw new Error(`Session is ${session.status}. Mint a fresh lobby.`);
  }

  const startedAt = new Date();
  const bots = NAMES.slice(0, COUNT).map((name, i) => new Bot(name, PERSONA_MIX[i] ?? "steady"));
  if (session.status === "active") {
    const { data: rows, error: rowErr } = await admin
      .from("session_participants")
      .select("participant_id, participants(display_name)")
      .eq("session_id", session.id);
    if (rowErr) throw new Error(rowErr.message);
    const byName = new Map<string, string>();
    for (const row of rows ?? []) {
      const person = row.participants as { display_name?: string } | { display_name?: string }[] | null;
      const name = Array.isArray(person) ? person[0]?.display_name : person?.display_name;
      if (name && row.participant_id) byName.set(name, row.participant_id);
    }
    console.log(`${clock()} resuming ${bots.length} bots on ${CODE} at ${BASE}`);
    for (const bot of bots) {
      const participantId = byName.get(bot.name);
      if (!participantId) throw new Error(`${bot.name} is not in this room`);
      bot.adopt(session.id, participantId);
    }
  } else {
    console.log(`${clock()} joining ${bots.length} bots on ${CODE} at ${BASE}`);
    for (const bot of bots) {
      const ok = await bot.join(session.id, session.team_id);
      if (!ok) throw new Error(`${bot.name} could not join`);
      await sleep(120);
    }
    console.log(`${clock()} lobby ready. Press Start on the Shared screen.`);
  }

  const deadline = Date.now() + 25 * 60 * 1000;
  await Promise.race([
    Promise.all(bots.map((b) => b.run())),
    (async () => {
      while (Date.now() < deadline && bots.some((b) => !b.done)) await sleep(1000);
      for (const b of bots) b.done = true;
    })(),
  ]);

  const report = writeReport(startedAt, session.id, bots);
  console.log(`${clock()} report ${report}`);
  const errors = anomalies.filter((a) => a.severity === "error");
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
