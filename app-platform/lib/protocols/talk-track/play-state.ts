import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slotPoints, wordsForViewer } from "./engine";
import {
  abandonIfGuesserGone,
  expireTurnIfNeeded,
  pruneDisconnectedTrain,
  starterIdForTurn,
} from "./actions";
import {
  cardWords,
  displayNameMap,
  loadCard,
  loadTalkTrackSession,
  loadTeams,
  loadTurn,
  loadWordResults,
  loadRoster,
  remainingPlayableCards,
  resolvePackId,
} from "./store";
import type {
  TalkTrackPlayState,
  TalkTrackTeamView,
  TalkTrackViewerRole,
  TalkTrackWordView,
} from "./types";

const PERSISTENT =
  "One word each. Your team must form a proper coherent sentence. Do not say the word. Once someone hits Stop, no more hints or guidance of any kind from the Clue Train.";
const SPECTATOR = "Watch. Don't help. Don't clue.";

export async function buildTalkTrackPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  skipMaintenance?: boolean;
}): Promise<TalkTrackPlayState> {
  const { admin, sessionId, participantId, isLead, skipMaintenance } = input;

  if (!skipMaintenance) {
    await expireTurnIfNeeded(admin, sessionId);
    await abandonIfGuesserGone(admin, sessionId);
    await pruneDisconnectedTrain(admin, sessionId);
  }

  const tt = await loadTalkTrackSession(admin, sessionId);
  const roster = await loadRoster(admin, sessionId);
  const names = displayNameMap(roster);
  const teams = tt ? await loadTeams(admin, sessionId) : [];
  const packId = await resolvePackId(admin, sessionId).catch(() => null);
  const remainingCards =
    packId && tt ? await remainingPlayableCards(admin, sessionId, packId) : 0;

  const teamViews: TalkTrackTeamView[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    memberNames: team.member_ids.map((id) => names[id] ?? "Player"),
    score: team.score,
    isYours: team.member_ids.includes(participantId),
  }));

  const turn = tt?.current_turn_id ? await loadTurn(admin, tt.current_turn_id) : null;
  const liveTeam = turn ? teams.find((t) => t.id === turn.team_id) : undefined;

  let viewerRole: TalkTrackViewerRole = "spectator";
  if (turn && turn.guesser_id === participantId) viewerRole = "guesser";
  else if (turn && turn.train_ids.includes(participantId)) viewerRole = "train";

  let wordViews: TalkTrackWordView[] | null = null;
  if (turn?.card_id && tt?.phase === "turn") {
    const card = await loadCard(admin, turn.card_id);
    const results = await loadWordResults(admin, turn.id);
    if (card) {
      const texts = cardWords(card);
      const built: TalkTrackWordView[] = texts.map((text, i) => {
        const slot = i + 1;
        const row = results.find((r) => r.slot === slot);
        return {
          slot,
          text,
          outcome: row?.outcome ?? "unset",
          points: slotPoints(slot),
        };
      });
      wordViews = wordsForViewer(participantId, turn.guesser_id, built);
    }
  }

  const starterId = turn ? starterIdForTurn(turn) : null;
  const scoresVisible = tt?.phase !== "turn";
  const expectedTurns = Math.max(1, teams.length * 2);
  const completedTurns = teams.length
    ? Math.min(
        expectedTurns,
        Math.max(
          0,
          ((tt?.cycle_index ?? 1) - 1) * teams.length + (tt?.next_team_index ?? 0)
        )
      )
    : 0;

  const instruction =
    tt?.phase === "turn" && viewerRole === "guesser"
      ? turn?.subphase === "guessing"
        ? "Guess. They cannot help."
        : "Listen."
      : tt?.phase === "turn" && viewerRole === "spectator"
        ? SPECTATOR
        : PERSISTENT;

  return {
    phase: tt?.phase ?? "lobby",
    cycleIndex: tt?.cycle_index ?? 1,
    isLead,
    participantId,
    viewerRole,
    instruction,
    spectatorInstruction: viewerRole === "spectator" ? SPECTATOR : null,
    progress: completedTurns / expectedTurns,
    scoresVisible,
    teams: teamViews,
    remainingCards,
    paused: tt?.paused ?? false,
    hold:
      tt && (tt.phase === "hold" || tt.phase === "team_reveal") && tt.hold_started_at
        ? {
            reason: tt.phase === "team_reveal" ? "reveal" : tt.last_turn_end_reason ?? "skipped",
            turnPoints: tt.last_turn_points,
            holdStartedAt: tt.hold_started_at,
          }
        : null,
    turn:
      tt?.phase === "turn" && turn
        ? {
            id: turn.id,
            teamName: liveTeam?.name ?? "Your team",
            guesserName: turn.guesser_id ? names[turn.guesser_id] ?? "Guesser" : "Guesser",
            train: turn.train_ids
              .filter((id) => id !== turn.guesser_id)
              .map((id) => ({
                id,
                displayName: names[id] ?? "Player",
                isStarter: id === starterId,
              })),
            slot: turn.current_slot,
            subphase: turn.subphase,
            startedAt: turn.started_at,
            words: wordViews,
            canStop: viewerRole === "train" && turn.subphase === "cluing",
            canResolve: viewerRole === "train" && turn.subphase === "guessing",
          }
        : null,
    canDealAnotherCycle: remainingCards >= 1,
  };
}
