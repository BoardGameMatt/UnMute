import { NextResponse } from "next/server";
import { requireHostOffering } from "@/lib/trane-quiz/auth";
import type { TraneParticipant } from "@/lib/types/database";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const auth = await requireHostOffering(params.token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: participants, error } = await auth.admin
    .from("trane_participants")
    .select("*")
    .eq("offering_id", auth.offering.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not load participants" },
      { status: 500 }
    );
  }

  const rows = (participants ?? []) as TraneParticipant[];
  const joined = rows.length;
  const preCompleted = rows.filter((p) => p.pre_completed_at).length;
  const postCompleted = rows.filter((p) => p.post_completed_at).length;
  const paired = rows.filter(
    (p) => p.pre_completed_at && p.post_completed_at && !p.post_unpaired
  ).length;
  const endOnly = rows.filter(
    (p) => p.post_completed_at && (!p.pre_completed_at || p.post_unpaired)
  ).length;

  return NextResponse.json(
    {
      phase: auth.offering.phase,
      joined,
      preCompleted,
      postCompleted,
      paired,
      endOnly,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
