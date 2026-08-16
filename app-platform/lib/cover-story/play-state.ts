import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoverStoryAgency,
  CoverStoryAgencyWord,
  CoverStoryDeal,
  CoverStoryGuess,
  CoverStorySession,
  CoverStoryTargetResult,
  CoverStoryWordLog,
} from "@/lib/types/database";
import { COVER_STORY_GUESS_SECONDS, type CoverStoryPlayState } from "./types";
import { missionCopyPaste, loadDeals, loadMembers } from "./session";
import { missionScore, type1Score, type2Score } from "./score";

export async function buildPlayState(input: {
  admin: SupabaseClient;
  sessionId: string;
  participantId: string;
  isLead: boolean;
  cs: CoverStorySession;
}): Promise<CoverStoryPlayState> {
  const { admin, sessionId, participantId, isLead, cs } = input;
  const members = await loadMembers(admin, sessionId);
  const deals = await loadDeals(admin, cs.id);
  const burned = new Set<number>();
  for (const deal of deals) {
    for (const id of deal.shown_agency_ids) burned.add(id);
  }

  const { data: agencyRows } = await admin
    .from("cover_story_agencies")
    .select("id")
    .eq("playable", true)
    .eq("active", true);
  const remainingUnshown = Math.max(0, (agencyRows ?? []).length - burned.size);

  const { data: stateRow } = await admin
    .from("session_state")
    .select("state_json")
    .eq("session_id", sessionId)
    .maybeSingle();
  const publicState = (stateRow?.state_json as { coverStory?: {
    readers?: Record<string, { screenIndex: number; done: boolean }>;
    playbackIndex?: number;
    insightsOn?: boolean;
  } } | null)?.coverStory;
  const readers = publicState?.readers ?? {};
  const myReader = readers[participantId] ?? { screenIndex: 0, done: false };

  const myDeal = deals.find((d) => d.participant_id === participantId) ?? null;
  const dealView = await buildDealView(admin, cs, myDeal);
  const fieldView = await buildFieldView(admin, members, myDeal, participantId);

  const leadField = isLead
    ? await Promise.all(
        members.map(async (player) => {
          const deal = deals.find((d) => d.participant_id === player.participantId);
          const plantedCount = deal ? await countPlanted(admin, deal.id) : 0;
          const submitted = deal ? await isMissionSubmitted(admin, deal.id) : false;
          return {
            id: player.participantId,
            displayName: player.displayName,
            locked: Boolean(deal?.locked_agency_id),
            plantedCount,
            missionSubmitted: submitted,
          };
        })
      )
    : [];

  return {
    phase: cs.phase,
    revealOn: cs.reveal_on,
    isLead,
    participantId,
    members: members.map((m) => ({
      id: m.participantId,
      displayName: m.displayName,
      isLead: m.isLead,
    })),
    remainingUnshown,
    reading: {
      screenIndex: myReader.screenIndex,
      done: myReader.done,
      others: members
        .filter((p) => p.participantId !== participantId)
        .map((p) => ({
          id: p.participantId,
          displayName: p.displayName,
          screenIndex: readers[p.participantId]?.screenIndex ?? 0,
          done: readers[p.participantId]?.done ?? false,
        })),
      playbackIndex: publicState?.playbackIndex ?? 0,
      insightsOn: publicState?.insightsOn ?? cs.phase === "insights",
      independent: cs.phase === "reading",
      allDone: members.length > 0 && members.every((p) => readers[p.participantId]?.done),
    },
    deal: dealView,
    field: fieldView,
    leadField,
    reveal: await buildRevealView(admin, cs, members, deals, participantId, isLead),
  };
}

async function countPlanted(admin: SupabaseClient, dealId: string): Promise<number> {
  const { data } = await admin
    .from("cover_story_word_logs")
    .select("status")
    .eq("deal_id", dealId);
  return (data ?? []).filter((row) => row.status === "planted").length;
}

async function isMissionSubmitted(admin: SupabaseClient, dealId: string): Promise<boolean> {
  const { data } = await admin
    .from("cover_story_word_logs")
    .select("status")
    .eq("deal_id", dealId);
  const rows = data ?? [];
  return rows.length === 5 && rows.every((row) => row.status !== "open");
}

async function loadWordsForAgency(
  admin: SupabaseClient,
  agencyId: number
): Promise<CoverStoryAgencyWord[]> {
  const { data, error } = await admin
    .from("cover_story_agency_words")
    .select("*")
    .eq("agency_id", agencyId)
    .order("ordinal", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoverStoryAgencyWord[];
}

async function buildDealView(
  admin: SupabaseClient,
  cs: CoverStorySession,
  deal: CoverStoryDeal | null
): Promise<CoverStoryPlayState["deal"]> {
  if (!deal) {
    return {
      cards: null,
      locked: false,
      lockedAgencyName: null,
      words: [],
      copyPaste: "",
    };
  }

  if (!deal.locked_agency_id) {
    const cards: { agencyId: number; name: string; words: string[] }[] = [];
    for (const agencyId of deal.shown_agency_ids) {
      const { data: agency } = await admin
        .from("cover_story_agencies")
        .select("id, official_name")
        .eq("id", agencyId)
        .maybeSingle();
      const words = await loadWordsForAgency(admin, agencyId);
      cards.push({
        agencyId,
        name: (agency as CoverStoryAgency | null)?.official_name ?? "Agency",
        words: words.map((w) => w.phrase),
      });
    }
    return {
      cards,
      locked: false,
      lockedAgencyName: null,
      words: [],
      copyPaste: "",
    };
  }

  const { data: agency } = await admin
    .from("cover_story_agencies")
    .select("id, official_name")
    .eq("id", deal.locked_agency_id)
    .maybeSingle();
  const words = await loadWordsForAgency(admin, deal.locked_agency_id);
  const logs = await loadLogs(admin, deal.id);
  const logByWord = new Map(logs.map((log) => [log.word_id, log]));
  const wordViews = words.map((word) => {
    const log = logByWord.get(word.id);
    return {
      wordId: word.id,
      phrase: word.phrase,
      difficulty: word.difficulty,
      status: log?.status ?? "open",
      plantedOn: log?.planted_on ?? null,
      witnessIds: log?.witness_ids ?? [],
      note: log?.note ?? "",
    };
  });
  const name = (agency as CoverStoryAgency | null)?.official_name ?? "Agency";
  return {
    cards: null,
    locked: true,
    lockedAgencyName: name,
    words: wordViews,
    copyPaste: missionCopyPaste({
      agencyName: name,
      revealOn: cs.reveal_on,
      words: words.map((w) => w.phrase),
    }),
  };
}

async function loadLogs(
  admin: SupabaseClient,
  dealId: string
): Promise<CoverStoryWordLog[]> {
  const { data, error } = await admin
    .from("cover_story_word_logs")
    .select("*")
    .eq("deal_id", dealId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CoverStoryWordLog[];
}

async function buildFieldView(
  admin: SupabaseClient,
  members: { participantId: string; displayName: string; isLead: boolean }[],
  deal: CoverStoryDeal | null,
  participantId: string
): Promise<CoverStoryPlayState["field"]> {
  if (!deal?.locked_agency_id) return null;
  const words = await loadWordsForAgency(admin, deal.locked_agency_id);
  const logs = await loadLogs(admin, deal.id);
  const logByWord = new Map(logs.map((log) => [log.word_id, log]));
  const wordViews = words.map((word) => {
    const log = logByWord.get(word.id);
    return {
      wordId: word.id,
      phrase: word.phrase,
      difficulty: word.difficulty,
      status: log?.status ?? "open",
      plantedOn: log?.planted_on ?? null,
      witnessIds: log?.witness_ids ?? [],
      note: log?.note ?? "",
    };
  });
  return {
    plantedCount: wordViews.filter((w) => w.status === "planted").length,
    words: wordViews,
    witnesses: members
      .filter((m) => m.participantId !== participantId)
      .map((m) => ({
        id: m.participantId,
        displayName: m.displayName,
        isLead: m.isLead,
      })),
  };
}

async function buildRevealView(
  admin: SupabaseClient,
  cs: CoverStorySession,
  members: { participantId: string; displayName: string; isLead: boolean }[],
  deals: CoverStoryDeal[],
  participantId: string,
  isLead: boolean
): Promise<CoverStoryPlayState["reveal"]> {
  if (cs.phase !== "reveal" && cs.phase !== "complete") return null;

  const nameOf = (id: string) =>
    members.find((m) => m.participantId === id)?.displayName ?? "Player";
  const targetId = cs.reveal_order[cs.reveal_index] ?? null;
  const target = targetId
    ? {
        id: targetId,
        displayName: nameOf(targetId),
        isLead: members.find((m) => m.participantId === targetId)?.isLead ?? false,
      }
    : null;

  const { data: guessesRaw } = await admin
    .from("cover_story_guesses")
    .select("*")
    .eq("cover_story_session_id", cs.id)
    .eq("target_participant_id", targetId ?? "");
  const guesses = (guessesRaw ?? []) as CoverStoryGuess[];
  const guesserCount = target
    ? members.filter((p) => p.participantId !== target.id).length
    : 0;
  const mine = guesses.find((g) => g.guesser_participant_id === participantId) ?? null;

  const showSecrets =
    cs.reveal_subphase === "board" ||
    cs.reveal_subphase === "points" ||
    cs.reveal_subphase === "final" ||
    cs.phase === "complete";

  let board: {
    agencyName: string;
    words: {
      phrase: string;
      planted: boolean;
      plantedOn: string | null;
      note: string;
      witnessNames: string[];
    }[];
  } | null = null;
  if (showSecrets && target) {
    const deal = deals.find((d) => d.participant_id === target.id);
    if (deal?.locked_agency_id) {
      const { data: agency } = await admin
        .from("cover_story_agencies")
        .select("official_name")
        .eq("id", deal.locked_agency_id)
        .maybeSingle();
      const words = await loadWordsForAgency(admin, deal.locked_agency_id);
      const logs = await loadLogs(admin, deal.id);
      const logByWord = new Map(logs.map((log) => [log.word_id, log]));
      board = {
        agencyName: (agency as { official_name?: string } | null)?.official_name ?? "Agency",
        words: words.map((w) => {
          const log = logByWord.get(w.id);
          return {
            phrase: w.phrase,
            planted: log?.status === "planted",
            plantedOn: log?.planted_on ?? null,
            note: log?.note ?? "",
            witnessNames: (log?.witness_ids ?? []).map((id) => nameOf(id)),
          };
        }),
      };
    }
  }

  let points: {
    agentName: string;
    type1: number;
    mission: number;
    guessers: { name: string; delta: number }[];
  } | null = null;
  if ((cs.reveal_subphase === "points" || cs.reveal_subphase === "final" || cs.phase === "complete") && target) {
    const { data: resultRaw } = await admin
      .from("cover_story_target_results")
      .select("*")
      .eq("cover_story_session_id", cs.id)
      .eq("target_participant_id", target.id)
      .maybeSingle();
    const result = resultRaw as CoverStoryTargetResult | null;
    if (result) {
      points = {
        agentName: target.displayName,
        type1: result.type1_score,
        mission: result.mission_score,
        guessers: guesses
          .filter((g) => g.marked_correct)
          .map((g) => ({
            name: nameOf(g.guesser_participant_id),
            delta: type2Score(result.k, result.n),
          })),
      };
    }
  }

  const { data: allResultsRaw } = await admin
    .from("cover_story_target_results")
    .select("*")
    .eq("cover_story_session_id", cs.id);
  const allResults = (allResultsRaw ?? []) as CoverStoryTargetResult[];
  const { data: allGuessesRaw } = await admin
    .from("cover_story_guesses")
    .select("*")
    .eq("cover_story_session_id", cs.id);
  const allGuesses = (allGuessesRaw ?? []) as CoverStoryGuess[];

  const final =
    cs.reveal_subphase === "final" || cs.phase === "complete"
      ? members.map((player) => {
          const result = allResults.find((r) => r.target_participant_id === player.participantId);
          const type1 = result?.type1_score ?? 0;
          const mission = result?.mission_score ?? 0;
          let type2 = 0;
          for (const guess of allGuesses) {
            if (guess.guesser_participant_id !== player.participantId) continue;
            if (!guess.marked_correct) continue;
            const targetResult = allResults.find(
              (r) => r.target_participant_id === guess.target_participant_id
            );
            if (targetResult) type2 += type2Score(targetResult.k, targetResult.n);
          }
          return {
            id: player.participantId,
            name: player.displayName,
            type1,
            type2,
            mission,
            total: type1 + type2 + mission,
          };
        })
      : [];

  const myDeal = deals.find((d) => d.participant_id === participantId) ?? null;
  const myMissionSubmitted = myDeal ? await isMissionSubmitted(admin, myDeal.id) : false;
  const missionRoster = await Promise.all(
    members
      .filter((member) =>
        deals.some((d) => d.participant_id === member.participantId && d.locked_agency_id)
      )
      .map(async (member) => {
        const deal = deals.find((d) => d.participant_id === member.participantId);
        return {
          id: member.participantId,
          displayName: member.displayName,
          submitted: deal ? await isMissionSubmitted(admin, deal.id) : false,
        };
      })
  );

  return {
    subphase: cs.reveal_subphase,
    target,
    guessStartedAt: cs.guess_started_at,
    guessDurationSeconds: cs.guess_duration_seconds || COVER_STORY_GUESS_SECONDS,
    myGuess: target && target.id !== participantId
      ? {
          agencyText: mine?.agency_text ?? "",
          evidenceText: mine?.evidence_text ?? "",
          submitted: Boolean(mine),
        }
      : null,
    submittedCount: guesses.length,
    guesserCount,
    guessRoster: target
      ? members
          .filter((member) => member.participantId !== target.id)
          .map((member) => ({
            id: member.participantId,
            displayName: member.displayName,
            submitted: guesses.some((guess) => guess.guesser_participant_id === member.participantId),
          }))
      : [],
    missionSubmitted: myMissionSubmitted,
    missionRoster,
    gallery:
      cs.reveal_subphase === "gallery" ||
      cs.reveal_subphase === "mark" ||
      showSecrets
        ? guesses.map((g) => ({
            agencyText: g.agency_text,
            evidenceText: g.evidence_text,
          }))
        : [],
    marks: isLead
      ? guesses.map((g) => ({
          guessId: g.id,
          agencyText: g.agency_text,
          evidenceText: g.evidence_text,
          guesserName: nameOf(g.guesser_participant_id),
          suggestedCorrect: g.suggested_correct,
          markedCorrect: g.marked_correct,
        }))
      : [],
    board,
    points,
    final,
  };
}
