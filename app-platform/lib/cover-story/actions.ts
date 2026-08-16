import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoverStoryAgency,
  CoverStoryDeal,
  CoverStoryGuess,
  CoverStoryPhase,
  CoverStorySession,
  CoverStoryWordLog,
} from "@/lib/types/database";
import {
  COVER_STORY_AGENCY_MAX,
  COVER_STORY_EVIDENCE_MAX,
  COVER_STORY_GUESS_SECONDS,
  COVER_STORY_HAND_SIZE,
  COVER_STORY_MAX_PLAYERS,
  COVER_STORY_MIN_PLAYERS,
  COVER_STORY_NOTE_MAX,
  type CoverStoryAction,
} from "./types";
import { suggestCorrect } from "./match-guess";
import { fisherYates, missionScore, pickDisjointHands, pickHand, type1Score } from "./score";
import {
  burnedAgencyIds,
  ensureCoverStorySession,
  loadCoverStorySession,
  loadDeals,
  loadMembers,
  playersOnly,
  syncPublicState,
} from "./session";

type ActionResult = { ok: true } | { ok: false; status: number; error: string };

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function requireCs(
  admin: SupabaseClient,
  sessionId: string
): Promise<CoverStorySession> {
  const cs = await loadCoverStorySession(admin, sessionId);
  if (!cs) {
    throw Object.assign(new Error("Cover Story is not initialized."), { status: 404 });
  }
  return cs;
}

async function patchCs(
  admin: SupabaseClient,
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("cover_story_sessions").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

async function readReaders(
  admin: SupabaseClient,
  sessionId: string
): Promise<Record<string, { screenIndex: number; done: boolean }>> {
  const { data } = await admin
    .from("session_state")
    .select("state_json")
    .eq("session_id", sessionId)
    .maybeSingle();
  const coverStory = (data?.state_json as { coverStory?: { readers?: Record<string, { screenIndex: number; done: boolean }> } } | null)
    ?.coverStory;
  return coverStory?.readers ?? {};
}

export async function dispatchCoverStoryAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: CoverStoryAction;
}): Promise<ActionResult> {
  try {
    await ensureCoverStorySession(input.admin, input.sessionId);
    await handleAction(input);
    return { ok: true };
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const message = err instanceof Error ? err.message : "Action failed.";
    return { ok: false, status, error: message };
  }
}

async function handleAction(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  action: CoverStoryAction;
}): Promise<void> {
  const { admin, sessionId, participantId, isLead, action } = input;

  switch (action.type) {
    case "setRevealDate": {
      if (!isLead) throw Object.assign(new Error("Only the lead can set the reveal date."), { status: 403 });
      if (!isIsoDate(action.revealOn)) throw new Error("Enter a valid date.");
      const cs = await ensureCoverStorySession(admin, sessionId);
      await patchCs(admin, cs.id, { reveal_on: action.revealOn });
      await syncPublicState(admin, sessionId, { phase: cs.phase });
      return;
    }
    case "startReading": {
      if (!isLead) throw Object.assign(new Error("Only the lead can start."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      if (cs.phase === "reading") return;
      if (cs.phase !== "lobby") {
        throw new Error("Reading has already started.");
      }
      if (!cs.reveal_on) throw new Error("Set the reveal date before starting.");
      const members = playersOnly(await loadMembers(admin, sessionId));
      if (members.length < COVER_STORY_MIN_PLAYERS) {
        throw new Error("Need at least 2 players plus the facilitator.");
      }
      await clearPlayData(admin, cs);
      await patchCs(admin, cs.id, { phase: "reading" satisfies CoverStoryPhase });
      await syncPublicState(admin, sessionId, { phase: "reading", playbackIndex: 0, insightsOn: false, readers: {} });
      return;
    }
    case "setReadingProgress": {
      const cs = await requireCs(admin, sessionId);
      if (cs.phase !== "reading") throw new Error("Reading is closed.");
      const screenIndex = Math.max(0, Math.min(4, Math.floor(action.screenIndex)));
      const readers = await readReaders(admin, sessionId);
      readers[participantId] = { screenIndex, done: action.done || screenIndex >= 4 && action.done };
      if (action.done) readers[participantId] = { screenIndex: 4, done: true };
      await syncPublicState(admin, sessionId, { phase: "reading", readers });
      return;
    }
    case "forceAdvanceReader": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const readers = await readReaders(admin, sessionId);
      readers[action.participantId] = { screenIndex: 4, done: true };
      await syncPublicState(admin, sessionId, { readers });
      return;
    }
    case "gateDiscussion": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      await patchCs(admin, cs.id, { phase: "discuss" });
      await syncPublicState(admin, sessionId, { phase: "discuss", playbackIndex: 0, insightsOn: false });
      return;
    }
    case "setPlayback": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const playbackIndex = Math.max(0, Math.min(4, Math.floor(action.playbackIndex)));
      await syncPublicState(admin, sessionId, {
        playbackIndex,
        insightsOn: action.insightsOn,
      });
      return;
    }
    case "openInsights": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      await patchCs(admin, cs.id, { phase: "insights" });
      await syncPublicState(admin, sessionId, { phase: "insights", insightsOn: true, playbackIndex: 0 });
      return;
    }
    case "openDeal": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      await dealMissingHands(admin, sessionId, cs);
      await patchCs(admin, cs.id, { phase: "deal" });
      await syncPublicState(admin, sessionId, { phase: "deal" });
      return;
    }
    case "ensureDeal": {
      const cs = await requireCs(admin, sessionId);
      const { data: existing } = await admin
        .from("cover_story_deals")
        .select("id")
        .eq("cover_story_session_id", cs.id)
        .eq("participant_id", participantId)
        .maybeSingle();
      if (!existing) {
        throw new Error("Your cover is being prepared. Wait for the deal.");
      }
      return;
    }
    case "lockAgency": {
      await lockAgency(admin, sessionId, participantId, action.agencyId);
      return;
    }
    case "openField": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      await patchCs(admin, cs.id, { phase: "field" });
      await syncPublicState(admin, sessionId, { phase: "field" });
      return;
    }
    case "submitMissionReport": {
      await submitMissionReport(admin, sessionId, participantId, action.words);
      return;
    }
    case "admitLate": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await admitLate(admin, sessionId, action.displayName);
      return;
    }
    case "startReveal": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await startReveal(admin, sessionId);
      return;
    }
    case "beginGuessing": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await beginGuessing(admin, sessionId);
      return;
    }
    case "submitGuess": {
      await submitGuess(admin, sessionId, participantId, action.agencyText, action.evidenceText);
      return;
    }
    case "closeGuessWindow": {
      if (!isLead) {
        throw Object.assign(new Error("Only the lead can close guesses early."), { status: 403 });
      }
      await closeGuessWindow(admin, sessionId);
      return;
    }
    case "revealCover": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      if (cs.reveal_subphase !== "gallery") throw new Error("Guesses are not up yet.");
      await patchCs(admin, cs.id, { reveal_subphase: "board" });
      await syncPublicState(admin, sessionId, { phase: "reveal" });
      return;
    }
    case "openScoring": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      if (cs.reveal_subphase !== "board") throw new Error("Reveal the cover first.");
      await patchCs(admin, cs.id, { reveal_subphase: "mark" });
      await syncPublicState(admin, sessionId, { phase: "reveal" });
      return;
    }
    case "setMarks": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await setMarks(admin, sessionId, action.marks);
      return;
    }
    case "finalizeTarget": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await finalizeTarget(admin, sessionId);
      return;
    }
    case "showPoints": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      await patchCs(admin, cs.id, { reveal_subphase: "points" });
      await syncPublicState(admin, sessionId, { phase: "reveal" });
      return;
    }
    case "nextTarget": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await nextTarget(admin, sessionId);
      return;
    }
    case "skipTarget": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await skipTarget(admin, sessionId);
      return;
    }
    case "scoreWithoutStory": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      await scoreWithoutStory(admin, sessionId);
      return;
    }
    case "showFinal": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      await patchCs(admin, cs.id, { reveal_subphase: "final" });
      await syncPublicState(admin, sessionId, { phase: "reveal" });
      return;
    }
    case "completeSession": {
      if (!isLead) throw Object.assign(new Error("Only the lead can do that."), { status: 403 });
      const cs = await requireCs(admin, sessionId);
      await patchCs(admin, cs.id, { phase: "complete", reveal_subphase: "final" });
      const completedAt = new Date().toISOString();
      const { error } = await admin
        .from("sessions")
        .update({ status: "completed", completed_at: completedAt })
        .eq("id", sessionId);
      if (error) throw new Error(error.message);
      await syncPublicState(admin, sessionId, { phase: "complete" });
      return;
    }
    default: {
      const _never: never = action;
      throw new Error(`Unknown action ${JSON.stringify(_never)}`);
    }
  }
}

async function clearPlayData(admin: SupabaseClient, cs: CoverStorySession): Promise<void> {
  const { error: guessErr } = await admin
    .from("cover_story_guesses")
    .delete()
    .eq("cover_story_session_id", cs.id);
  if (guessErr) throw new Error(guessErr.message);
  const { error: resultErr } = await admin
    .from("cover_story_target_results")
    .delete()
    .eq("cover_story_session_id", cs.id);
  if (resultErr) throw new Error(resultErr.message);
  const { error: dealErr } = await admin
    .from("cover_story_deals")
    .delete()
    .eq("cover_story_session_id", cs.id);
  if (dealErr) throw new Error(dealErr.message);
  await patchCs(admin, cs.id, {
    reveal_order: [],
    reveal_index: 0,
    guess_started_at: null,
    reveal_subphase: "guess",
  });
}

async function loadPlayableAgencyIds(admin: SupabaseClient): Promise<number[]> {
  const { data: agencies, error } = await admin
    .from("cover_story_agencies")
    .select("id")
    .eq("playable", true)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return ((agencies ?? []) as { id: number }[]).map((row) => row.id);
}

/** Assign disjoint hands to everyone still missing a deal, in one insert. */
async function dealMissingHands(
  admin: SupabaseClient,
  sessionId: string,
  cs: CoverStorySession
): Promise<void> {
  const members = await loadMembers(admin, sessionId);
  const deals = await loadDeals(admin, cs.id);
  const already = new Set(deals.map((deal) => deal.participant_id));
  const need = members.filter((member) => !already.has(member.participantId));
  if (need.length === 0) return;

  const burned = burnedAgencyIds(deals);
  const available = (await loadPlayableAgencyIds(admin)).filter((id) => !burned.has(id));
  const hands = pickDisjointHands(available, need.length, COVER_STORY_HAND_SIZE);
  const { error: insertErr } = await admin.from("cover_story_deals").insert(
    need.map((member, index) => ({
      cover_story_session_id: cs.id,
      participant_id: member.participantId,
      shown_agency_ids: hands[index],
    }))
  );
  if (insertErr) throw new Error(insertErr.message);
}

function guessWindowExpired(cs: CoverStorySession): boolean {
  if (!cs.guess_started_at) return false;
  const elapsed = Date.now() - new Date(cs.guess_started_at).getTime();
  return elapsed >= (cs.guess_duration_seconds || COVER_STORY_GUESS_SECONDS) * 1000;
}

export async function expireGuessIfNeeded(
  admin: SupabaseClient,
  sessionId: string,
  cs: CoverStorySession
): Promise<CoverStorySession> {
  if (cs.phase !== "reveal" || cs.reveal_subphase !== "guess") return cs;
  if (!guessWindowExpired(cs)) return cs;
  await patchCs(admin, cs.id, { reveal_subphase: "gallery" });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
  return { ...cs, reveal_subphase: "gallery" };
}

async function lockAgency(
  admin: SupabaseClient,
  sessionId: string,
  participantId: string,
  agencyId: number
): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  const { data: dealRaw, error } = await admin
    .from("cover_story_deals")
    .select("*")
    .eq("cover_story_session_id", cs.id)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const deal = dealRaw as CoverStoryDeal | null;
  if (!deal) throw new Error("Your cards are not ready yet.");
  if (deal.locked_agency_id) throw new Error("You already locked an agency.");
  if (!deal.shown_agency_ids.includes(agencyId)) {
    throw new Error("That agency is not on your cards.");
  }
  const lockedAt = new Date().toISOString();
  const { error: updErr } = await admin
    .from("cover_story_deals")
    .update({ locked_agency_id: agencyId, locked_at: lockedAt })
    .eq("id", deal.id);
  if (updErr) throw new Error(updErr.message);

  const { data: words, error: wordsErr } = await admin
    .from("cover_story_agency_words")
    .select("id")
    .eq("agency_id", agencyId);
  if (wordsErr) throw new Error(wordsErr.message);
  if (words && words.length > 0) {
    const { error: logErr } = await admin.from("cover_story_word_logs").insert(
      words.map((word) => ({
        deal_id: deal.id,
        word_id: word.id,
        status: "open",
      }))
    );
    if (logErr) throw new Error(logErr.message);
  }
  await syncPublicState(admin, sessionId, { phase: cs.phase });
}

async function submitMissionReport(
  admin: SupabaseClient,
  sessionId: string,
  participantId: string,
  words: Extract<CoverStoryAction, { type: "submitMissionReport" }>["words"]
): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.phase !== "reveal" || cs.reveal_subphase !== "mission") {
    throw new Error("Mission reports are closed.");
  }
  const { data: dealRaw } = await admin
    .from("cover_story_deals")
    .select("*")
    .eq("cover_story_session_id", cs.id)
    .eq("participant_id", participantId)
    .maybeSingle();
  const deal = dealRaw as CoverStoryDeal | null;
  if (!deal?.locked_agency_id) throw new Error("Lock an agency first.");

  const { data: logsRaw } = await admin
    .from("cover_story_word_logs")
    .select("*")
    .eq("deal_id", deal.id);
  const logs = (logsRaw ?? []) as CoverStoryWordLog[];
  if (logs.length !== 5 || words.length !== 5) {
    throw new Error("Report all five words.");
  }
  if (logs.every((log) => log.status !== "open")) {
    throw new Error("Mission already filed.");
  }
  const logIds = new Set(logs.map((log) => log.word_id));
  if (words.some((word) => !logIds.has(word.wordId))) {
    throw new Error("That word is not on your mission.");
  }

  const members = await loadMembers(admin, sessionId);
  const allowed = new Set(
    members.filter((m) => m.participantId !== participantId).map((m) => m.participantId)
  );

  for (const word of words) {
    const note = (word.note ?? "").trim().slice(0, COVER_STORY_NOTE_MAX);
    if (word.status === "not_planted") {
      const { error } = await admin
        .from("cover_story_word_logs")
        .update({
          status: "not_planted",
          planted_on: null,
          witness_ids: [],
          note,
          updated_at: new Date().toISOString(),
        })
        .eq("deal_id", deal.id)
        .eq("word_id", word.wordId);
      if (error) throw new Error(error.message);
      continue;
    }

    const plantedOn = word.plantedOn ?? "";
    if (!isIsoDate(plantedOn)) throw new Error("Enter the date you spoke each planted word.");
    if (cs.reveal_on && plantedOn >= cs.reveal_on) {
      throw new Error("That date is on or after the reveal.");
    }
    const witnesses = Array.from(
      new Set((word.witnessIds ?? []).filter((id) => id !== participantId))
    );
    if (witnesses.length < 2) {
      throw new Error("A planted word needs at least two other people, or mark it as didn’t plant.");
    }
    if (witnesses.some((id) => !allowed.has(id))) {
      throw new Error("Witnesses must be in this session.");
    }
    const { error } = await admin
      .from("cover_story_word_logs")
      .update({
        status: "planted",
        planted_on: plantedOn,
        witness_ids: witnesses,
        note,
        updated_at: new Date().toISOString(),
      })
      .eq("deal_id", deal.id)
      .eq("word_id", word.wordId);
    if (error) throw new Error(error.message);
  }
  await syncPublicState(admin, sessionId, { phase: "reveal" });
}

async function admitLate(
  admin: SupabaseClient,
  sessionId: string,
  displayName: string
): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.phase === "reveal" || cs.phase === "complete") {
    throw new Error("Too late to join as an agent.");
  }
  const name = displayName.trim();
  if (!name) throw new Error("Enter a name.");
  const members = await loadMembers(admin, sessionId);
  if (members.length >= COVER_STORY_MAX_PLAYERS) {
    throw new Error("This session is full.");
  }
  const deals = await loadDeals(admin, cs.id);
  const burned = burnedAgencyIds(deals);
  const { data: agencies } = await admin
    .from("cover_story_agencies")
    .select("id")
    .eq("playable", true)
    .eq("active", true);
  const available = ((agencies ?? []) as { id: number }[])
    .map((row) => row.id)
    .filter((id) => !burned.has(id));
  if (available.length < COVER_STORY_HAND_SIZE) {
    throw new Error("Not enough unused agencies remain.");
  }

  const { data: sessionRow, error: sessionErr } = await admin
    .from("sessions")
    .select("team_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr || !sessionRow) throw new Error("Session not found.");

  const { data: participant, error: pErr } = await admin
    .from("participants")
    .insert({
      team_id: sessionRow.team_id,
      person_id: null,
      display_name: name,
      role: "member",
    })
    .select("id")
    .single();
  if (pErr || !participant) throw new Error(pErr?.message ?? "Could not add participant.");

  const { error: spErr } = await admin.from("session_participants").insert({
    session_id: sessionId,
    participant_id: participant.id,
    role_in_session: "member",
  });
  if (spErr) throw new Error(spErr.message);

  if (cs.phase === "deal" || cs.phase === "field") {
    const hand = pickHand(available, COVER_STORY_HAND_SIZE);
    const { error: dealErr } = await admin.from("cover_story_deals").insert({
      cover_story_session_id: cs.id,
      participant_id: participant.id,
      shown_agency_ids: hand,
    });
    if (dealErr) throw new Error(dealErr.message);
  }
}

async function startReveal(admin: SupabaseClient, sessionId: string): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.phase !== "field") {
    throw new Error("Start the reveal from the field period.");
  }
  const members = await loadMembers(admin, sessionId);
  const deals = await loadDeals(admin, cs.id);
  const lockedPlayers = members.filter((p) =>
    deals.some((d) => d.participant_id === p.participantId && d.locked_agency_id)
  );
  if (lockedPlayers.length === 0) throw new Error("No locked agencies to reveal.");
  const order = fisherYates(lockedPlayers.map((p) => p.participantId));
  await patchCs(admin, cs.id, {
    phase: "reveal",
    reveal_order: order,
    reveal_index: 0,
    reveal_subphase: "mission",
    guess_started_at: null,
    guess_duration_seconds: COVER_STORY_GUESS_SECONDS,
  });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
}

async function beginGuessing(admin: SupabaseClient, sessionId: string): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.phase !== "reveal" || cs.reveal_subphase !== "mission") {
    throw new Error("Guessing is not next.");
  }
  await patchCs(admin, cs.id, {
    reveal_subphase: "guess",
    guess_started_at: new Date().toISOString(),
  });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
}

async function submitGuess(
  admin: SupabaseClient,
  sessionId: string,
  participantId: string,
  agencyText: string,
  evidenceText: string
): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.phase !== "reveal" || cs.reveal_subphase !== "guess") {
    throw new Error("Guessing is closed.");
  }
  if (guessWindowExpired(cs)) {
    await expireGuessIfNeeded(admin, sessionId, cs);
    throw new Error("Time is up.");
  }
  const targetId = cs.reveal_order[cs.reveal_index];
  if (!targetId) throw new Error("No one is on the board.");
  if (targetId === participantId) throw new Error("You do not guess for yourself.");
  const agency = agencyText.trim().slice(0, COVER_STORY_AGENCY_MAX);
  const evidence = evidenceText.trim().slice(0, COVER_STORY_EVIDENCE_MAX);
  if (!agency) throw new Error("Name their agency.");

  const { data: dealRaw } = await admin
    .from("cover_story_deals")
    .select("locked_agency_id")
    .eq("cover_story_session_id", cs.id)
    .eq("participant_id", targetId)
    .maybeSingle();
  const lockedId = (dealRaw as { locked_agency_id: number | null } | null)?.locked_agency_id;
  let suggested = false;
  if (lockedId) {
    const { data: agencyRow } = await admin
      .from("cover_story_agencies")
      .select("official_name, aliases")
      .eq("id", lockedId)
      .maybeSingle();
    const row = agencyRow as CoverStoryAgency | null;
    if (row) suggested = suggestCorrect(agency, row.official_name, row.aliases ?? []);
  }

  const { error } = await admin.from("cover_story_guesses").upsert(
    {
      cover_story_session_id: cs.id,
      target_participant_id: targetId,
      guesser_participant_id: participantId,
      agency_text: agency,
      evidence_text: evidence,
      suggested_correct: suggested,
      marked_correct: suggested,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "cover_story_session_id,target_participant_id,guesser_participant_id" }
  );
  if (error) throw new Error(error.message);

  const members = await loadMembers(admin, sessionId);
  const guesserCount = members.filter((p) => p.participantId !== targetId).length;
  const { count } = await admin
    .from("cover_story_guesses")
    .select("id", { count: "exact", head: true })
    .eq("cover_story_session_id", cs.id)
    .eq("target_participant_id", targetId);
  if ((count ?? 0) >= guesserCount && guesserCount > 0) {
    await patchCs(admin, cs.id, { reveal_subphase: "gallery" });
    await syncPublicState(admin, sessionId, { phase: "reveal" });
  }
}

async function closeGuessWindow(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.reveal_subphase !== "guess") return;
  await patchCs(admin, cs.id, { reveal_subphase: "gallery" });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
}

async function setMarks(
  admin: SupabaseClient,
  sessionId: string,
  marks: { guessId: string; markedCorrect: boolean }[]
): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.reveal_subphase !== "mark") throw new Error("Scoring is not open.");
  for (const mark of marks) {
    const { error } = await admin
      .from("cover_story_guesses")
      .update({ marked_correct: mark.markedCorrect })
      .eq("id", mark.guessId)
      .eq("cover_story_session_id", cs.id);
    if (error) throw new Error(error.message);
  }
}

async function finalizeTarget(admin: SupabaseClient, sessionId: string): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  if (cs.reveal_subphase !== "mark") throw new Error("Score guesses first.");
  const targetId = cs.reveal_order[cs.reveal_index];
  if (!targetId) throw new Error("No one is on the board.");
  const members = await loadMembers(admin, sessionId);
  const n = members.filter((p) => p.participantId !== targetId).length;
  const { data: guessesRaw } = await admin
    .from("cover_story_guesses")
    .select("*")
    .eq("cover_story_session_id", cs.id)
    .eq("target_participant_id", targetId);
  const guesses = (guessesRaw ?? []) as CoverStoryGuess[];
  const k = guesses.filter((g) => g.marked_correct).length;

  const { data: dealRaw } = await admin
    .from("cover_story_deals")
    .select("id")
    .eq("cover_story_session_id", cs.id)
    .eq("participant_id", targetId)
    .maybeSingle();
  let allPlanted = false;
  if (dealRaw) {
    const { data: logs } = await admin
      .from("cover_story_word_logs")
      .select("status")
      .eq("deal_id", dealRaw.id);
    const rows = (logs ?? []) as Pick<CoverStoryWordLog, "status">[];
    allPlanted = rows.length === 5 && rows.every((row) => row.status === "planted");
  }

  const { error } = await admin.from("cover_story_target_results").upsert(
    {
      cover_story_session_id: cs.id,
      target_participant_id: targetId,
      n,
      k,
      type1_score: type1Score(k, n),
      mission_score: missionScore(allPlanted),
      finalized_at: new Date().toISOString(),
    },
    { onConflict: "cover_story_session_id,target_participant_id" }
  );
  if (error) throw new Error(error.message);
  await patchCs(admin, cs.id, { reveal_subphase: "points" });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
}

async function nextTarget(admin: SupabaseClient, sessionId: string): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  const nextIndex = cs.reveal_index + 1;
  if (nextIndex >= cs.reveal_order.length) {
    await patchCs(admin, cs.id, { reveal_subphase: "final" });
    await syncPublicState(admin, sessionId, { phase: "reveal" });
    return;
  }
  await patchCs(admin, cs.id, {
    reveal_index: nextIndex,
    reveal_subphase: "guess",
    guess_started_at: new Date().toISOString(),
  });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
}

async function skipTarget(admin: SupabaseClient, sessionId: string): Promise<void> {
  const cs = await requireCs(admin, sessionId);
  const current = cs.reveal_order[cs.reveal_index];
  if (!current) return;
  const rest = cs.reveal_order.filter((_, i) => i !== cs.reveal_index);
  const nextOrder = [...rest, current];
  await patchCs(admin, cs.id, {
    reveal_order: nextOrder,
    reveal_subphase: "guess",
    guess_started_at: new Date().toISOString(),
  });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
}

async function scoreWithoutStory(admin: SupabaseClient, sessionId: string): Promise<void> {
  await closeGuessWindow(admin, sessionId);
  const cs = await requireCs(admin, sessionId);
  await patchCs(admin, cs.id, { reveal_subphase: "mark" });
  await syncPublicState(admin, sessionId, { phase: "reveal" });
  await finalizeTarget(admin, sessionId);
}

