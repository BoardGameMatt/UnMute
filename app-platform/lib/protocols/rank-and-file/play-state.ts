import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expireIfNeeded } from "./actions";
import {
  PERSISTENT_RANK,
  PERSISTENT_WRITE,
  PHONE_RANK_COPY,
  RANK_CLOCK_COPY,
  RANK_SECONDS,
  SPECTATOR_WRITE,
  WRITE_DISPLAY_SECONDS,
  canWrap,
  emptySlots,
  isSharedScreenName,
  mayExposeNamedTiles,
  maySeeDealtNumber,
  percentInOrder,
  progressRatio,
  seededRandom,
  shuffleCopy,
  teamRowShowsNumbers,
} from "./engine";
import {
  connectedIds,
  displayNameMap,
  loadDeals,
  loadPackSubjects,
  loadRankAndFileSession,
  loadRound,
  loadRounds,
  loadRoster,
  loadSubject,
  resolvePackId,
} from "./store";
import type {
  RankAndFilePhase,
  RankAndFilePlayState,
  RankTile,
  RosterChip,
  ViewerRole,
} from "./types";

function instructionFor(
  phase: RankAndFilePhase,
  role: ViewerRole,
  isLead: boolean,
  isClueGiver: boolean
): { instruction: string; persistent: string } {
  if (phase === "write") {
    if (role === "display" || isClueGiver) {
      return { instruction: PERSISTENT_WRITE, persistent: PERSISTENT_WRITE };
    }
    return { instruction: SPECTATOR_WRITE, persistent: PERSISTENT_WRITE };
  }
  if (phase === "rank") {
    if (isLead) {
      return { instruction: RANK_CLOCK_COPY, persistent: PERSISTENT_RANK };
    }
    return { instruction: PHONE_RANK_COPY, persistent: PERSISTENT_RANK };
  }
  return { instruction: PERSISTENT_WRITE, persistent: PERSISTENT_WRITE };
}

function toTile(
  deal: { id: string; clue_text: string | null; participant_id: string; dealt_number: number },
  names: Record<string, string>,
  showNumber: boolean
): RankTile {
  return {
    dealId: deal.id,
    clueText: deal.clue_text ?? "",
    displayName: names[deal.participant_id] ?? "Player",
    dealtNumber: showNumber ? deal.dealt_number : null,
  };
}

export async function buildRankAndFilePlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  isDisplay: boolean;
  skipMaintenance?: boolean;
}): Promise<RankAndFilePlayState> {
  const { admin, sessionId, participantId, isLead, isDisplay, skipMaintenance } = input;

  if (!skipMaintenance) {
    await expireIfNeeded(admin, sessionId);
  }

  const rf = await loadRankAndFileSession(admin, sessionId);
  const roster = await loadRoster(admin, sessionId);
  const names = displayNameMap(roster);
  const rounds = await loadRounds(admin, sessionId);
  const round = rf?.current_round_id ? await loadRound(admin, rf.current_round_id) : null;
  const subject = round ? await loadSubject(admin, round.subject_id) : null;
  const deals = round ? await loadDeals(admin, round.id) : [];

  let viewerRole: ViewerRole = "spectator";
  if (isDisplay) viewerRole = "display";
  else if (deals.some((deal) => deal.participant_id === participantId)) viewerRole = "clueGiver";

  const phase = rf?.phase ?? "lobby";
  const myDeal = deals.find((deal) => deal.participant_id === participantId) ?? null;
  const secretOk = maySeeDealtNumber({
    phase,
    isDisplay,
    isClueGiver: Boolean(myDeal),
  });
  const dealtNumber = secretOk && myDeal ? myDeal.dealt_number : null;

  const locked = deals.filter((deal) => deal.locked_at && deal.clue_text);
  const lockedSet = new Set(deals.filter((deal) => deal.locked_at).map((deal) => deal.participant_id));
  const giverIds = new Set(deals.map((deal) => deal.participant_id));
  const present = connectedIds(roster);
  const liveGivers = deals
    .map((deal) => deal.participant_id)
    .filter((id) => present.length === 0 || present.includes(id));

  const exposeTiles = mayExposeNamedTiles(phase);
  const annotateTeam = teamRowShowsNumbers(phase, round?.is_hit ?? null);
  const slotCount = locked.length;
  const rawSlots = exposeTiles ? round?.rail_order_json ?? [] : [];
  const slots: (string | null)[] =
    rawSlots.length === slotCount
      ? rawSlots
      : slotCount > 0
        ? emptySlots(slotCount)
        : [];
  const placedIds = new Set(slots.filter((id): id is string => Boolean(id)));
  const trayDeals = exposeTiles
    ? shuffleCopy(
        locked.filter((deal) => !placedIds.has(deal.id)),
        round ? seededRandom(round.id) : Math.random
      )
    : [];
  const rail: (RankTile | null)[] = exposeTiles
    ? slots.map((id) => {
        if (!id) return null;
        const deal = locked.find((row) => row.id === id);
        return deal ? toTile(deal, names, annotateTeam) : null;
      })
    : [];
  const tray = trayDeals.map((deal) => toTile(deal, names, annotateTeam));

  let truthRow: RankTile[] | null = null;
  if (
    exposeTiles &&
    (phase === "reveal" || phase === "scoreboard") &&
    round?.is_hit === false &&
    locked.length > 0
  ) {
    const sorted = [...locked].sort((a, b) => a.dealt_number - b.dealt_number);
    truthRow = sorted.map((deal) => toTile(deal, names, true));
  }

  const copy = instructionFor(phase, viewerRole, isLead, Boolean(myDeal));

  const packId = await resolvePackId(admin, sessionId).catch(() => null);
  const packSubjects = packId ? await loadPackSubjects(admin, packId) : [];
  const used = new Set(
    rounds.filter((row) => row.end_reason !== "abandoned").map((row) => row.subject_id)
  );
  const remainingSubjects = packSubjects.filter((row) => !used.has(row.id)).length;
  const wrapOk = canWrap(rf?.round_index ?? 0, remainingSubjects);
  const zeroTiles = round?.end_reason === "zero_tiles";

  const rosterChips: RosterChip[] = roster
    .filter((row) => !isSharedScreenName(row.displayName))
    .map((row) => ({
      participantId: row.participantId,
      displayName: row.displayName,
      locked: lockedSet.has(row.participantId),
      isClueGiver: giverIds.has(row.participantId),
    }));

  const canRank = Boolean(isLead && phase === "rank");
  const canCommit = Boolean(
    canRank && slotCount > 0 && slots.every((id) => typeof id === "string")
  );

  return {
    phase: rf?.phase ?? "lobby",
    isLead,
    isDisplay,
    participantId,
    viewerRole,
    instruction: copy.instruction,
    persistentInstruction: copy.persistent,
    progress: progressRatio(rf?.committed_rounds ?? 0),
    roundIndex: round?.round_index ?? rf?.round_index ?? 0,
    hits: rf?.hits ?? 0,
    committedRounds: rf?.committed_rounds ?? 0,
    percentInOrder: percentInOrder(rf?.hits ?? 0, rf?.committed_rounds ?? 0),
    lockedCount: lockedSet.size,
    clueGiverCount: liveGivers.length || deals.length,
    roster: rosterChips,
    writeStartedAt: rf?.phase === "write" ? round?.write_started_at ?? null : null,
    rankStartedAt: rf?.phase === "rank" ? round?.rank_started_at ?? null : null,
    timerSeconds:
      rf?.phase === "write"
        ? WRITE_DISPLAY_SECONDS
        : rf?.phase === "rank"
          ? RANK_SECONDS
          : null,
    remainingSubjects,
    canRank,
    canCommit,
    canNextRound: Boolean(
      isLead && phase === "reveal" && (rf?.round_index ?? 0) < 5 && remainingSubjects > 0
    ),
    canAnotherRound: Boolean(
      isLead && phase === "reveal" && (rf?.round_index ?? 0) >= 5 && remainingSubjects > 0
    ),
    canWrap: Boolean(isLead && phase === "reveal" && wrapOk),
    canAdvanceRecap: Boolean(isLead && phase === "scoreboard"),
    myClueLocked: Boolean(myDeal?.locked_at),
    clueError: null,
    dealtNumber,
    theme: subject?.theme ?? null,
    lowEnd: subject?.low_end ?? null,
    highEnd: subject?.high_end ?? null,
    tray,
    rail,
    truthRow,
    isHit: round?.is_hit ?? null,
    zeroTiles,
  };
}
