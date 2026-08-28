/**
 * Mint a Zoning Rights lobby on Pack A and print host/join URLs.
 * npx tsx scripts/mint-zoning-rights-session.ts
 *
 * Session rows live in the database from .env.local (usually production).
 * Play on localhost — this Moment is not on the production app until merge.
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
    .eq("slug", "zoning-rights")
    .single();
  if (pErr || !protocol) {
    console.error("zoning-rights protocol missing:", pErr?.message);
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
    console.error("Zoning Rights Pack A missing:", packErr?.message);
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
          name: "Zoning Rights Playtest",
          join_code: "ZRIGHT",
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

  console.log("Zoning Rights lobby (Pack A).");
  console.log("  join_code:", sessionRow.join_code);
  console.log("  session_id:", sessionRow.id);
  console.log("  host:", `${LOCAL_ORIGIN}/host/${sessionRow.host_token}`);
  console.log("  join:", `${LOCAL_ORIGIN}/join/${sessionRow.join_code}`);
  console.log("");
  console.log("Use localhost (dev server). Production does not have this build yet.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
