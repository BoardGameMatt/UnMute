"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type SessionCompletedRedirectProps = {
  sessionId: string;
};

/** Subscribes to `sessions` row; when status becomes `completed`, sends everyone to feedback. */
export function SessionCompletedRedirect({ sessionId }: SessionCompletedRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
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
          if (next?.status === "completed") {
            router.replace(`/session/${sessionId}/feedback`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, router]);

  return null;
}
