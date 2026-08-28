"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type SessionCompletedRedirectProps = {
  sessionId: string;
  /** Where to send everyone when status becomes completed. Defaults to feedback. */
  href?: string;
};

/**
 * Subscribes to `sessions` row; when status becomes `completed`, navigates
 * everyone (including participants on a reveal) to `href`. Cancelled sessions
 * refresh so the play page can show the ended state instead of feedback.
 * Also polls as a fallback when Realtime is delayed or unavailable.
 */
export function SessionCompletedRedirect({
  sessionId,
  href,
}: SessionCompletedRedirectProps) {
  const router = useRouter();
  const destination = href ?? `/session/${sessionId}/feedback`;

  useEffect(() => {
    const supabase = createClient();
    let navigated = false;

    const goCompleted = () => {
      if (navigated) return;
      navigated = true;
      router.replace(destination);
    };

    const goCancelled = () => {
      if (navigated) return;
      navigated = true;
      router.refresh();
    };

    const applyStatus = (status: string | undefined) => {
      if (status === "completed") goCompleted();
      else if (status === "cancelled") goCancelled();
    };

    const checkStatus = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle();
      applyStatus(data?.status as string | undefined);
    };

    void checkStatus();
    const pollId = setInterval(() => {
      void checkStatus();
    }, 4000);

    const channel = supabase
      .channel(`session_completed:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const next = payload.new as { status?: string } | null;
          applyStatus(next?.status);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, router, destination]);

  return null;
}
