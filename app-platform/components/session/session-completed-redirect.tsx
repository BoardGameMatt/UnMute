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
 * everyone (including participants on a reveal) to `href`.
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

    const go = () => {
      if (navigated) return;
      navigated = true;
      router.replace(destination);
    };

    const checkStatus = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle();
      if (data?.status === "completed") go();
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
          if (next?.status === "completed") go();
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
