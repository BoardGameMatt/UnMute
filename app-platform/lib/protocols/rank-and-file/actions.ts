import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import {
  MIN_PLAYERS,
  WRITE_SECONDS,
  canWrap,
  dealNumbers,
  emptySlots,
  isExactOrder,
  isSharedScreenName,
  kCapped,
  pickClueGivers,
  pickSubject,
  timerHasExpired,
  validateClue,
} from "./engine";
import {
  connectedIds,
  loadDeals,
  loadPackSubjects,
  loadRankAndFileSession,
  loadRound,
  loadRounds,
  loadRoster,
  resolvePackId,
  syncPublicState,
  type RankAndFileDealRow,
  type RankAndFileRoundRow,
  type RankAndFileSessionRow,
  type RosterMember,
} from "./store";
import type { RankAndFileAction, RankAndFileEndReason, RankAndFilePhase } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type RankAndFileActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

async function poke(
  admin: SupabaseClient,
  sessionId: string,
  phase: RankAndFilePhase,
  extra: Record<string, Json> = {}
): Promise<void> {
  await syncPublicState(admin, sessionId, phase, extra);
}

async function patchSession(
  admin: SupabaseClient,
  sessionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await admin
    .from("rank_and_file_sessions")
    .update(patch)
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

async function patchSessionIfPhase(
  admin: SupabaseClient,
  sessionId: string,
  expected: RankAndFilePhase,
  patch: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await admin
    .from("rank_and_file_sessions")
    .update(patch)
    .eq("session_id", sessionId)
    .eq("phase", expected)
    .select("session_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function resetRankAndFileToLobby(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  await admin
    .from("rank_and_file_sessions")
    .update({ current_round_id: null })
    .eq("session_id", sessionId);
  await admin.from("rank_and_file_rounds").delete().eq("session_id", sessionId);
  await admin.from("rank_and_file_sessions").delete().eq("session_id", sessionId);
}

export async function startRankAndFile(
  admin: SupabaseClient,
  sessionId: string
): Promise<RankAndFileActionResult> {
  const roster = await loadRoster(admin, sessionId);
  const players = roster.filter((row) => !isSharedScreenName(row.displayName));
  if (players.length < MIN_PLAYERS) {
    return fail(400, "Need 3 to start.");
  }

  await resolvePackId(admin, sessionId);
  await resetRankAndFileToLobby(admin, sessionId);

  const { error } = await admin.from("rank_and_file_sessions").insert({
    session_id: sessionId,
    phase: "write",
    round_index: 0,
    current_round_id: null,
    hits: 0,
    committed_rounds: 0,
  });
  if (error) return fail(500, error.message);

  const rf = await loadRankAndFileSession(admin, sessionId);
  if (!rf) return fail(500, "Rank and File session did not save.");
  return beginRound(admin, sessionId, rf, players);
}

function turnCounts(dealsByRound: RankAndFileDealRow[][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const deals of dealsByRound) {
    for (const deal of deals) {
      counts[deal.participant_id] = (counts[deal.participant_id] ?? 0) + 1;
    }
  }
  return counts;
}

async function loadAllDealsForRounds(
  admin: SupabaseClient,
  rounds: RankAndFileRoundRow[]
): Promise<RankAndFileDealRow[][]> {
  const result: RankAndFileDealRow[][] = [];
  for (const round of rounds) {
    result.push(await loadDeals(admin, round.id));
  }
  return result;
}

async function unusedSubjectCount(
  admin: SupabaseClient,
  sessionId: string
): Promise<number> {
  const packId = await resolvePackId(admin, sessionId);
  const subjects = await loadPackSubjects(admin, packId);
  const rounds = await loadRounds(admin, sessionId);
  const used = new Set(
    rounds.filter((row) => row.end_reason !== "abandoned").map((row) => row.subject_id)
  );
  return subjects.filter((row) => !used.has(row.id)).length;
}

async function beginRound(
  admin: SupabaseClient,
  sessionId: string,
  rf: RankAndFileSessionRow,
  roster: RosterMember[]
): Promise<RankAndFileActionResult> {
  const packId = await resolvePackId(admin, sessionId);
  const subjects = await loadPackSubjects(admin, packId);
  const rounds = await loadRounds(admin, sessionId);
  const used = new Set(
    rounds.filter((row) => row.end_reason !== "abandoned").map((row) => row.subject_id)
  );
  const unused = subjects.filter((row) => !used.has(row.id));
  const nextIndex = rounds.length + 1;
  const subject = pickSubject(unused, nextIndex);
  if (!subject) {
    return fail(400, "No unused subjects left. Wrap things up.");
  }

  const players = roster.filter((row) => !isSharedScreenName(row.displayName));
  const present = connectedIds(players);
  const pool = present.length > 0 ? present : players.map((row) => row.participantId);
  const dealsByRound = await loadAllDealsForRounds(admin, rounds);
  const counts = turnCounts(dealsByRound);
  const k = kCapped(nextIndex, pool.length);
  const givers = pickClueGivers(pool, counts, k);
  if (givers.length === 0) {
    return fail(500, "Could not pick clue givers.");
  }
  const numbers = dealNumbers(givers.length, Math.random, nextIndex);

  const now = new Date().toISOString();
  const { data: inserted, error } = await admin
    .from("rank_and_file_rounds")
    .insert({
      session_id: sessionId,
      round_index: nextIndex,
      subject_id: subject.id,
      k,
      write_started_at: now,
    })
    .select("id")
    .single();
  if (error || !inserted) return fail(500, error?.message ?? "Could not start the round.");

  const dealRows = givers.flatMap((participantId, index) => {
    const dealtNumber = numbers[index];
    if (dealtNumber === undefined) return [];
    return [
      {
        round_id: inserted.id,
        participant_id: participantId,
        dealt_number: dealtNumber,
      },
    ];
  });
  const { error: dealErr } = await admin.from("rank_and_file_deals").insert(dealRows);
  if (dealErr) return fail(500, dealErr.message);

  await patchSession(admin, sessionId, {
    phase: "write",
    round_index: nextIndex,
    current_round_id: inserted.id,
  });
  await poke(admin, sessionId, "write");
  return { ok: true };
}

async function closeWrite(
  admin: SupabaseClient,
  sessionId: string,
  round: RankAndFileRoundRow
): Promise<void> {
  const claimed = await patchSessionIfPhase(admin, sessionId, "write", { phase: "rank" });
  if (!claimed) return;

  const deals = await loadDeals(admin, round.id);
  const locked = deals.filter((deal) => deal.locked_at && deal.clue_text);
  const now = new Date().toISOString();

  if (locked.length === 0) {
    const { error } = await admin
      .from("rank_and_file_rounds")
      .update({
        rank_started_at: now,
        committed_at: now,
        ended_at: now,
        end_reason: "zero_tiles" satisfies RankAndFileEndReason,
        is_hit: false,
        rail_order_json: [],
      })
      .eq("id", round.id);
    if (error) throw new Error(error.message);

    const rf = await loadRankAndFileSession(admin, sessionId);
    await patchSession(admin, sessionId, {
      phase: "reveal",
      committed_rounds: (rf?.committed_rounds ?? 0) + 1,
    });
    await poke(admin, sessionId, "reveal");
    return;
  }

  const { error } = await admin
    .from("rank_and_file_rounds")
    .update({ rank_started_at: now, rail_order_json: emptySlots(locked.length) })
    .eq("id", round.id);
  if (error) throw new Error(error.message);
  await poke(admin, sessionId, "rank");
}

async function maybeAdvanceWrite(
  admin: SupabaseClient,
  sessionId: string,
  round: RankAndFileRoundRow,
  roster: RosterMember[]
): Promise<void> {
  const deals = await loadDeals(admin, round.id);
  const present = connectedIds(roster);
  const liveGivers = deals
    .map((deal) => deal.participant_id)
    .filter((id) => present.length === 0 || present.includes(id));
  if (liveGivers.length === 0) {
    const anyLocked = deals.some((deal) => deal.locked_at && deal.clue_text);
    if (anyLocked) await closeWrite(admin, sessionId, round);
    return;
  }
  const locked = new Set(deals.filter((deal) => deal.locked_at).map((deal) => deal.participant_id));
  if (liveGivers.every((id) => locked.has(id))) {
    await closeWrite(admin, sessionId, round);
  }
}

export async function expireIfNeeded(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const rf = await loadRankAndFileSession(admin, sessionId);
  if (!rf?.current_round_id) return;
  const round = await loadRound(admin, rf.current_round_id);
  if (!round) return;
  if (rf.phase === "write" && timerHasExpired(round.write_started_at, Date.now(), WRITE_SECONDS)) {
    await closeWrite(admin, sessionId, round);
  }
}

export async function dispatchRankAndFileAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  isDisplay: boolean;
  action: RankAndFileAction;
}): Promise<RankAndFileActionResult> {
  const { admin, sessionId, participantId, isLead, isDisplay, action } = input;

  await expireIfNeeded(admin, sessionId);

  const rf = await loadRankAndFileSession(admin, sessionId);
  if (!rf) return fail(404, "Rank and File has not started.");
  const round = rf.current_round_id ? await loadRound(admin, rf.current_round_id) : null;
  const roster = await loadRoster(admin, sessionId);

  if (action.type === "lockClue") {
    if (isDisplay) return fail(403, "Write your example on your phone.");
    if (!round || rf.phase !== "write") return fail(400, "Clues are not open.");
    const deals = await loadDeals(admin, round.id);
    const mine = deals.find((deal) => deal.participant_id === participantId);
    if (!mine) return fail(403, "You are ranking this round.");
    if (mine.locked_at) return fail(400, "Already locked in.");
    const valid = validateClue(action.text);
    if (!valid.ok) return fail(400, valid.error);
    const { error } = await admin
      .from("rank_and_file_deals")
      .update({ clue_text: valid.text, locked_at: new Date().toISOString() })
      .eq("id", mine.id)
      .is("locked_at", null);
    if (error) return fail(500, error.message);
    await maybeAdvanceWrite(admin, sessionId, round, roster);
    const after = await loadRankAndFileSession(admin, sessionId);
    await poke(admin, sessionId, after?.phase ?? "write");
    return { ok: true };
  }

  if (action.type === "timerExpired") {
    await expireIfNeeded(admin, sessionId);
    return { ok: true };
  }

  if (action.type === "setRail") {
    if (!round || rf.phase !== "rank") return fail(400, "Ranking is not open.");
    if (!isLead) {
      return fail(403, "Only the facilitator can move the cards.");
    }
    const deals = await loadDeals(admin, round.id);
    const locked = deals.filter((deal) => deal.locked_at && deal.clue_text);
    const lockedIds = new Set(locked.map((deal) => deal.id));
    if (action.dealIds.length !== locked.length) {
      return fail(400, "That row does not match the cards.");
    }
    const placed = action.dealIds.filter((id): id is string => typeof id === "string");
    if (new Set(placed).size !== placed.length) return fail(400, "Each card can sit in one place.");
    if (placed.some((id) => !lockedIds.has(id))) {
      return fail(400, "Unknown card.");
    }
    const { error } = await admin
      .from("rank_and_file_rounds")
      .update({ rail_order_json: action.dealIds })
      .eq("id", round.id);
    if (error) return fail(500, error.message);
    await poke(admin, sessionId, "rank");
    return { ok: true };
  }

  if (action.type === "commit") {
    if (!round || rf.phase !== "rank") return fail(400, "Ranking is not open.");
    if (!isLead) {
      return fail(403, "Only the facilitator can commit.");
    }
    const deals = await loadDeals(admin, round.id);
    const locked = deals.filter((deal) => deal.locked_at && deal.clue_text);
    if (locked.length === 0) return fail(400, "No examples were locked in.");
    const orderedIds = round.rail_order_json;
    if (
      orderedIds.length !== locked.length ||
      orderedIds.some((id) => typeof id !== "string")
    ) {
      return fail(400, "Place every card before you commit.");
    }
    const claimed = await patchSessionIfPhase(admin, sessionId, "rank", { phase: "reveal" });
    if (!claimed) return { ok: true };

    const byId = new Map(locked.map((deal) => [deal.id, deal]));
    const ordered = orderedIds
      .map((id) => (typeof id === "string" ? byId.get(id)?.dealt_number : undefined))
      .filter((n): n is number => typeof n === "number");
    const hit = isExactOrder(ordered);
    const now = new Date().toISOString();
    const { error } = await admin
      .from("rank_and_file_rounds")
      .update({
        committed_at: now,
        ended_at: now,
        end_reason: "commit" satisfies RankAndFileEndReason,
        is_hit: hit,
      })
      .eq("id", round.id);
    if (error) throw new Error(error.message);

    await patchSession(admin, sessionId, {
      phase: "reveal",
      hits: hit ? rf.hits + 1 : rf.hits,
      committed_rounds: rf.committed_rounds + 1,
    });
    await poke(admin, sessionId, "reveal");
    return { ok: true };
  }

  if (action.type === "nextRound") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (rf.phase !== "reveal") return fail(400, "Wait for the reveal.");
    if (rf.round_index >= 5) return fail(400, "Use another round or wrap.");
    const leftover = await unusedSubjectCount(admin, sessionId);
    if (leftover <= 0) return fail(400, "No unused subjects left. Wrap things up.");
    return beginRound(admin, sessionId, rf, roster);
  }

  if (action.type === "anotherRound") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (rf.phase !== "reveal") return fail(400, "Wait for the reveal.");
    if (rf.round_index < 5) return fail(400, "Play through round 5 first.");
    const leftover = await unusedSubjectCount(admin, sessionId);
    if (leftover <= 0) return fail(400, "No unused subjects left. Wrap things up.");
    return beginRound(admin, sessionId, rf, roster);
  }

  if (action.type === "wrap") {
    if (!isLead) return fail(403, "Only the facilitator can wrap.");
    if (rf.phase !== "reveal") return fail(400, "Wait for the reveal.");
    const leftover = await unusedSubjectCount(admin, sessionId);
    if (!canWrap(rf.round_index, leftover)) {
      return fail(400, "Wrap is first offered after round 5.");
    }
    await patchSession(admin, sessionId, { phase: "scoreboard" });
    await poke(admin, sessionId, "scoreboard");
    return { ok: true };
  }

  if (action.type === "advanceRecap") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (rf.phase !== "scoreboard") return fail(400, "Scores are not up yet.");
    await admin
      .from("sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    await poke(admin, sessionId, "scoreboard", { recapAdvanced: true });
    return { ok: true };
  }

  return fail(400, "Unknown action.");
}
