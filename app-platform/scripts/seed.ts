/**
 * Idempotent dev seed — run from app-platform: npm run seed
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database";

config({ path: resolve(process.cwd(), ".env.local") });

const SEED_TEAM_JOIN_CODE = "DEMOTM";
const SEED_SESSION_JOIN_CODE = "TRUTH1";

const ADMIN_EMAIL = "matt@unmutelabs.com";
const ADMIN_DISPLAY_NAME = "Matt Hendricks";

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const protocols: Database["public"]["Tables"]["protocols"]["Insert"][] = [
    {
      slug: "the-truth-is",
      name: "The Truth Is...",
      description:
        "Surface assumptions and build trust through structured vulnerability.",
      type: "turnbased",
      min_players: 3,
      max_players: 20,
      config_schema: {},
    },
    {
      slug: "draw-it-by-ear",
      name: "Draw It By Ear",
      description:
        "Build communication precision through a high-energy drawing challenge.",
      type: "realtime",
      min_players: 5,
      max_players: 20,
      config_schema: {},
    },
  ];

  const { error: protocolsError } = await supabase
    .from("protocols")
    .upsert(protocols, { onConflict: "slug" });

  if (protocolsError) {
    console.error("protocols upsert:", protocolsError.message);
    process.exit(1);
  }

  const { data: truthProtocol, error: truthProtoErr } = await supabase
    .from("protocols")
    .select("id")
    .eq("slug", "the-truth-is")
    .single();

  if (truthProtoErr || !truthProtocol) {
    console.error("load the-truth-is protocol:", truthProtoErr?.message);
    process.exit(1);
  }

  const { data: adminPerson, error: personError } = await supabase
    .from("persons")
    .upsert(
      {
        email: ADMIN_EMAIL,
        display_name: ADMIN_DISPLAY_NAME,
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();

  if (personError || !adminPerson) {
    console.error("persons upsert:", personError?.message);
    process.exit(1);
  }

  const { data: demoTeam, error: teamError } = await supabase
    .from("teams")
    .upsert(
      {
        name: "Demo Team",
        join_code: SEED_TEAM_JOIN_CODE,
        require_auth: false,
        created_by: adminPerson.id,
      },
      { onConflict: "join_code" }
    )
    .select("id")
    .single();

  if (teamError || !demoTeam) {
    console.error("teams upsert:", teamError?.message);
    process.exit(1);
  }

  const rosterRows: Database["public"]["Tables"]["team_roster"]["Insert"][] = [
    {
      team_id: demoTeam.id,
      email: ADMIN_EMAIL,
      display_name_hint: ADMIN_DISPLAY_NAME,
      role: "lead",
    },
    {
      team_id: demoTeam.id,
      email: "alice@demo.unmute.team",
      display_name_hint: null,
      role: "member",
    },
    {
      team_id: demoTeam.id,
      email: "bob@demo.unmute.team",
      display_name_hint: null,
      role: "member",
    },
    {
      team_id: demoTeam.id,
      email: "charlie@demo.unmute.team",
      display_name_hint: null,
      role: "member",
    },
    {
      team_id: demoTeam.id,
      email: "dana@demo.unmute.team",
      display_name_hint: null,
      role: "member",
    },
  ];

  const { error: rosterError } = await supabase
    .from("team_roster")
    .upsert(rosterRows, { onConflict: "team_id,email" });

  if (rosterError) {
    console.error("team_roster upsert:", rosterError.message);
    process.exit(1);
  }

  const participantRows: Database["public"]["Tables"]["participants"]["Insert"][] =
    [
      {
        team_id: demoTeam.id,
        person_id: adminPerson.id,
        display_name: "Matt",
        role: "lead",
      },
      {
        team_id: demoTeam.id,
        person_id: null,
        display_name: "Alice",
        role: "member",
      },
      {
        team_id: demoTeam.id,
        person_id: null,
        display_name: "Bob",
        role: "member",
      },
      {
        team_id: demoTeam.id,
        person_id: null,
        display_name: "Charlie",
        role: "member",
      },
      {
        team_id: demoTeam.id,
        person_id: null,
        display_name: "Dana",
        role: "member",
      },
    ];

  const { error: participantsError } = await supabase
    .from("participants")
    .upsert(participantRows, { onConflict: "team_id,display_name" });

  if (participantsError) {
    console.error("participants upsert:", participantsError.message);
    process.exit(1);
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .upsert(
      {
        protocol_id: truthProtocol.id,
        protocol_slot_id: null,
        team_id: demoTeam.id,
        status: "lobby",
        join_code: SEED_SESSION_JOIN_CODE,
      },
      { onConflict: "join_code" }
    )
    .select("id, join_code")
    .single();

  if (sessionError || !sessionRow) {
    console.error("sessions upsert:", sessionError?.message);
    process.exit(1);
  }

  const { error: stateError } = await supabase.from("session_state").upsert(
    {
      session_id: sessionRow.id,
      current_round: 0,
      phase: "waiting",
      state_json: {},
    },
    { onConflict: "session_id" }
  );

  if (stateError) {
    console.error("session_state upsert:", stateError.message);
    process.exit(1);
  }

  console.log("Seed complete.");
  console.log("  join_code:", sessionRow.join_code);
  console.log("  session_id:", sessionRow.id);
  console.log("  team_id:", demoTeam.id);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
