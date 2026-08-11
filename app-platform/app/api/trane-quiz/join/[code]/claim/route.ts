import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { TRANE_QUIZ_PARTICIPANT_COOKIE } from "@/lib/trane-quiz/constants";
import { normalizeTraneJoinCode } from "@/lib/trane-quiz/join-code";

/**
 * Full-page GET that creates/reuses an anonymous participant and sets the cookie.
 */
export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const joinCode = normalizeTraneJoinCode(params.code);
  if (joinCode.length !== 6) {
    return NextResponse.redirect(
      new URL("/trane-quiz/join/INVALID?error=not_found", _req.url)
    );
  }

  const admin = createServiceClient();
  const { data: offering, error } = await admin
    .from("trane_offerings")
    .select("id, phase")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (error || !offering) {
    return NextResponse.redirect(
      new URL(`/trane-quiz/join/${joinCode}?error=not_found`, _req.url)
    );
  }

  if (offering.phase === "closed") {
    return NextResponse.redirect(
      new URL(`/trane-quiz/join/${joinCode}?error=closed`, _req.url)
    );
  }

  const cookieStore = cookies();
  const existingId = cookieStore.get(TRANE_QUIZ_PARTICIPANT_COOKIE)?.value;

  if (existingId) {
    const { data: existing } = await admin
      .from("trane_participants")
      .select("id")
      .eq("id", existingId)
      .eq("offering_id", offering.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.redirect(
        new URL(`/trane-quiz/o/${offering.id}/play`, _req.url)
      );
    }
  }

  const { data: created, error: createErr } = await admin
    .from("trane_participants")
    .insert({ offering_id: offering.id })
    .select("id")
    .single();

  if (createErr || !created) {
    return NextResponse.redirect(
      new URL(`/trane-quiz/join/${joinCode}?error=join_failed`, _req.url)
    );
  }

  const response = NextResponse.redirect(
    new URL(`/trane-quiz/o/${offering.id}/play`, _req.url)
  );
  response.cookies.set(TRANE_QUIZ_PARTICIPANT_COOKIE, created.id as string, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
