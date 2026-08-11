import { headers } from "next/headers";
import { requireHostOffering } from "@/lib/trane-quiz/auth";
import {
  buildTraneHostUrl,
  buildTraneJoinUrl,
} from "@/lib/trane-quiz/join-code";
import { resolveAppOrigin } from "@/lib/session/app-origin";
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
      />
    </main>
  );
}
