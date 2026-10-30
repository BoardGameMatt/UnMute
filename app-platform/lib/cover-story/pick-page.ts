import "server-only";
import { APP_ORIGIN_DISPLAY } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoverStoryAgency, CoverStoryDeal } from "@/lib/types/database";
import { ensureDealPickToken } from "./pick-token";
import { formatRevealDate } from "./format";
import { loadMembers } from "./session";

export type CoverStoryPickCard = {
  agencyId: number;
  name: string;
  words: string[];
};

export type CoverStoryPickPageData = {
  displayName: string;
  revealOn: string | null;
  revealLabel: string;
  locked: boolean;
  lockedAgencyName: string | null;
  cards: CoverStoryPickCard[] | null;
  sessionPhase: string;
};

export function buildPickUrl(appOrigin: string | undefined, token: string): string {
  const origin = (appOrigin ?? APP_ORIGIN_DISPLAY).replace(/\/+$/, "");
  return `${origin}/cover-story/pick/${token}`;
}

async function loadWordsForAgency(
  admin: SupabaseClient,
  agencyId: number
): Promise<string[]> {
  const { data, error } = await admin
    .from("cover_story_agency_words")
    .select("phrase")
    .eq("agency_id", agencyId)
    .order("ordinal", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.phrase as string);
}

async function loadPickCards(
  admin: SupabaseClient,
  deal: CoverStoryDeal
): Promise<CoverStoryPickCard[]> {
  const cards: CoverStoryPickCard[] = [];
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
      words,
    });
  }
  return cards;
}

export async function loadPickPageByToken(
  admin: SupabaseClient,
  token: string
): Promise<CoverStoryPickPageData | null> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 32) return null;

  const { data: dealRaw, error } = await admin
    .from("cover_story_deals")
    .select("*")
    .eq("pick_token", trimmed)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const deal = dealRaw as CoverStoryDeal | null;
  if (!deal) return null;

  const { data: csRaw, error: csErr } = await admin
    .from("cover_story_sessions")
    .select("phase, reveal_on, session_id")
    .eq("id", deal.cover_story_session_id)
    .maybeSingle();
  if (csErr) throw new Error(csErr.message);
  const cs = csRaw as { phase: string; reveal_on: string | null; session_id: string } | null;
  if (!cs) return null;

  const members = await loadMembers(admin, cs.session_id);
  const member = members.find((m) => m.participantId === deal.participant_id);
  const displayName = member?.displayName ?? "Agent";

  if (deal.locked_agency_id) {
    const { data: agency } = await admin
      .from("cover_story_agencies")
      .select("official_name")
      .eq("id", deal.locked_agency_id)
      .maybeSingle();
    return {
      displayName,
      revealOn: cs.reveal_on,
      revealLabel: formatRevealDate(cs.reveal_on),
      locked: true,
      lockedAgencyName:
        (agency as { official_name?: string } | null)?.official_name ?? "Agency",
      cards: null,
      sessionPhase: cs.phase,
    };
  }

  const withToken = await ensureDealPickToken(admin, deal);
  if (withToken !== deal.pick_token) {
    deal.pick_token = withToken;
  }

  return {
    displayName,
    revealOn: cs.reveal_on,
    revealLabel: formatRevealDate(cs.reveal_on),
    locked: false,
    lockedAgencyName: null,
    cards: await loadPickCards(admin, deal),
    sessionPhase: cs.phase,
  };
}

export async function resolveDealByPickToken(
  admin: SupabaseClient,
  token: string
): Promise<{ deal: CoverStoryDeal; sessionId: string } | null> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 32) return null;

  const { data: dealRaw, error } = await admin
    .from("cover_story_deals")
    .select("*")
    .eq("pick_token", trimmed)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const deal = dealRaw as CoverStoryDeal | null;
  if (!deal) return null;

  const { data: csRaw, error: csErr } = await admin
    .from("cover_story_sessions")
    .select("session_id")
    .eq("id", deal.cover_story_session_id)
    .maybeSingle();
  if (csErr) throw new Error(csErr.message);
  const sessionId = (csRaw as { session_id?: string } | null)?.session_id;
  if (!sessionId) return null;

  return { deal, sessionId };
}
