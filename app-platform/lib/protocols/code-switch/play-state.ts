import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { abandonIfGuesserGone, expireIfNeeded, shownStatsForSession } from "./actions";
import {
  GUESS_SECONDS,
  WRITE_SECONDS,
  rankShownStats,
} from "./engine";
import {
  connectedIds,
  displayNameMap,
  loadClues,
  loadCodeSwitchSession,
  loadPackWords,
  loadRound,
  loadRounds,
  loadRoster,
  loadWord,
  resolvePackId,
} from "./store";
import type {
  ClueBreakdownRow,
  CodeSwitchPhase,
  CodeSwitchPlayState,
  RosterChip,
  ViewerRole,
} from "./types";

function instructionFor(
  phase: CodeSwitchPhase,
  role: ViewerRole,
  roundType: "shared" | "unique" | null,
  guesserName: string
): { instruction: string; persistent: string } {
  if (role === "guesser") {
    if (phase === "write") {
      return {
        instruction: "You’re guessing. Stay on this phone. Don’t look at anyone else’s.",
        persistent: "You’re guessing. Stay on this phone. Don’t look at anyone else’s.",
      };
    }
    if (phase === "guess") {
      return {
        instruction: "One guess. Type the word. They cannot help. No searching. No chat.",
        persistent: "One guess. Type the word. They cannot help. No searching. No chat.",
      };
    }
  }
  if (role === "clueGiver" && phase === "write") {
    const persistent =
      roundType === "unique"
        ? "Only clues which are unique among participants will be shown to the guesser. Don’t say the type out loud."
        : "Only clues provided by more than one participant will be shown to the guesser. Don’t say the type out loud.";
    return { instruction: persistent, persistent };
  }
  if (role === "clueGiver" && phase === "guess") {
    return {
      instruction: "Don’t help. No searching. No chat.",
      persistent: "Don’t help. No searching. No chat.",
    };
  }
  if (role === "display") {
    return {
      instruction: `${guesserName} is guessing. Don’t help.`,
      persistent: `${guesserName} is guessing. Don’t help.`,
    };
  }
  if (phase === "reveal") {
    return { instruction: "That’s the word.", persistent: "" };
  }
  if (phase === "scoreboard") {
    return { instruction: "How often your clue reached the guesser.", persistent: "" };
  }
  return { instruction: "", persistent: "" };
}

export async function buildCodeSwitchPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  isDisplay: boolean;
  skipMaintenance?: boolean;
}): Promise<CodeSwitchPlayState> {
  const { admin, sessionId, participantId, isLead, isDisplay, skipMaintenance } = input;

  if (!skipMaintenance) {
    await expireIfNeeded(admin, sessionId);
    await abandonIfGuesserGone(admin, sessionId);
  }

  const cs = await loadCodeSwitchSession(admin, sessionId);
  const roster = await loadRoster(admin, sessionId);
  const names = displayNameMap(roster);
  const rounds = await loadRounds(admin, sessionId);
  const round = cs?.current_round_id ? await loadRound(admin, cs.current_round_id) : null;
  const wordRow = round ? await loadWord(admin, round.word_id) : null;
  const clues = round ? await loadClues(admin, round.id) : [];

  let viewerRole: ViewerRole = "clueGiver";
  if (isDisplay) viewerRole = "display";
  else if (round && round.guesser_id === participantId) viewerRole = "guesser";

  const secretOk = viewerRole === "clueGiver" && cs?.phase === "write";
  const roundType = secretOk && round ? round.round_type : null;
  const secretWord = secretOk && wordRow ? wordRow.word : null;

  const guesserName = round ? names[round.guesser_id] ?? "Guesser" : "Guesser";
  const copy = instructionFor(cs?.phase ?? "lobby", viewerRole, roundType, guesserName);

  const present = connectedIds(roster);
  const giverPool =
    round &&
    (present.length > 0 ? present : roster.map((r) => r.participantId)).filter(
      (id) => id !== round.guesser_id
    );
  const giverIds = giverPool ?? [];
  const lockedSet = new Set(clues.map((c) => c.participant_id));

  const rosterChips: RosterChip[] = roster
    .filter((row) => !round || row.participantId !== round.guesser_id)
    .map((row) => ({
      participantId: row.participantId,
      displayName: row.displayName,
      locked: lockedSet.has(row.participantId),
    }));

  const packId = await resolvePackId(admin, sessionId).catch(() => null);
  const packWords = packId ? await loadPackWords(admin, packId) : [];
  const consumed = rounds.filter((row) => row.end_reason !== "abandoned").length;
  const remainingWords = Math.max(0, packWords.length - consumed);

  const showBoard = cs?.phase === "guess" || cs?.phase === "reveal" || cs?.phase === "scoreboard";
  const showReveal = cs?.phase === "reveal" || cs?.phase === "scoreboard";

  let breakdown: ClueBreakdownRow[] | null = null;
  if (cs?.phase === "reveal" && viewerRole === "clueGiver" && round) {
    breakdown = clues.map((clue) => ({
      displayName: names[clue.participant_id] ?? "Player",
      text: clue.raw_text,
      survived: clue.survived === true,
      isMine: clue.participant_id === participantId,
    }));
  }

  const stats =
    cs?.phase === "scoreboard" ? rankShownStats(await shownStatsForSession(admin, sessionId, roster)) : [];
  const shownTheMost = stats.reduce<(typeof stats)[0] | null>((best, row) => {
    if (!best || row.shownCount > best.shownCount) return row;
    return best;
  }, null);

  const expected = Math.max(1, roster.length);
  const completed = rounds.filter((row) => row.end_reason && row.end_reason !== "abandoned").length;

  const empty: CodeSwitchPlayState = {
    phase: cs?.phase ?? "lobby",
    isLead,
    isDisplay,
    participantId,
    viewerRole,
    instruction: copy.instruction,
    persistentInstruction: copy.persistent,
    progress: completed / expected,
    roundIndex: round?.round_index ?? 0,
    teamScore: cs?.team_score ?? 0,
    guesserName,
    lockedCount: clues.length,
    clueGiverCount: giverIds.length,
    roster: rosterChips,
    writeStartedAt: cs?.phase === "write" ? round?.write_started_at ?? null : null,
    guessStartedAt: cs?.phase === "guess" ? round?.guess_started_at ?? null : null,
    timerSeconds: cs?.phase === "write" ? WRITE_SECONDS : cs?.phase === "guess" ? GUESS_SECONDS : null,
    remainingWords,
    canAnotherRound: Boolean(isLead && cs?.phase === "reveal" && remainingWords > 0),
    canWrap: Boolean(isLead && cs?.phase === "reveal"),
    canAdvanceRecap: Boolean(isLead && cs?.phase === "scoreboard"),
    myClueLocked: lockedSet.has(participantId),
    myGuessLocked: Boolean(round?.guess_text && round.guesser_id === participantId),
    clueError: null,
    word: secretWord,
    roundType,
    filteredClues: showBoard ? round?.filtered_clues_json ?? [] : [],
    targetWord: showReveal ? wordRow?.word ?? null : null,
    guessText: showReveal ? round?.guess_text ?? null : null,
    isHit: showReveal ? round?.is_hit ?? null : null,
    breakdown,
    shownLeaderboard: stats,
    shownTheMostName: shownTheMost && shownTheMost.shownCount > 0 ? shownTheMost.displayName : null,
    rateLeaderName: stats[0] && stats[0].shownCount > 0 ? stats[0].displayName : null,
  };

  return empty;
}
