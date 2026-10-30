import { headers } from "next/headers";
import { requireHostOffering } from "@/lib/trane-quiz/auth";
import {
  buildTraneHostUrl,
  buildTraneJoinUrl,
} from "@/lib/trane-quiz/join-code";
import { resolveAppOrigin } from "@/lib/session/app-origin";
import type { TraneParticipant } from "@/lib/types/database";
import { TraneHostConsole } from "./trane-host-console";

export const dynamic = "force-dynamic";

type PageProps = { params: { token: string } };

export default async function TraneHostPage({ params }: PageProps) {
  const auth = await requireHostOffering(params.token);
  if (!auth.ok) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="text-2xl text-trane-purple">Host link not found</h1>
        <p className="mt-3 text-sm text-trane-gray">{auth.error}</p>
      </main>
    );
  }

  const { data: course } = await auth.admin
    .from("trane_courses")
    .select("title")
    .eq("id", auth.offering.course_id)
    .maybeSingle();

  const { data: participants } = await auth.admin
    .from("trane_participants")
    .select("*")
    .eq("offering_id", auth.offering.id);

  const rows = (participants ?? []) as TraneParticipant[];
  const initialStatus = {
    phase: auth.offering.phase,
    joined: rows.length,
    preCompleted: rows.filter((p) => p.pre_completed_at).length,
    postCompleted: rows.filter((p) => p.post_completed_at).length,
    paired: rows.filter(
      (p) => p.pre_completed_at && p.post_completed_at && !p.post_unpaired
    ).length,
    endOnly: rows.filter(
      (p) => p.post_completed_at && (!p.pre_completed_at || p.post_unpaired)
    ).length,
  };

  const origin = resolveAppOrigin(headers());
  const joinUrl = buildTraneJoinUrl(origin, auth.offering.join_code);
  const hostUrl = buildTraneHostUrl(origin, auth.offering.host_token);

  return (
    <main>
      <TraneHostConsole
        hostToken={auth.offering.host_token}
        courseTitle={(course as { title?: string } | null)?.title ?? "Course"}
        classDate={auth.offering.class_date}
        label={auth.offering.label}
        joinCode={auth.offering.join_code}
        joinUrl={joinUrl}
        hostUrl={hostUrl}
        initialPhase={auth.offering.phase}
        initialStatus={initialStatus}
      />
    </main>
  );
}
