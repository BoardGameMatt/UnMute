import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/trane-quiz/auth";
import { TRANE_QUIZ_PARTICIPANT_COOKIE } from "@/lib/trane-quiz/constants";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const participantId = cookies().get(TRANE_QUIZ_PARTICIPANT_COOKIE)?.value;
  const auth = await requireParticipant(params.id, participantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.offering.phase !== "post_open") {
    return NextResponse.json(
      { error: "End quiz is not open" },
      { status: 409 }
    );
  }

  if (auth.participant.pre_completed_at) {
    return NextResponse.json({ ok: true, unpaired: false });
  }

  if (auth.participant.post_completed_at) {
    return NextResponse.json({ error: "Already completed" }, { status: 409 });
  }

  const { error } = await auth.admin
    .from("trane_participants")
    .update({
      post_unpaired: true,
      post_unpaired_confirmed_at: new Date().toISOString(),
    })
    .eq("id", auth.participant.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not confirm" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, unpaired: true });
}
