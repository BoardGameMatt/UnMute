import { NextResponse } from "next/server";
import { requireHostOffering } from "@/lib/trane-quiz/auth";
import { canTransitionPhase } from "@/lib/trane-quiz/phases";
import type { TraneOfferingPhase } from "@/lib/types/database";

type PhaseBody = { phase?: unknown };

const PHASES: TraneOfferingPhase[] = [
  "waiting",
  "pre_open",
  "pre_closed",
  "post_open",
  "closed",
];

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const auth = await requireHostOffering(params.token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: PhaseBody;
  try {
    body = (await req.json()) as PhaseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const next =
    typeof body.phase === "string" ? (body.phase as TraneOfferingPhase) : null;
  if (!next || !PHASES.includes(next)) {
    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  }

  if (!canTransitionPhase(auth.offering.phase, next)) {
    return NextResponse.json(
      {
        error: `Cannot move from ${auth.offering.phase} to ${next}`,
      },
      { status: 409 }
    );
  }

  const patch: {
    phase: TraneOfferingPhase;
    closed_at?: string;
  } = { phase: next };
  if (next === "closed") {
    patch.closed_at = new Date().toISOString();
  }

  const { data, error } = await auth.admin
    .from("trane_offerings")
    .update(patch)
    .eq("id", auth.offering.id)
    .select("phase")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not update phase" },
      { status: 500 }
    );
  }

  return NextResponse.json({ phase: data.phase });
}
