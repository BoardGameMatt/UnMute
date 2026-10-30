/**
 * One-off: mint a Cover Story lobby session and print host/join URLs.
 * Uses .env.local (service role). Does not wipe COVER1.
 *
 * npx tsx scripts/mint-cover-story-session.ts
 */

import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { APP_ORIGIN_DISPLAY } from "../lib/constants";

config({ path: resolve(process.cwd(), ".env.local") });

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: protocol, error: pErr } = await supabase
    .from("protocols")
    .select("id")
    .eq("slug", "cover-story")
    .single();
  if (pErr || !protocol) {
    console.error("cover-story protocol missing:", pErr?.message);
    process.exit(1);
  }

  let teamId: string;
  const { data: demoTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("join_code", "DEMOTM")
    .maybeSingle();
  if (demoTeam) {
    teamId = demoTeam.id;
  } else {
    const { data: team, error: tErr } = await supabase
      .from("teams")
      .upsert(
        {
          name: "Cover Story Playtest",
          join_code: "CSTORY",
          require_auth: false,
        },
        { onConflict: "join_code" }
      )
      .select("id")
      .single();
    if (tErr || !team) {
      console.error("team:", tErr?.message);
      process.exit(1);
    }
    teamId = team.id;
  }

  const { data: joinCode, error: cErr } = await supabase.rpc("generate_join_code");
  if (cErr || !joinCode) {
    console.error("join code:", cErr?.message);
    process.exit(1);
  }

  const hostToken = randomBytes(32).toString("hex");
  const { data: sessionRow, error: sErr } = await supabase
    .from("sessions")
    .insert({
      protocol_id: protocol.id,
      protocol_slot_id: null,
      team_id: teamId,
      status: "lobby",
      join_code: joinCode as string,
      host_token: hostToken,
    })
    .select("id, join_code, host_token")
    .single();
  if (sErr || !sessionRow) {
    console.error("session:", sErr?.message);
    process.exit(1);
  }

  const { error: stErr } = await supabase.from("session_state").insert({
    session_id: sessionRow.id,
    current_round: 0,
    phase: "waiting",
    state_json: {},
  });
  if (stErr) {
    console.error("session_state:", stErr.message);
    process.exit(1);
  }

  const { error: csErr } = await supabase.from("cover_story_sessions").insert({
    session_id: sessionRow.id,
    phase: "lobby",
  });
  if (csErr) {
    console.error("cover_story_sessions:", csErr.message);
    process.exit(1);
  }

  console.log("Cover Story test session ready.");
  console.log("  join_code:", sessionRow.join_code);
  console.log("  session_id:", sessionRow.id);
  console.log("  host:", `${APP_ORIGIN_DISPLAY}/host/${sessionRow.host_token}`);
  console.log("  join:", `${APP_ORIGIN_DISPLAY}/join/${sessionRow.join_code}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
