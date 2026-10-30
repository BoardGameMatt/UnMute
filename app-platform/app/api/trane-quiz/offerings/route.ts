import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { generateTraneJoinCode } from "@/lib/trane-quiz/join-code";

type CreateBody = {
  courseSlug?: unknown;
  classDate?: unknown;
  label?: unknown;
};

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const courseSlug =
    typeof body.courseSlug === "string" ? body.courseSlug.trim() : "";
  const classDate =
    typeof body.classDate === "string" ? body.classDate.trim() : "";
  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 120)
      : null;

  if (!courseSlug || !/^\d{4}-\d{2}-\d{2}$/.test(classDate)) {
    return NextResponse.json(
      { error: "courseSlug and classDate (YYYY-MM-DD) are required" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { data: course, error: cErr } = await admin
    .from("trane_courses")
    .select("id")
    .eq("slug", courseSlug)
    .maybeSingle();

  if (cErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  let joinCode = generateTraneJoinCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: offering, error } = await admin
      .from("trane_offerings")
      .insert({
        course_id: course.id,
        class_date: classDate,
        label,
        join_code: joinCode,
        phase: "waiting",
      })
      .select("id, host_token, join_code")
      .single();

    if (!error && offering) {
      return NextResponse.json({
        offeringId: offering.id,
        hostToken: offering.host_token,
        joinCode: offering.join_code,
      });
    }

    // Unique join_code collision — retry
    if (error?.code === "23505") {
      joinCode = generateTraneJoinCode();
      continue;
    }
    console.error("trane offering create", error);
    return NextResponse.json(
      { error: "Could not create offering" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "Could not allocate join code" },
    { status: 500 }
  );
}
