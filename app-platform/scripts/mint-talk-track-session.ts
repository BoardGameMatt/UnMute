/**
 * Mint a Talk Track lobby on Pack A and print host/join URLs.
 * npx tsx scripts/mint-talk-track-session.ts
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
    .eq("slug", "talk-track")
    .single();
  if (pErr || !protocol) {
    console.error("talk-track protocol missing:", pErr?.message);
    process.exit(1);
  }

  const { data: pack, error: packErr } = await supabase
    .from("content_packs")
    .select("id")
    .eq("protocol_id", protocol.id)
    .eq("slug", "a")
    .eq("status", "active")
    .maybeSingle();
  if (packErr || !pack) {
    console.error("Talk Track Pack A missing:", packErr?.message);
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
          name: "Talk Track Playtest",
          join_code: "TTRACK",
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
      content_pack_id: pack.id,
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

  console.log("Talk Track test session ready (Pack A).");
  console.log("  join_code:", sessionRow.join_code);
  console.log("  session_id:", sessionRow.id);
  console.log("  host:", `${APP_ORIGIN_DISPLAY}/host/${sessionRow.host_token}`);
  console.log("  join:", `${APP_ORIGIN_DISPLAY}/join/${sessionRow.join_code}`);
  console.log("  local_host:", `http://localhost:3000/host/${sessionRow.host_token}`);
  console.log("  local_join:", `http://localhost:3000/join/${sessionRow.join_code}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
