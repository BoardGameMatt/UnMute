"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSessionContext } from "@/components/providers/SessionProvider";

type SessionCompletedRedirectProps = { sessionId: string; href?: string };

/** Share the provider's reconciled status instead of independently trusting
 * socket payloads. Reset returns every client to the lobby; completion keeps
 * the protocol's existing feedback/scoreboard destination.
 */
export function SessionCompletedRedirect({ sessionId, href }: SessionCompletedRedirectProps) {
  const router = useRouter();
  const { gameState } = useSessionContext();
  const navigated = useRef<string | null>(null);
  const status = gameState?.sessionStatus;
  const destination = href ?? `/session/${sessionId}/feedback`;
  useEffect(() => {
    if (!status || status === "active" || navigated.current === sessionId) return;
    if (status === "completed") { navigated.current = sessionId; router.replace(destination); }
    else if (status === "cancelled") { navigated.current = sessionId; router.refresh(); }
    else if (status === "lobby") { navigated.current = sessionId; router.replace(`/session/${sessionId}/lobby`); }
  }, [status, sessionId, destination, router]);
  return null;
}
