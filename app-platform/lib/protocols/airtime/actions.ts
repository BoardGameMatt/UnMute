import "server-only";
import { isWorkshopTransaction, withWorkshopTransaction, withWorkshopAction, requireWorkshopDeadline, assertWorkshopActionContext } from "@/lib/session/workshop-transaction";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import { AIRTIME_CONFIG } from "./config";
import {
  allUnderwaterHaveChosen,
  assignBoats,
  boatDiveTotal,
  canChoose,
  hasRival,
  newDive,
  resolveTurn,
  rivalDiveScore,
  timerHasExpired,
  turnGraceHasExpired,
} from "./engine";
import {
  casSession,
  insertEvents,
  loadAirtimeSession,
  loadBoats,
  loadChoices,
  loadMembers,
  loadRoster,
  playersOf,
  syncPublicState,
  type AirtimeSessionRow,
} from "./store";
import type { AirtimeAction, AirtimePhase, Choice, DiveState, StoredAirtimeEvent } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type AirtimeActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

function isoIn(ms: number, from = Date.now()): string {
  return new Date(from + ms).toISOString();
}

async function poke(
  admin: SupabaseClient,
  sessionId: string,
  phase: AirtimePhase,
  extra: Record<string, Json> = {}
): Promise<void> {
  await syncPublicState(admin, sessionId, phase, extra);
}

function publicExtra(row: Pick<AirtimeSessionRow, "current_dive" | "current_turn" | "turn_ends_at" | "revealed">): Record<string, Json> {
  return {
    current_dive: row.current_dive,
    current_turn: row.current_turn,
    turn_ends_at: row.turn_ends_at,
    revealed: row.revealed,
  };
}

// ---------------------------------------------------------------------------
// Start / reset

export async function resetAirtimeToLobby(admin: SupabaseClient, sessionId: string): Promise<void> {
  if (!isWorkshopTransaction(admin)) return withWorkshopTransaction(admin, sessionId, "reset", client => resetAirtimeToLobby(client, sessionId));
  for (const table of [
    "airtime_events",
    "airtime_choices",
    "airtime_diver_dives",
    "airtime_boat_dives",
    "airtime_dives",
    "airtime_boat_members",
    "airtime_boats",
    "airtime_sessions",
  ]) {
    const { error } = await admin.from(table).delete().eq("session_id", sessionId);
    if (error) throw new Error(error.message);
  }
}

export async function startAirtime(admin: SupabaseClient, sessionId: string): Promise<AirtimeActionResult> {
  if (!isWorkshopTransaction(admin)) return withWorkshopTransaction(admin, sessionId, "start", client => startAirtime(client, sessionId));
  const players = playersOf(await loadRoster(admin, sessionId));
  if (players.length < AIRTIME_CONFIG.minPlayers) return fail(400, "Need 2 to start.");
  if (players.length > AIRTIME_CONFIG.maxPlayers) return fail(400, "Airtime holds 16 players at most.");

  await resetAirtimeToLobby(admin, sessionId);

  const { error: sErr } = await admin.from("airtime_sessions").insert({
    session_id: sessionId,
    phase: "boats",
    config_json: AIRTIME_CONFIG as unknown as Json,
  });
  if (sErr) return fail(500, sErr.message);

  const groups = assignBoats(players.map((p) => p.participantId));
  const boatRows = groups.map((_, i) => ({
    session_id: sessionId,
    name: AIRTIME_CONFIG.boatNames[i] ?? `Boat ${i + 1}`,
    sort_order: i,
    is_rival: false,
  }));
  if (hasRival(groups.length)) {
    boatRows.push({ session_id: sessionId, name: AIRTIME_CONFIG.rivalName, sort_order: 99, is_rival: true });
  }
  const { data: inserted, error: bErr } = await admin
    .from("airtime_boats")
    .insert(boatRows)
    .select("id, sort_order");
  if (bErr || !inserted) return fail(500, bErr?.message ?? "Boats did not save.");

  const idByOrder = new Map(inserted.map((b) => [b.sort_order as number, b.id as string]));
  const memberRows = groups.flatMap((ids, i) =>
    ids.map((participantId) => ({
      session_id: sessionId,
      boat_id: idByOrder.get(i),
      participant_id: participantId,
    }))
  );
  const { error: mErr } = await admin.from("airtime_boat_members").insert(memberRows);
  if (mErr) return fail(500, mErr.message);

  await poke(admin, sessionId, "boats");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Dives

async function startDive(
  admin: SupabaseClient,
  sessionId: string,
  row: AirtimeSessionRow,
  number: number
): Promise<AirtimeActionResult> {
  const boats = (await loadBoats(admin, sessionId)).filter((b) => !b.is_rival);
  const members = await loadMembers(admin, sessionId);
  const rosters = boats
    .map((b) => ({
      boatId: b.id,
      memberIds: members.filter((m) => m.boat_id === b.id).map((m) => m.participant_id),
    }))
    .filter((b) => b.memberIds.length > 0);
  if (rosters.length === 0) return fail(400, "No one is on a boat.");

  const dive = newDive(rosters);
  const now = Date.now();
  const won = await casSession(admin, sessionId, row.version, {
    phase: "dive_active",
    current_dive: number,
    current_turn: 0,
    dive_state_json: dive as unknown as Json,
    window_opens_at: isoIn(0, now),
    turn_ends_at: isoIn(AIRTIME_CONFIG.turnSeconds * 1000, now),
    end_after_turn: false,
    end_banner_until: null,
    rules_ends_at: null,
  });
  if (!won) return { ok: true };

  const { error } = await admin
    .from("airtime_dives")
    .upsert({ session_id: sessionId, number, started_at: isoIn(0, now) }, { onConflict: "session_id,number" });
  if (error) throw new Error(error.message);

  await poke(admin, sessionId, "dive_active", {
    current_dive: number,
    current_turn: 0,
    turn_ends_at: isoIn(AIRTIME_CONFIG.turnSeconds * 1000, now),
    revealed: row.revealed,
  });
  return { ok: true };
}

async function writeDiveResults(
  admin: SupabaseClient,
  sessionId: string,
  dive: number,
  state: DiveState,
  endReason: string
): Promise<void> {
  const boats = await loadBoats(admin, sessionId);
  const rival = boats.find((b) => b.is_rival);
  const playerBoat = boats.find((b) => !b.is_rival);
  const boatRows = state.boats.map((b) => ({
    session_id: sessionId,
    dive_number: dive,
    boat_id: b.boatId,
    tank_start: b.tankStart,
    tank_by_turn: b.tankByTurn,
    result: boatDiveTotal(state, b.boatId),
  }));
  if (rival && playerBoat) {
    boatRows.push({
      session_id: sessionId,
      dive_number: dive,
      boat_id: rival.id,
      tank_start: 0,
      tank_by_turn: [],
      result: rivalDiveScore(),
    });
  }
  const { error: bErr } = await admin
    .from("airtime_boat_dives")
    .upsert(boatRows, { onConflict: "session_id,dive_number,boat_id" });
  if (bErr) throw new Error(bErr.message);

  const diverRows = state.divers.map((d) => ({
    session_id: sessionId,
    dive_number: dive,
    participant_id: d.participantId,
    boat_id: d.boatId,
    path: d.path,
    deepest: d.deepest,
    item_id: d.itemId,
    status: d.status === "underwater" ? "forfeit" : d.status,
    surfaced_turn: d.surfacedTurn,
    haul: d.haul,
  }));
  const { error: dErr } = await admin
    .from("airtime_diver_dives")
    .upsert(diverRows, { onConflict: "session_id,dive_number,participant_id" });
  if (dErr) throw new Error(dErr.message);

  const { error: eErr } = await admin
    .from("airtime_dives")
    .update({ ended_at: new Date().toISOString(), end_reason: endReason })
    .eq("session_id", sessionId)
    .eq("number", dive);
  if (eErr) throw new Error(eErr.message);
}

/**
 * Resolve the open turn. Idempotent: only the request that wins the
 * compare-and-set on `version` writes events, results, and the poke.
 */
async function resolveOpenTurn(
  admin: SupabaseClient,
  sessionId: string,
  row: AirtimeSessionRow
): Promise<void> {
  const dive = row.dive_state_json;
  if (row.phase !== "dive_active" || !dive) return;

  const openTurn = row.current_turn + 1;
  const choices = await loadChoices(admin, sessionId, row.current_dive, openTurn);
  const result = resolveTurn(dive, choices, { endAfterThisTurn: row.end_after_turn });
  const now = Date.now();
  const beatMs = AIRTIME_CONFIG.resultBeatSeconds * 1000;

  const patch: Record<string, unknown> = result.ended
    ? {
        phase: "dive_results",
        current_turn: result.state.turn,
        dive_state_json: result.state as unknown as Json,
        window_opens_at: null,
        turn_ends_at: null,
        end_after_turn: false,
        end_banner_until: null,
      }
    : {
        current_turn: result.state.turn,
        dive_state_json: result.state as unknown as Json,
        window_opens_at: isoIn(beatMs, now),
        turn_ends_at: isoIn(beatMs + AIRTIME_CONFIG.turnSeconds * 1000, now),
      };

  const won = await casSession(admin, sessionId, row.version, patch);
  if (!won) return;

  await insertEvents(
    admin,
    sessionId,
    result.events.map((e) => ({ ...e, dive: row.current_dive }) as StoredAirtimeEvent)
  );

  if (result.ended) {
    await writeDiveResults(admin, sessionId, row.current_dive, result.state, result.endReason ?? "all_back");
    await poke(admin, sessionId, "dive_results", {
      current_dive: row.current_dive,
      current_turn: result.state.turn,
      turn_ends_at: null,
      revealed: row.revealed,
    });
    return;
  }

  await poke(admin, sessionId, "dive_active", {
    current_dive: row.current_dive,
    current_turn: result.state.turn,
    turn_ends_at: patch.turn_ends_at as string,
    revealed: row.revealed,
  });
}

/** Server clocks: a legacy rules-phase session auto-starts dive 1; an expired window resolves. */
export async function expireIfNeeded(admin: SupabaseClient, sessionId: string): Promise<void> {
  if (!isWorkshopTransaction(admin)) return withWorkshopTransaction(admin, sessionId, "action", client => expireIfNeeded(client, sessionId));
  const row = await loadAirtimeSession(admin, sessionId);
  if (!row) return;
  const now = Date.now();
  if (row.phase === "rules" && timerHasExpired(row.rules_ends_at, now)) {
    await startDive(admin, sessionId, row, 1);
    return;
  }
  if (row.phase === "dive_active" && turnGraceHasExpired(row.turn_ends_at, now)) {
    await resolveOpenTurn(admin, sessionId, row);
  }
}

async function maybeResolveEarly(admin: SupabaseClient, sessionId: string): Promise<void> {
  const row = await loadAirtimeSession(admin, sessionId);
  if (!row || row.phase !== "dive_active" || !row.dive_state_json) return;
  const choices = await loadChoices(admin, sessionId, row.current_dive, row.current_turn + 1);
  if (allUnderwaterHaveChosen(row.dive_state_json, choices)) {
    await resolveOpenTurn(admin, sessionId, row);
  }
}

// ---------------------------------------------------------------------------
// Dispatch

const LEAD_ACTIONS = new Set<AirtimeAction["type"]>([
  "swap",
  "startDive",
  "endAfterTurn",
  "nextDive",
  "finalScore",
  "advanceRecap",
]);

export async function dispatchAirtimeAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  canControl: boolean;
  isDisplay: boolean;
  action: AirtimeAction;
}): Promise<AirtimeActionResult> {
  if (!isWorkshopTransaction(input.admin)) return withWorkshopAction(input.admin, input.sessionId, input.participantId, input.action, client => dispatchAirtimeAction({ ...input, admin: client }));
  const { admin, sessionId, participantId, canControl, isDisplay, action } = input;

  await expireIfNeeded(admin, sessionId);
  if (action.type !== "timerExpired") assertWorkshopActionContext(admin);
  const row = await loadAirtimeSession(admin, sessionId);
  if (!row) return fail(400, "Airtime has not started.");

  if (LEAD_ACTIONS.has(action.type) && !canControl) {
    return fail(403, "Only the facilitator's shared screen can do that.");
  }

  switch (action.type) {
    case "timerExpired":
      return { ok: true };

    case "choose": {
      if (isDisplay) return fail(403, "Dive on your phone.");
      if (row.phase !== "dive_active" || !row.dive_state_json) return fail(400, "No dive is running.");
      const choice: Choice | null =
        action.choice === "deeper" || action.choice === "up" ? action.choice : null;
      if (!choice) return fail(400, "Pick Dive Deeper or Swim back up.");
      requireWorkshopDeadline(admin, Date.parse(row.turn_ends_at ?? "") + AIRTIME_CONFIG.lateChoiceGraceSeconds * 1000);
      const openTurn = row.current_turn + 1;
      if (action.turn !== openTurn) return fail(409, "That turn is over.");
      if (row.window_opens_at && Date.now() < new Date(row.window_opens_at).getTime()) {
        return fail(409, "The next turn hasn't opened yet.");
      }
      const diver = row.dive_state_json.divers.find((d) => d.participantId === participantId);
      if (!diver) return fail(403, "You're not on a boat this dive.");
      if (!canChoose(diver, choice)) {
        return fail(400, diver.status === "underwater" ? "You're as deep as it goes." : "You're out of the water.");
      }
      const previous = (await loadChoices(admin, sessionId, row.current_dive, openTurn))[participantId];
      if (previous && previous !== choice) return fail(409, "You already locked a different choice for this turn.");
      const { error } = await admin.from("airtime_choices").upsert(
        {
          session_id: sessionId,
          dive_number: row.current_dive,
          turn: openTurn,
          participant_id: participantId,
          choice,
        },
        { onConflict: "session_id,dive_number,turn,participant_id", ignoreDuplicates: true }
      );
      if (error) return fail(500, error.message);
      await maybeResolveEarly(admin, sessionId);
      return { ok: true };
    }

    case "swap": {
      if (row.phase !== "boats") {
        return fail(400, "Boats can only change before dive 1.");
      }
      if (!action.a || !action.b || action.a === action.b) return fail(400, "Pick two people.");
      const members = await loadMembers(admin, sessionId);
      const a = members.find((m) => m.participant_id === action.a);
      const b = members.find((m) => m.participant_id === action.b);
      if (!a || !b) return fail(400, "Both people must be on a boat.");
      if (a.boat_id === b.boat_id) return fail(400, "They're already on the same boat.");
      const first = await admin
        .from("airtime_boat_members")
        .update({ boat_id: b.boat_id })
        .eq("session_id", sessionId)
        .eq("participant_id", a.participant_id);
      if (first.error) return fail(500, first.error.message);
      const second = await admin
        .from("airtime_boat_members")
        .update({ boat_id: a.boat_id })
        .eq("session_id", sessionId)
        .eq("participant_id", b.participant_id);
      if (second.error) return fail(500, second.error.message);
      await casSession(admin, sessionId, row.version, {});
      await poke(admin, sessionId, row.phase, publicExtra(row));
      return { ok: true };
    }

    case "startDive":
      if (row.phase !== "boats" && row.phase !== "rules") return fail(400, "Dive 1 has already started.");
      return startDive(admin, sessionId, row, 1);

    case "nextDive":
      if (row.phase !== "dive_results") return fail(400, "Finish this dive first.");
      if (row.current_dive >= AIRTIME_CONFIG.maxDives) return fail(400, "Final dive complete.");
      return startDive(admin, sessionId, row, row.current_dive + 1);

    case "endAfterTurn": {
      if (row.phase !== "dive_active") return fail(400, "No dive is running.");
      if (row.end_after_turn) return { ok: true };
      const won = await casSession(admin, sessionId, row.version, {
        end_after_turn: true,
        end_banner_until: isoIn(AIRTIME_CONFIG.endBannerSeconds * 1000),
      });
      if (won) {
        await insertEvents(admin, sessionId, [
          { dive: row.current_dive, type: "facilitator_action", turn: row.current_turn + 1, payload: { action: "end_after_turn" } },
        ]);
        await poke(admin, sessionId, "dive_active", publicExtra(row));
      }
      return { ok: true };
    }

    case "finalScore": {
      if (row.phase !== "dive_results") return fail(400, "Finish this dive first.");
      const patch: Record<string, unknown> = { phase: "final" };
      if (!row.revealed) {
        patch.revealed = true;
        patch.revealed_after_dive = row.current_dive;
      }
      const won = await casSession(admin, sessionId, row.version, patch);
      if (won) {
        if (!row.revealed) {
          await insertEvents(admin, sessionId, [
            { dive: row.current_dive, type: "reveal", turn: row.current_turn, payload: { after_dive: row.current_dive } },
          ]);
        }
        await poke(admin, sessionId, "final", { ...publicExtra(row), revealed: true });
      }
      return { ok: true };
    }

    case "advanceRecap": {
      if (row.phase !== "final") return fail(400, "Scores are not up yet.");
      const { error } = await admin
        .from("sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) return fail(500, error.message);
      await poke(admin, sessionId, "final", { ...publicExtra(row), recapAdvanced: true });
      return { ok: true };
    }
  }
}
