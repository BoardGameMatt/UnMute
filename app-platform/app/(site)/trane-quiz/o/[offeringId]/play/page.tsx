import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { TRANE_QUIZ_PARTICIPANT_COOKIE } from "@/lib/trane-quiz/constants";
import { TranePlayClient } from "./trane-play-client";

type PageProps = { params: { offeringId: string } };

export default async function TranePlayPage({ params }: PageProps) {
  const participantId = cookies().get(TRANE_QUIZ_PARTICIPANT_COOKIE)?.value;
  if (!participantId) {
    const admin = createServiceClient();
    const { data: offering } = await admin
      .from("trane_offerings")
      .select("join_code")
      .eq("id", params.offeringId)
      .maybeSingle();
    const code = (offering as { join_code?: string } | null)?.join_code;
    if (code) {
      redirect(`/trane-quiz/join/${code}`);
    }
    redirect("/trane-quiz/new");
  }

  return (
    <TranePlayClient offeringId={params.offeringId} />
  );
}
