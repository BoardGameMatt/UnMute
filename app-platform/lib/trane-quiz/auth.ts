import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TraneOffering,
  TraneParticipant,
} from "@/lib/types/database";
import { createServiceClient } from "@/lib/supabase/admin";

export type HostAuthOk = {
  ok: true;
  admin: SupabaseClient;
  offering: TraneOffering;
};

export type HostAuthErr = { ok: false; status: number; error: string };

export async function requireHostOffering(
  hostToken: string
): Promise<HostAuthOk | HostAuthErr> {
  const token = hostToken.trim();
  if (!token || token.length < 32) {
    return { ok: false, status: 400, error: "Invalid host token" };
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("trane_offerings")
    .select("*")
    .eq("host_token", token)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "Could not load offering" };
  }
  if (!data) {
    return { ok: false, status: 404, error: "Offering not found" };
  }

  return { ok: true, admin, offering: data as TraneOffering };
}

export type ParticipantAuthOk = {
  ok: true;
  admin: SupabaseClient;
  offering: TraneOffering;
  participant: TraneParticipant;
};

export async function requireParticipant(
  offeringId: string,
  participantId: string | undefined | null
): Promise<ParticipantAuthOk | HostAuthErr> {
  if (!participantId) {
    return { ok: false, status: 401, error: "Not joined" };
  }

  const admin = createServiceClient();
  const { data: offering, error: oErr } = await admin
    .from("trane_offerings")
    .select("*")
    .eq("id", offeringId)
    .maybeSingle();

  if (oErr) {
    return { ok: false, status: 500, error: "Could not load offering" };
  }
  if (!offering) {
    return { ok: false, status: 404, error: "Offering not found" };
  }

  const { data: participant, error: pErr } = await admin
    .from("trane_participants")
    .select("*")
    .eq("id", participantId)
    .eq("offering_id", offeringId)
    .maybeSingle();

  if (pErr) {
    return { ok: false, status: 500, error: "Could not load participant" };
  }
  if (!participant) {
    return { ok: false, status: 401, error: "Not joined to this offering" };
  }

  return {
    ok: true,
    admin,
    offering: offering as TraneOffering,
    participant: participant as TraneParticipant,
  };
}
