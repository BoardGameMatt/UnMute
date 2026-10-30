import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { claimHostLead } from "@/lib/join/claim-host-lead";
import { PARTICIPANT_COOKIE } from "@/lib/constants";

type RouteContext = { params: { token: string } };

export async function POST(request: Request, context: RouteContext) {
  const token = (context.params.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Invalid host link." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const displayName = formData.get("displayName");
  const existingParticipantId =
    cookies().get(PARTICIPANT_COOKIE)?.value ?? null;

  const result = await claimHostLead({
    hostToken: token,
    displayName: typeof displayName === "string" ? displayName : undefined,
    existingParticipantId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const claimUrl = new URL(
    `/api/session/${result.sessionId}/claim-participant`,
    origin
  );
  claimUrl.searchParams.set("pid", result.participantId);
  claimUrl.searchParams.set("ht", token);

  return NextResponse.redirect(claimUrl, 303);
}
