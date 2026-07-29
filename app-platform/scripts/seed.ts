/**
 * Idempotent dev seed — run from app-platform: npm run seed
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database";

config({ path: resolve(process.cwd(), ".env.local") });

const SEED_TEAM_JOIN_CODE = "DEMOTM";
const SEED_SESSION_JOIN_CODE = "DIBE01";

const ADMIN_EMAIL = "matt@unmutelabs.com";
const ADMIN_DISPLAY_NAME = "Matt Hendricks";

async function cleanupDemoData(
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  console.log("Cleanup: looking up demo team by join_code...");

  const { data: existingTeam, error: teamLookupErr } = await supabase
    .from("teams")
    .select("id")
    .eq("join_code", SEED_TEAM_JOIN_CODE)
    .maybeSingle();

  if (teamLookupErr) {
    console.error("cleanup teams lookup:", teamLookupErr.message);
    process.exit(1);
  }

  if (!existingTeam) {
    console.log("Cleanup: no demo team found, skipping.");
    return;
  }

  const demoTeamId = existingTeam.id;

  const { data: demoSessions, error: sessionsLookupErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("team_id", demoTeamId);

  if (sessionsLookupErr) {
    console.error("cleanup sessions lookup:", sessionsLookupErr.message);
    process.exit(1);
  }

  const sessionIds = (demoSessions ?? []).map((s) => s.id);

  if (sessionIds.length > 0) {
    const { error: spErr } = await supabase
      .from("session_participants")
      .delete()
      .in("session_id", sessionIds);

    if (spErr) {
      console.error("cleanup session_participants:", spErr.message);
      process.exit(1);
    }
    console.log(
      `Cleanup: deleted session_participants for ${sessionIds.length} demo session(s).`
    );

    const { error: stateErr } = await supabase
      .from("session_state")
      .delete()
      .in("session_id", sessionIds);

    if (stateErr) {
      console.error("cleanup session_state:", stateErr.message);
      process.exit(1);
    }
    console.log(
      `Cleanup: deleted session_state for ${sessionIds.length} demo session(s).`
    );

    const { error: sessionsErr } = await supabase
      .from("sessions")
      .delete()
      .in("id", sessionIds);

    if (sessionsErr) {
      console.error("cleanup sessions:", sessionsErr.message);
      process.exit(1);
    }
    console.log(`Cleanup: deleted ${sessionIds.length} demo session(s).`);
  } else {
    console.log("Cleanup: no demo sessions found.");
  }

  const { error: participantsErr } = await supabase
    .from("participants")
    .delete()
    .eq("team_id", demoTeamId);

  if (participantsErr) {
    console.error("cleanup participants:", participantsErr.message);
    process.exit(1);
  }
  console.log("Cleanup: deleted participants for demo team.");

  const { error: rosterErr } = await supabase
    .from("team_roster")
    .delete()
    .eq("team_id", demoTeamId);

  if (rosterErr) {
    console.error("cleanup team_roster:", rosterErr.message);
    process.exit(1);
  }
  console.log("Cleanup: deleted team_roster for demo team.");

  const { error: teamErr } = await supabase
    .from("teams")
    .delete()
    .eq("join_code", SEED_TEAM_JOIN_CODE);

  if (teamErr) {
    console.error("cleanup teams:", teamErr.message);
    process.exit(1);
  }
  console.log("Cleanup: deleted demo team.");
}

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

  await cleanupDemoData(supabase);

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

  const { data: dibeProtocol, error: dibeProtoErr } = await supabase
    .from("protocols")
    .select("id")
    .eq("slug", "draw-it-by-ear")
    .single();

  if (dibeProtoErr || !dibeProtocol) {
    console.error("load draw-it-by-ear protocol:", dibeProtoErr?.message);
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

  // Plain insert, not upsert: display_name is no longer unique per team, so
  // there is no conflict target. cleanupDemoData() already cleared these rows.
  const { error: participantsError } = await supabase
    .from("participants")
    .insert(participantRows);

  if (participantsError) {
    console.error("participants insert:", participantsError.message);
    process.exit(1);
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .upsert(
      {
        protocol_id: dibeProtocol.id,
        protocol_slot_id: null,
        team_id: demoTeam.id,
        status: "lobby",
        join_code: SEED_SESSION_JOIN_CODE,
        // Cryptographically random 32-byte hex — same generator as migration 006 default.
        host_token: randomBytes(32).toString("hex"),
      },
      { onConflict: "join_code" }
    )
    .select("id, join_code, host_token")
    .single();

  if (sessionError || !sessionRow) {
    console.error("sessions upsert:", sessionError?.message);
    process.exit(1);
  }

  const { data: seededParticipants, error: seedParticipantsErr } = await supabase
    .from("participants")
    .select("id, display_name, role")
    .eq("team_id", demoTeam.id);

  if (seedParticipantsErr || !seededParticipants) {
    console.error("participants select:", seedParticipantsErr?.message);
    process.exit(1);
  }

  const sessionParticipantRows: Database["public"]["Tables"]["session_participants"]["Insert"][] =
    seededParticipants.map((participant) => ({
      session_id: sessionRow.id,
      participant_id: participant.id,
      role_in_session:
        participant.display_name === "Matt" ? "lead" : "member",
      connected: false,
    }));

  const { error: sessionParticipantsError } = await supabase
    .from("session_participants")
    .upsert(sessionParticipantRows, {
      onConflict: "session_id,participant_id",
    });

  if (sessionParticipantsError) {
    console.error("session_participants upsert:", sessionParticipantsError.message);
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
  console.log(
    "  host URL:",
    `http://localhost:3000/host/${sessionRow.host_token}`
  );

  console.log("\nClaim links (open one per browser):");
  for (const participant of seededParticipants) {
    const roleInSession =
      participant.display_name === "Matt" ? "lead" : "member";
    const roleLabel = roleInSession === "lead" ? "LEAD" : roleInSession;
    console.log(
      `  ${participant.display_name} (${roleLabel}): http://localhost:3000/api/session/${sessionRow.id}/claim-participant?pid=${participant.id}`
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
