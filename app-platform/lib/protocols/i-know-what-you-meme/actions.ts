import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/types/database";
import {
  buildRevealOrder,
  connectedPool,
  GUESS_SECONDS,
  isAllowedGifUrl,
  pickOne,
  shuffleCopy,
  timerHasExpired,
} from "./engine";
import {
  connectedIds,
  loadAllGuesses,
  loadGuesses,
  loadIkwymSession,
  loadPrompts,
  loadResponses,
  loadRevealItems,
  loadRoster,
  resolvePackId,
  syncPublicState,
  type IkwymPromptRow,
  type IkwymSessionRow,
  type RosterMember,
} from "./store";
import { MIN_PLAYERS, RESPONSE_MAX, type IkwymAction, type IkwymPhase } from "./types";

type ActionOk = { ok: true };
type ActionErr = { ok: false; status: number; error: string };
export type IkwymActionResult = ActionOk | ActionErr;

function fail(status: number, error: string): ActionErr {
  return { ok: false, status, error };
}

async function poke(
  admin: SupabaseClient,
  sessionId: string,
  phase: IkwymPhase,
  extra: Record<string, Json> = {}
): Promise<void> {
  await syncPublicState(admin, sessionId, phase, extra);
}

async function patchSession(
  admin: SupabaseClient,
  sessionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("ikwym_sessions").update(patch).eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export async function resetIkwymToLobby(admin: SupabaseClient, sessionId: string): Promise<void> {
  await admin
    .from("ikwym_sessions")
    .update({ current_reveal_item_id: null })
    .eq("session_id", sessionId);
  await admin.from("ikwym_reveal_items").delete().eq("session_id", sessionId);
  await admin.from("ikwym_responses").delete().eq("session_id", sessionId);
  await admin.from("ikwym_sessions").delete().eq("session_id", sessionId);
}

function drawPair(
  prompts: IkwymPromptRow[],
  kind: "checkin" | "stimulus",
  excludeIds: string[]
): IkwymPromptRow | null {
  const pool = prompts.filter((p) => p.kind === kind && !excludeIds.includes(p.id));
  return pickOne(shuffleCopy(pool));
}

export async function startIkwym(
  admin: SupabaseClient,
  sessionId: string
): Promise<IkwymActionResult> {
  const roster = await loadRoster(admin, sessionId);
  if (roster.length < MIN_PLAYERS) {
    return fail(400, "Need 3 to start.");
  }

  const packId = await resolvePackId(admin, sessionId);
  const prompts = await loadPrompts(admin, packId);
  const checkins = prompts.filter((p) => p.kind === "checkin");
  const stimuli = prompts.filter((p) => p.kind === "stimulus");
  if (checkins.length < 2 || stimuli.length < 2) {
    return fail(500, "Pack A is not installed.");
  }

  await resetIkwymToLobby(admin, sessionId);

  const r1Checkin = drawPair(prompts, "checkin", []);
  const r1Stimulus = drawPair(prompts, "stimulus", []);
  if (!r1Checkin || !r1Stimulus) {
    return fail(500, "Pack A is not installed.");
  }
  const r2Checkin = drawPair(prompts, "checkin", [r1Checkin.id]);
  const r2Stimulus = drawPair(prompts, "stimulus", [r1Stimulus.id]);
  if (!r2Checkin || !r2Stimulus) {
    return fail(500, "Pack A is not installed.");
  }

  const { error: sessErr } = await admin.from("ikwym_sessions").insert({
    session_id: sessionId,
    phase: "R1_PROMPTS",
    round_index: 1,
    r1_checkin_id: r1Checkin.id,
    r1_stimulus_id: r1Stimulus.id,
    r2_checkin_id: r2Checkin.id,
    r2_stimulus_id: r2Stimulus.id,
  });
  if (sessErr) throw new Error(sessErr.message);

  await poke(admin, sessionId, "R1_PROMPTS");
  return { ok: true };
}

async function completeSession(admin: SupabaseClient, sessionId: string): Promise<void> {
  await patchSession(admin, sessionId, { phase: "SCOREBOARD", guess_started_at: null });
  await admin
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);
  await poke(admin, sessionId, "SCOREBOARD", { recapAdvanced: true });
}

async function goScoreboard(admin: SupabaseClient, sessionId: string): Promise<void> {
  await patchSession(admin, sessionId, {
    phase: "SCOREBOARD",
    guess_started_at: null,
    current_reveal_item_id: null,
  });
  await poke(admin, sessionId, "SCOREBOARD");
}

async function resolveCurrentReveal(
  admin: SupabaseClient,
  sessionId: string,
  itemId: string
): Promise<void> {
  const { error } = await admin
    .from("ikwym_reveal_items")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", itemId)
    .is("resolved_at", null);
  if (error) throw new Error(error.message);
  await patchSession(admin, sessionId, { phase: "REVEAL_SHOW", guess_started_at: null });
  await poke(admin, sessionId, "REVEAL_SHOW");
}

async function maybeAdvanceCollection(
  admin: SupabaseClient,
  ikwym: IkwymSessionRow,
  roster: RosterMember[],
  round: 1 | 2
): Promise<void> {
  const live = connectedPool(
    roster.map((r) => r.participantId),
    connectedIds(roster)
  );
  const responses = await loadResponses(admin, ikwym.session_id, round);
  const submitted = new Set(responses.map((r) => r.participant_id));
  if (!live.every((id) => submitted.has(id))) return;

  if (round === 1) {
    await patchSession(admin, ikwym.session_id, { phase: "R2_PROMPTS", round_index: 2 });
    await poke(admin, ikwym.session_id, "R2_PROMPTS");
    return;
  }

  const allResponses = await loadResponses(admin, ikwym.session_id);
  const queued = buildRevealOrder(
    allResponses.map((row) => ({
      round: row.round === 2 ? (2 as const) : (1 as const),
      owner_id: row.participant_id,
      gif_url: row.gif_url,
    }))
  );
  if (queued.length === 0) {
    await goScoreboard(admin, ikwym.session_id);
    return;
  }

  await admin.from("ikwym_reveal_items").delete().eq("session_id", ikwym.session_id);
  const rows = queued.map((item, index) => ({
    session_id: ikwym.session_id,
    sort_index: index,
    round: item.round,
    owner_id: item.owner_id,
    gif_url: item.gif_url,
  }));
  const { data: inserted, error } = await admin
    .from("ikwym_reveal_items")
    .insert(rows)
    .select("id, sort_index")
    .order("sort_index", { ascending: true });
  if (error || !inserted?.[0]) throw new Error(error?.message ?? "Could not build the reveal queue.");

  const firstId = inserted[0].id as string;
  await patchSession(admin, ikwym.session_id, {
    phase: "REVEAL_GUESS",
    current_reveal_item_id: firstId,
    guess_started_at: new Date().toISOString(),
  });
  await poke(admin, ikwym.session_id, "REVEAL_GUESS");
}

async function maybeResolveGuesses(
  admin: SupabaseClient,
  ikwym: IkwymSessionRow,
  roster: RosterMember[]
): Promise<void> {
  const itemId = ikwym.current_reveal_item_id;
  if (!itemId) return;
  const items = await loadRevealItems(admin, ikwym.session_id);
  const current = items.find((row) => row.id === itemId);
  if (!current) return;

  const live = connectedPool(
    roster.map((r) => r.participantId),
    connectedIds(roster)
  );
  const eligible = live.filter((id) => id !== current.owner_id);
  const guesses = await loadGuesses(admin, itemId);
  const locked = new Set(guesses.map((g) => g.participant_id));
  if (eligible.length === 0 || eligible.every((id) => locked.has(id))) {
    await resolveCurrentReveal(admin, ikwym.session_id, itemId);
  }
}

export async function expireIfNeeded(admin: SupabaseClient, sessionId: string): Promise<void> {
  const ikwym = await loadIkwymSession(admin, sessionId);
  if (!ikwym || ikwym.phase !== "REVEAL_GUESS" || !ikwym.current_reveal_item_id) return;
  if (!timerHasExpired(ikwym.guess_started_at, Date.now(), GUESS_SECONDS)) return;
  await resolveCurrentReveal(admin, sessionId, ikwym.current_reveal_item_id);
}

export async function dispatchIkwymAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: IkwymAction;
}): Promise<IkwymActionResult> {
  const { admin, sessionId, participantId, isLead, action } = input;
  await expireIfNeeded(admin, sessionId);

  const ikwym = await loadIkwymSession(admin, sessionId);
  if (!ikwym) return fail(404, "I Know What You Meme has not started.");
  const roster = await loadRoster(admin, sessionId);

  if (action.type === "advanceRecap") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (ikwym.phase !== "SCOREBOARD") return fail(400, "Scores are not open.");
    await completeSession(admin, sessionId);
    return { ok: true };
  }

  if (action.type === "timerExpired") {
    await expireIfNeeded(admin, sessionId);
    return { ok: true };
  }

  if (action.type === "broadcastRound") {
    if (!isLead) return fail(403, "Only the facilitator can send the prompts.");
    if (ikwym.phase === "R1_PROMPTS") {
      await patchSession(admin, sessionId, { phase: "R1_SELECTING", round_index: 1 });
      await poke(admin, sessionId, "R1_SELECTING");
      return { ok: true };
    }
    if (ikwym.phase === "R2_PROMPTS") {
      await patchSession(admin, sessionId, { phase: "R2_SELECTING", round_index: 2 });
      await poke(admin, sessionId, "R2_SELECTING");
      return { ok: true };
    }
    return fail(400, "Prompts are not waiting to be sent.");
  }

  if (action.type === "confirmGif") {
    const round: 1 | 2 | null =
      ikwym.phase === "R1_SELECTING" ? 1 : ikwym.phase === "R2_SELECTING" ? 2 : null;
    if (!round) return fail(400, "GIF picking is not open.");
    const openResponse = action.openResponse.trim().slice(0, RESPONSE_MAX);
    const stimulusResponse = action.stimulusResponse.trim().slice(0, RESPONSE_MAX);
    const searchQuery = action.searchQuery.trim().slice(0, RESPONSE_MAX * 2 + 1);
    const gifUrl = action.gifUrl.trim();
    if (!openResponse || !stimulusResponse) {
      return fail(400, "Answer both prompts before confirming.");
    }
    if (!isAllowedGifUrl(gifUrl)) {
      return fail(400, "That GIF is not from Giphy.");
    }

    const { error } = await admin.from("ikwym_responses").insert({
      session_id: sessionId,
      participant_id: participantId,
      round,
      gif_url: gifUrl,
      open_response: openResponse,
      stimulus_response: stimulusResponse,
      search_query: searchQuery,
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: true };
      }
      throw new Error(error.message);
    }

    await poke(admin, sessionId, ikwym.phase);
    const fresh = await loadIkwymSession(admin, sessionId);
    if (fresh) await maybeAdvanceCollection(admin, fresh, roster, round);
    return { ok: true };
  }

  if (action.type === "lockGuess") {
    if (ikwym.phase !== "REVEAL_GUESS" || !ikwym.current_reveal_item_id) {
      return fail(400, "Guessing is not open.");
    }
    const items = await loadRevealItems(admin, sessionId);
    const current = items.find((row) => row.id === ikwym.current_reveal_item_id);
    if (!current) return fail(400, "No GIF is up.");
    if (participantId === current.owner_id) {
      return fail(403, "Your GIF is up — you sit this one out.");
    }
    if (action.guessedParticipantId === participantId) {
      return fail(400, "You cannot guess yourself.");
    }
    if (!roster.some((row) => row.participantId === action.guessedParticipantId)) {
      return fail(400, "That person is not in this session.");
    }

    const { error } = await admin.from("ikwym_guesses").insert({
      reveal_item_id: current.id,
      participant_id: participantId,
      guessed_participant_id: action.guessedParticipantId,
      locked_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === "23505") {
        return { ok: true };
      }
      throw new Error(error.message);
    }

    await poke(admin, sessionId, "REVEAL_GUESS");
    const fresh = await loadIkwymSession(admin, sessionId);
    if (fresh) await maybeResolveGuesses(admin, fresh, roster);
    return { ok: true };
  }

  if (action.type === "nextReveal") {
    if (!isLead) return fail(403, "Only the facilitator can continue.");
    if (ikwym.phase !== "REVEAL_SHOW") return fail(400, "This GIF is not resolved yet.");
    const items = await loadRevealItems(admin, sessionId);
    const currentIndex = items.findIndex((row) => row.id === ikwym.current_reveal_item_id);
    const next = items[currentIndex + 1];
    if (!next) {
      await goScoreboard(admin, sessionId);
      return { ok: true };
    }
    await patchSession(admin, sessionId, {
      phase: "REVEAL_GUESS",
      current_reveal_item_id: next.id,
      guess_started_at: new Date().toISOString(),
    });
    await poke(admin, sessionId, "REVEAL_GUESS");
    return { ok: true };
  }

  if (action.type === "wrap") {
    if (!isLead) return fail(403, "Only the facilitator can wrap.");
    if (ikwym.phase !== "REVEAL_SHOW") {
      return fail(400, "Wrap is only available after a GIF is revealed.");
    }
    await goScoreboard(admin, sessionId);
    return { ok: true };
  }

  return fail(400, "Unknown action.");
}

export async function scoresForSession(
  admin: SupabaseClient,
  sessionId: string,
  roster: RosterMember[]
): Promise<Record<string, number>> {
  const items = await loadRevealItems(admin, sessionId);
  const guesses = await loadAllGuesses(
    admin,
    items.filter((row) => row.resolved_at).map((row) => row.id)
  );
  const ownerByItem = new Map(items.map((row) => [row.id, row.owner_id]));
  const scores: Record<string, number> = Object.fromEntries(
    roster.map((row) => [row.participantId, 0])
  );
  for (const guess of guesses) {
    if (guess.guessed_participant_id === ownerByItem.get(guess.reveal_item_id)) {
      scores[guess.participant_id] = (scores[guess.participant_id] ?? 0) + 1;
    }
  }
  return scores;
}
