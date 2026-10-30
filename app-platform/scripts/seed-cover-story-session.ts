/**
 * Create a Cover Story lobby session (COVER1) without wiping other demo data.
 * Run from app-platform: npx tsx scripts/seed-cover-story-session.ts
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const SESSION_JOIN_CODE = "COVER1";
const TEAM_JOIN_CODE = "CSTORY";

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: protocol, error: protocolErr } = await supabase
    .from("protocols")
    .select("id")
    .eq("slug", "cover-story")
    .single();

  if (protocolErr || !protocol) {
    console.error("cover-story protocol missing:", protocolErr?.message);
    process.exit(1);
  }

  const { data: existingSession, error: existingErr } = await supabase
    .from("sessions")
    .select("id, join_code, host_token")
    .eq("join_code", SESSION_JOIN_CODE)
    .maybeSingle();

  if (existingErr) {
    console.error("session lookup:", existingErr.message);
    process.exit(1);
  }

  if (existingSession) {
    const { data: cs } = await supabase
      .from("cover_story_sessions")
      .select("id")
      .eq("session_id", existingSession.id)
      .maybeSingle();
    if (cs) {
      await supabase.from("cover_story_guesses").delete().eq("cover_story_session_id", cs.id);
      await supabase.from("cover_story_target_results").delete().eq("cover_story_session_id", cs.id);
      await supabase.from("cover_story_deals").delete().eq("cover_story_session_id", cs.id);
      await supabase
        .from("cover_story_sessions")
        .update({
          phase: "lobby",
          reveal_on: null,
          reveal_index: 0,
          reveal_order: [],
          reveal_subphase: "guess",
          guess_started_at: null,
        })
        .eq("id", cs.id);
    }

    const { data: roster } = await supabase
      .from("session_participants")
      .select("participant_id, role_in_session")
      .eq("session_id", existingSession.id);
    const memberIds = (roster ?? [])
      .filter((row) => row.role_in_session !== "lead")
      .map((row) => row.participant_id as string);

    await supabase
      .from("session_participants")
      .delete()
      .eq("session_id", existingSession.id)
      .neq("role_in_session", "lead");

    if (memberIds.length > 0) {
      await supabase
        .from("participants")
        .delete()
        .in("id", memberIds)
        .is("person_id", null);
    }

    await supabase
      .from("sessions")
      .update({ status: "lobby", started_at: null, completed_at: null })
      .eq("id", existingSession.id);
    await supabase
      .from("session_state")
      .update({ state_json: {}, phase: "waiting", current_round: 0 })
      .eq("session_id", existingSession.id);

    console.log("COVER1 purged and reset to lobby.");
    console.log("  join_code:", existingSession.join_code);
    console.log("  session_id:", existingSession.id);
    console.log(
      "  host URL:",
      `http://localhost:3000/host/${existingSession.host_token}`
    );
    console.log("  join URL:", `http://localhost:3000/join/${SESSION_JOIN_CODE}`);
    return;
  }

  let teamId: string | null = null;
  const { data: demoTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("join_code", "DEMOTM")
    .maybeSingle();
  if (demoTeam) {
    teamId = demoTeam.id;
  } else {
    const { data: coverTeam, error: teamErr } = await supabase
      .from("teams")
      .upsert(
        {
          name: "Cover Story Playtest",
          join_code: TEAM_JOIN_CODE,
          require_auth: false,
        },
        { onConflict: "join_code" }
      )
      .select("id")
      .single();
    if (teamErr || !coverTeam) {
      console.error("teams upsert:", teamErr?.message);
      process.exit(1);
    }
    teamId = coverTeam.id;
  }

  const hostToken = randomBytes(32).toString("hex");
  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .insert({
      protocol_id: protocol.id,
      protocol_slot_id: null,
      team_id: teamId,
      status: "lobby",
      join_code: SESSION_JOIN_CODE,
      host_token: hostToken,
    })
    .select("id, join_code, host_token")
    .single();

  if (sessionErr || !sessionRow) {
    console.error("sessions insert:", sessionErr?.message);
    process.exit(1);
  }

  const { error: stateErr } = await supabase.from("session_state").insert({
    session_id: sessionRow.id,
    current_round: 0,
    phase: "waiting",
    state_json: {},
  });
  if (stateErr) {
    console.error("session_state insert:", stateErr.message);
    process.exit(1);
  }

  const { error: csErr } = await supabase.from("cover_story_sessions").insert({
    session_id: sessionRow.id,
    phase: "lobby",
  });
  if (csErr) {
    console.error("cover_story_sessions insert:", csErr.message);
    process.exit(1);
  }

  console.log("Cover Story session ready.");
  console.log("  join_code:", sessionRow.join_code);
  console.log("  session_id:", sessionRow.id);
  console.log("  host URL:", `http://localhost:3000/host/${sessionRow.host_token}`);
  console.log("  join URL:", `http://localhost:3000/join/${SESSION_JOIN_CODE}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
