/**
 * Mint an Airtime lobby and print host/join URLs.
 * npx tsx scripts/mint-airtime-session.ts
 *
 * Requires migration 030 (airtime_* tables). No content pack.
 * Open the host link on the laptop (it becomes the Shared screen), then join on phones.
 */

import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const LOCAL_ORIGIN = "http://localhost:3000";

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
    .eq("slug", "airtime")
    .single();
  if (pErr || !protocol) {
    console.error("airtime protocol missing (apply 030_airtime.sql):", pErr?.message);
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
        { name: "Airtime Playtest", join_code: "AIRTME", require_auth: false },
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

  console.log("Airtime lobby.");
  console.log("  join_code:", sessionRow.join_code);
  console.log("  session_id:", sessionRow.id);
  console.log("  host (laptop, Shared screen):", `${LOCAL_ORIGIN}/host/${sessionRow.host_token}`);
  console.log("  join (phones):", `${LOCAL_ORIGIN}/join/${sessionRow.join_code}`);
  console.log("");
  console.log("Use localhost (dev server).");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
