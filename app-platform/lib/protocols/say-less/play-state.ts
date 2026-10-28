import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceIfDue } from "./actions";
import {
  SAY_LESS_CATEGORY_LABELS,
  SAY_LESS_PREVIEW_SECONDS,
  cardForViewer,
  cardsPerTurn,
  otherTeam,
  pickClueGiver,
  playInstruction,
  roleLine,
  sessionProgress,
  teamScores,
  winnerLabel,
  type SayLessTeamLabel,
} from "./engine";
import {
  connectedMap,
  displayNameMap,
  ensureLobbyRow,
  loadCard,
  loadCardsByIds,
  loadEventsForTurns,
  loadPreviewCardIds,
  loadRoster,
  loadSayLessSession,
  loadTeams,
  loadTurn,
  loadTurns,
  type SayLessEventRow,
  type SayLessSessionRow,
  type SayLessTeamRow,
  type SayLessTurnRow,
} from "./store";
import type { SayLessPlayState, SayLessTeamView, SayLessViewerRole } from "./types";

function teamName(label: SayLessTeamLabel): string {
  return label === "A" ? "Team A" : "Team B";
}

function roundTally(
  turns: SayLessTurnRow[],
  events: SayLessEventRow[],
  round: 1 | 2
): { gotIt: number; turns: number; cardsPerTurn: number | null } {
  const roundTurns = turns.filter((turn) => turn.round === round && turn.started_at && turn.ended_at);
  const turnIds = new Set(roundTurns.map((turn) => turn.id));
  const gotIt = events.filter(
    (event) => turnIds.has(event.turn_id) && event.outcome === "got_it"
  ).length;
  return { gotIt, turns: roundTurns.length, cardsPerTurn: cardsPerTurn(gotIt, roundTurns.length) };
}

function nextGiverName(
  row: SayLessSessionRow,
  teams: SayLessTeamRow[],
  names: Record<string, string>,
  connected: Record<string, boolean>
): string | null {
  const team = teams.find((item) => item.label === row.next_team);
  if (!team) return null;
  const cursor = row.next_team === "A" ? row.cursor_a : row.cursor_b;
  const pick = pickClueGiver(team.member_ids, cursor, connected);
  if (pick.giverId) return names[pick.giverId] ?? "Player";
  const other = teams.find((item) => item.label === otherTeam(row.next_team));
  if (!other) return null;
  const otherCursor = row.next_team === "A" ? row.cursor_b : row.cursor_a;
  const fallback = pickClueGiver(other.member_ids, otherCursor, connected);
  return fallback.giverId ? names[fallback.giverId] ?? "Player" : null;
}

export async function buildSayLessPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  skipMaintenance?: boolean;
}): Promise<SayLessPlayState> {
  const { admin, sessionId, participantId, isLead, skipMaintenance } = input;
  if (!skipMaintenance) {
    await advanceIfDue(admin, sessionId);
  }

  const row = (await loadSayLessSession(admin, sessionId)) ?? (await ensureLobbyRow(admin, sessionId));
  const roster = await loadRoster(admin, sessionId);
  const names = displayNameMap(roster);
  const connected = connectedMap(roster);
  const teams = row.phase === "lobby" ? [] : await loadTeams(admin, sessionId);
  const turns = row.phase === "lobby" ? [] : await loadTurns(admin, sessionId);
  const events = await loadEventsForTurns(admin, turns.map((turn) => turn.id));
  const liveTurn = row.current_turn_id ? await loadTurn(admin, row.current_turn_id) : null;
  const liveTeam = liveTurn ? teams.find((team) => team.id === liveTurn.team_id) : undefined;

  let viewerRole: SayLessViewerRole | null = null;
  if (row.phase === "turn" && liveTurn) {
    if (liveTurn.clue_giver_id === participantId) viewerRole = "clue";
    else if (liveTeam?.member_ids.includes(participantId)) viewerRole = "guess";
    else viewerRole = "listen";
  }

  const topId = row.pile_card_ids[0] ?? null;
  const topCard =
    row.phase === "turn" && topId && viewerRole === "clue" ? await loadCard(admin, topId) : null;
  const currentCard = cardForViewer(
    participantId,
    liveTurn?.clue_giver_id ?? null,
    topCard
      ? { id: topCard.id, name: topCard.name, hint: row.round === 1 ? topCard.hint : null }
      : null
  );

  let previewCards: SayLessPlayState["previewCards"] = null;
  if (row.phase === "preview") {
    const ids = await loadPreviewCardIds(admin, sessionId, participantId);
    if (ids) {
      const cards = await loadCardsByIds(admin, ids);
      previewCards = ids
        .map((id) => cards.find((card) => card.id === id))
        .filter((card): card is NonNullable<typeof card> => Boolean(card))
        .map((card) => ({ id: card.id, name: card.name, hint: card.hint }));
    }
  }

  const teamViews: SayLessTeamView[] = teams.map((team) => ({
    id: team.id,
    label: team.label,
    name: teamName(team.label),
    members: team.member_ids.map((id) => ({
      id,
      displayName: names[id] ?? "Player",
    })),
    isYours: team.member_ids.includes(participantId),
  }));

  const round1 = row.phase === "lobby" || row.phase === "teams" || row.phase === "preview" || row.phase === "ready"
    ? null
    : roundTally(turns, events, 1);
  const round2 =
    row.round === 2 || row.phase === "final_scores" ? roundTally(turns, events, 2) : null;
  const thisRound = row.round === 1 ? round1 : round2;

  const teamA = teams.find((team) => team.label === "A");
  const teamB = teams.find((team) => team.label === "B");
  const showScores = row.phase === "round_break" || row.phase === "final_scores";
  const tally =
    showScores && teamA && teamB
      ? teamScores(
          turns,
          events,
          { A: teamA.id, B: teamB.id },
          row.phase === "round_break" ? 1 : undefined
        )
      : null;
  const scores = tally
    ? (["A", "B"] as const).map((label) => ({
        label,
        name: teamName(label),
        score: tally[label],
      }))
    : null;
  const leader = tally && row.phase === "final_scores" ? winnerLabel(tally) : null;
  const winner = tally && row.phase === "final_scores" ? leader ?? "tie" : null;

  const guesserNames =
    row.phase === "turn" && liveTurn && liveTeam
      ? liveTeam.member_ids
          .filter((id) => id !== liveTurn.clue_giver_id)
          .map((id) => names[id] ?? "Player")
      : [];

  const faster =
    round1?.cardsPerTurn != null &&
    round2?.cardsPerTurn != null &&
    round2.cardsPerTurn > round1.cardsPerTurn;
  const hostLine =
    row.phase === "final_scores" && isLead
      ? faster
        ? "Round 2 was faster because you built a shared language in six minutes. Now let's talk about the one you've built over years."
        : "One word was harder than it felt, because the shorthand was in your head and not theirs."
      : row.phase === "round_break" && isLead
        ? "Same cards. Now you get one word. Use what you just heard, from either team."
        : null;

  const cardsGotThisTurn =
    row.phase === "turn" && liveTurn
      ? events.filter((event) => event.turn_id === liveTurn.id && event.outcome === "got_it").length
      : row.phase === "hold"
        ? row.last_turn_got_it
        : null;

  const startedAt =
    row.phase === "turn" && liveTurn?.started_at
      ? liveTurn.started_at
      : row.phase === "preview" && row.phase_deadline
        ? new Date(new Date(row.phase_deadline).getTime() - SAY_LESS_PREVIEW_SECONDS * 1000).toISOString()
        : row.phase === "hold" && row.hold_started_at
          ? row.hold_started_at
          : null;

  return {
    phase: row.phase,
    round: row.round,
    isLead,
    participantId,
    viewerRole,
    instruction: playInstruction(row.round),
    roleLine: viewerRole ? roleLine(viewerRole, row.round) : null,
    progress: sessionProgress({
      round1GotIt: round1?.gotIt ?? 0,
      round2GotIt: round2?.gotIt ?? 0,
      round1EndedEarly: row.round_1_ended_early,
      round2EndedEarly: row.round_2_ended_early,
      phase: row.phase,
    }),
    categories: [row.category_a, row.category_b].map((id) => ({
      id,
      label: SAY_LESS_CATEGORY_LABELS[id],
    })),
    teams: teamViews,
    cardsLeft: row.phase === "lobby" || row.phase === "teams" ? 20 : row.pile_card_ids.length,
    cardsGotThisTurn,
    clueGiverName: liveTurn ? names[liveTurn.clue_giver_id] ?? "Player" : null,
    guesserNames,
    nextClueGiverName: nextGiverName(row, teams, names, connected),
    currentCard,
    previewCards,
    deadlineAt: row.phase_deadline,
    startedAt,
    paused: row.paused,
    lastEndReason: row.last_turn_end_reason,
    turnsThisRound: thisRound?.turns ?? 0,
    scores,
    winner,
    hostLine,
    canSkipTurn: Boolean(
      row.phase === "turn" && liveTurn && (isLead || liveTurn.clue_giver_id === participantId)
    ),
    canActOnCard: viewerRole === "clue" && row.phase === "turn" && Boolean(currentCard),
  };
}
