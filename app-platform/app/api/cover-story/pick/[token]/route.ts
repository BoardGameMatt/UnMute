import { NextResponse } from "next/server";
import { lockAgencyForParticipant } from "@/lib/cover-story/actions";
import { loadPickPageByToken, resolveDealByPickToken } from "@/lib/cover-story/pick-page";
import { createServiceClient } from "@/lib/supabase/admin";

type RouteContext = { params: { token: string } };

export async function GET(_request: Request, context: RouteContext) {
  const token = context.params.token ?? "";
  try {
    const admin = createServiceClient();
    const data = await loadPickPageByToken(admin, token);
    if (!data) {
      return NextResponse.json({ error: "Pick link not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load pick page.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const token = context.params.token ?? "";
  let body: { agencyId?: number };
  try {
    body = (await request.json()) as { agencyId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const agencyId = body.agencyId;
  if (typeof agencyId !== "number" || !Number.isFinite(agencyId)) {
    return NextResponse.json({ error: "Choose an agency." }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const resolved = await resolveDealByPickToken(admin, token);
    if (!resolved) {
      return NextResponse.json({ error: "Pick link not found." }, { status: 404 });
    }
    if (resolved.deal.locked_agency_id) {
      return NextResponse.json({ error: "Cover already locked." }, { status: 409 });
    }
    if (!resolved.deal.shown_agency_ids.includes(agencyId)) {
      return NextResponse.json({ error: "That agency is not on these cards." }, { status: 400 });
    }

    await lockAgencyForParticipant(
      admin,
      resolved.sessionId,
      resolved.deal.participant_id,
      agencyId
    );
    const data = await loadPickPageByToken(admin, token);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not lock agency.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
