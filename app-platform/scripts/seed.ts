/**
 * Idempotent dev seed — run from app-platform: npm run seed
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json, SessionStatus } from "../lib/types/database";

config({ path: resolve(process.cwd(), ".env.local") });

const SEED_TEAM_JOIN_CODE = "DEMOTM";
const TRUTH_SESSION_JOIN_CODE = "TRUTH1";
const DIBE_SESSION_JOIN_CODE = "DIBE01";
const MEME_SESSION_JOIN_CODE = "MEME01";

const ADMIN_EMAIL = "matt@unmutelabs.com";
const ADMIN_DISPLAY_NAME = "Matt Hendricks";

type SeedSessionSpec = {
  joinCode: string;
  protocolSlug: "the-truth-is" | "draw-it-by-ear" | "i-know-what-you-meme";
  status: SessionStatus;
  sessionLength?: "FULL" | "SHORT";
};

const SEED_SESSIONS: SeedSessionSpec[] = [
  {
    joinCode: TRUTH_SESSION_JOIN_CODE,
    protocolSlug: "the-truth-is",
    status: "lobby",
  },
  {
    joinCode: DIBE_SESSION_JOIN_CODE,
    protocolSlug: "draw-it-by-ear",
    status: "lobby",
    sessionLength: "FULL",
  },
  {
    joinCode: MEME_SESSION_JOIN_CODE,
    protocolSlug: "i-know-what-you-meme",
    status: "lobby",
  },
];

type SeededSession = {
  joinCode: string;
  protocolSlug: string;
  sessionId: string;
  sessionLength?: string;
};

async function seedSession(
  supabase: ReturnType<typeof createClient<Database>>,
  spec: SeedSessionSpec,
  protocolId: string,
  teamId: string
): Promise<SeededSession> {
  const stateJson: Json =
    spec.sessionLength !== undefined
      ? { session_length: spec.sessionLength }
      : {};

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .upsert(
      {
        protocol_id: protocolId,
        protocol_slot_id: null,
        team_id: teamId,
        status: spec.status,
        join_code: spec.joinCode,
      },
      { onConflict: "join_code" }
    )
    .select("id, join_code")
    .single();

  if (sessionError || !sessionRow) {
    throw new Error(`sessions upsert (${spec.joinCode}): ${sessionError?.message}`);
  }

  const { error: stateError } = await supabase.from("session_state").upsert(
    {
      session_id: sessionRow.id,
      current_round: 0,
      phase: "waiting",
      state_json: stateJson,
    },
    { onConflict: "session_id" }
  );

  if (stateError) {
    throw new Error(`session_state upsert (${spec.joinCode}): ${stateError.message}`);
  }

  return {
    joinCode: sessionRow.join_code,
    protocolSlug: spec.protocolSlug,
    sessionId: sessionRow.id,
    sessionLength: spec.sessionLength,
  };
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

  const supabase = createClient<Database>(url, key);

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
    {
      slug: "i-know-what-you-meme",
      name: "I Know What You Meme",
      description:
        "Respond with GIFs, then guess who picked what — meme energy for teams.",
      type: "turnbased",
      min_players: 3,
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

  const { data: protocolRows, error: protocolLoadErr } = await supabase
    .from("protocols")
    .select("id, slug")
    .in("slug", ["the-truth-is", "draw-it-by-ear", "i-know-what-you-meme"]);

  if (protocolLoadErr || !protocolRows?.length) {
    console.error("load protocols:", protocolLoadErr?.message);
    process.exit(1);
  }

  const protocolIdBySlug = Object.fromEntries(
    protocolRows.map((p) => [p.slug, p.id])
  ) as Record<string, string>;

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

  const seededSessions: SeededSession[] = [];

  try {
    for (const spec of SEED_SESSIONS) {
      const protocolId = protocolIdBySlug[spec.protocolSlug];
      if (!protocolId) {
        throw new Error(`Protocol not found: ${spec.protocolSlug}`);
      }
      const session = await seedSession(supabase, spec, protocolId, demoTeam.id);
      seededSessions.push(session);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log("Seed complete.");
  console.log("  team_id:", demoTeam.id);
  console.log("  team_join_code:", SEED_TEAM_JOIN_CODE);
  console.log("");
  for (const session of seededSessions) {
    console.log(`  [${session.protocolSlug}]`);
    console.log("    join_code:", session.joinCode);
    console.log("    session_id:", session.sessionId);
    if (session.sessionLength) {
      console.log("    session_length:", session.sessionLength);
    }
    console.log("");
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
