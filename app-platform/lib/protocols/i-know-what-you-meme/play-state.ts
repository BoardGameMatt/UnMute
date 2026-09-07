import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expireIfNeeded, scoresForSession } from "./actions";
import { connectedPool, GUESS_SECONDS } from "./engine";
import {
  connectedIds,
  displayNameMap,
  loadGuesses,
  loadIkwymSession,
  loadPrompt,
  loadResponses,
  loadRevealItems,
  loadRoster,
} from "./store";
import type { GuessOption, IkwymPhase, IkwymPlayState, RosterChip } from "./types";

const PERSISTENT =
  "Same prompts for everyone. Don’t say which GIF is yours. Guess on your phone — not out loud.";

const SELECTING_PHASES = new Set<IkwymPhase>(["R1_SELECTING", "R2_SELECTING"]);
const PROMPT_PHASES = new Set<IkwymPhase>(["R1_PROMPTS", "R2_PROMPTS"]);
const REVEAL_PHASES = new Set<IkwymPhase>(["REVEAL_GUESS", "REVEAL_SHOW", "SCOREBOARD"]);

function roundFor(phase: IkwymPhase): 1 | 2 {
  if (phase === "R2_PROMPTS" || phase === "R2_SELECTING") return 2;
  return 1;
}

function instructionFor(
  phase: IkwymPhase,
  isLead: boolean,
  isOwner: boolean,
  names: { owner: string | null }
): string {
  if (PROMPT_PHASES.has(phase)) {
    return isLead
      ? "Send these prompts to the team when you’re ready."
      : "Stand by — your lead is sending the prompts to the team.";
  }
  if (SELECTING_PHASES.has(phase)) {
    return "Answer both prompts, search, and lock one GIF you’d show this team.";
  }
  if (phase === "REVEAL_GUESS") {
    if (isOwner) return "Your GIF is up — stay quiet. See if they can figure it out.";
    return "";
  }
  if (phase === "REVEAL_SHOW") {
    return names.owner ? `It was ${names.owner}.` : "That’s who picked it.";
  }
  if (phase === "SCOREBOARD") {
    return isLead
      ? "Continue when the room is ready for feedback."
      : "Waiting for the facilitator to continue.";
  }
  return PERSISTENT;
}

export async function buildIkwymPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  skipMaintenance?: boolean;
}): Promise<IkwymPlayState> {
  const { admin, sessionId, participantId, isLead } = input;
  if (!input.skipMaintenance) {
    await expireIfNeeded(admin, sessionId);
  }

  const ikwym = await loadIkwymSession(admin, sessionId);
  if (!ikwym) {
    throw new Error("I Know What You Meme has not started.");
  }

  const roster = await loadRoster(admin, sessionId);
  const names = displayNameMap(roster);
  const live = connectedPool(
    roster.map((r) => r.participantId),
    connectedIds(roster)
  );
  const round = roundFor(ikwym.phase);
  const collectionCheckinId = round === 1 ? ikwym.r1_checkin_id : ikwym.r2_checkin_id;
  const collectionStimulusId = round === 1 ? ikwym.r1_stimulus_id : ikwym.r2_stimulus_id;
  const [collectionCheckin, collectionStimulus] = await Promise.all([
    loadPrompt(admin, collectionCheckinId),
    loadPrompt(admin, collectionStimulusId),
  ]);

  const responses = SELECTING_PHASES.has(ikwym.phase)
    ? await loadResponses(admin, sessionId, round)
    : [];
  const submittedIds = new Set(responses.map((r) => r.participant_id));
  const mine = responses.find((r) => r.participant_id === participantId) ?? null;

  const rosterChips: RosterChip[] = roster.map((row) => ({
    participantId: row.participantId,
    displayName: row.displayName,
    submitted: submittedIds.has(row.participantId),
  }));

  const items = REVEAL_PHASES.has(ikwym.phase) ? await loadRevealItems(admin, sessionId) : [];
  const current = items.find((row) => row.id === ikwym.current_reveal_item_id) ?? null;
  const revealIndex = current ? items.findIndex((row) => row.id === current.id) : 0;
  const isOwner = Boolean(
    current &&
      current.owner_id === participantId &&
      (ikwym.phase === "REVEAL_GUESS" || ikwym.phase === "REVEAL_SHOW")
  );
  const showOwner = ikwym.phase === "REVEAL_SHOW";

  const guesses =
    current && (ikwym.phase === "REVEAL_GUESS" || ikwym.phase === "REVEAL_SHOW")
      ? await loadGuesses(admin, current.id)
      : [];
  const myGuess = guesses.find((g) => g.participant_id === participantId) ?? null;
  const eligible = current ? live.filter((id) => id !== current.owner_id) : [];
  const lockedIn = guesses.filter((g) => eligible.includes(g.participant_id));

  const correctGuesserNames =
    showOwner && current
      ? guesses
          .filter((g) => g.guessed_participant_id === current.owner_id)
          .map((g) => names[g.participant_id] ?? "Player")
      : [];

  const scoresMap =
    ikwym.phase === "SCOREBOARD" ? await scoresForSession(admin, sessionId, roster) : {};
  const scores =
    ikwym.phase === "SCOREBOARD"
      ? roster
          .map((row) => ({
            participantId: row.participantId,
            displayName: row.displayName,
            score: scoresMap[row.participantId] ?? 0,
          }))
          .sort((a, b) => b.score - a.score)
      : [];

  const currentGifUrl =
    ikwym.phase === "REVEAL_GUESS" || ikwym.phase === "REVEAL_SHOW"
      ? current?.gif_url ?? null
      : null;

  let checkinPrompt = collectionCheckin?.prompt ?? "";
  let stimulusLabel = collectionStimulus?.label ?? "";
  let stimulusPrompt = collectionStimulus?.prompt ?? "";
  let currentPromptLabel: string | null = null;

  if (current && (ikwym.phase === "REVEAL_GUESS" || ikwym.phase === "REVEAL_SHOW")) {
    const cid = current.round === 1 ? ikwym.r1_checkin_id : ikwym.r2_checkin_id;
    const sid = current.round === 1 ? ikwym.r1_stimulus_id : ikwym.r2_stimulus_id;
    const [c, s] = await Promise.all([loadPrompt(admin, cid), loadPrompt(admin, sid)]);
    checkinPrompt = c?.prompt ?? "";
    stimulusLabel = s?.label ?? "";
    stimulusPrompt = s?.prompt ?? "";
    currentPromptLabel = `Round ${current.round}`;
  }

  if (PROMPT_PHASES.has(ikwym.phase) && !isLead) {
    checkinPrompt = "";
    stimulusLabel = "";
    stimulusPrompt = "";
  }

  const resolvedCount = items.filter((row) => row.resolved_at).length;
  const progress = items.length === 0 ? 0 : Math.min(1, resolvedCount / items.length);

  const guessOptions: GuessOption[] =
    ikwym.phase === "REVEAL_GUESS" && !isOwner
      ? roster
          .filter((row) => row.participantId !== participantId)
          .map((row) => ({ participantId: row.participantId, displayName: row.displayName }))
      : [];

  return {
    phase: ikwym.phase,
    isLead,
    participantId,
    instruction: instructionFor(ikwym.phase, isLead, isOwner, {
      owner: showOwner && current ? names[current.owner_id] ?? null : null,
    }),
    persistentInstruction:
      ikwym.phase === "REVEAL_GUESS"
        ? `${PERSISTENT} The person who picked it is sitting this one out.`
        : PERSISTENT,
    progress,
    round,
    checkinPrompt,
    stimulusLabel,
    stimulusPrompt,
    confirmedCount: submittedIds.size,
    connectedCount: live.length,
    roster: rosterChips,
    myGifUrl: mine?.gif_url ?? null,
    hasConfirmed: Boolean(mine),
    currentGifUrl,
    currentPromptLabel,
    revealIndex: Math.max(0, revealIndex),
    revealTotal: items.length,
    isOwner,
    guessOptions,
    myGuessId: myGuess?.guessed_participant_id ?? null,
    myGuessLocked: Boolean(myGuess),
    ownerName: showOwner && current ? names[current.owner_id] ?? null : null,
    correctGuesserNames,
    timerStartedAt: ikwym.phase === "REVEAL_GUESS" ? ikwym.guess_started_at : null,
    timerSeconds: ikwym.phase === "REVEAL_GUESS" ? GUESS_SECONDS : null,
    lockedInCount: lockedIn.length,
    eligibleCount: eligible.length,
    canBroadcast: isLead && PROMPT_PHASES.has(ikwym.phase),
    canNext: isLead && ikwym.phase === "REVEAL_SHOW",
    canWrap: isLead && ikwym.phase === "REVEAL_SHOW",
    canAdvanceRecap: isLead && ikwym.phase === "SCOREBOARD",
    scores,
  };
}
