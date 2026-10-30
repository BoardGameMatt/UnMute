"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { withActionTimeout } from "@/lib/session/action-timeout";
import type {
  Json,
  Participant,
  Session,
  SessionParticipantRole,
} from "@/lib/types/database";

type GameStateSnapshot = {
  sessionId: string;
  generation: number;
  revision: number;
  sessionStatus: string | undefined;
  stateJson: Json;
  phase: string;
  currentRound: number;
};

/** `changed: false` means the reducer no-opped and persisted state is unchanged. */
export type SendActionResult = { changed: boolean };

type SessionContextValue = {
  session: Session;
  currentParticipant: Participant;
  roleInSession: SessionParticipantRole;
  protocolName: string;
  sendAction: (actionType: string, payload: object) => Promise<SendActionResult>;
  gameState: GameStateSnapshot | null;
  connectionError: string | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = {
  session: Session;
  currentParticipant: Participant;
  roleInSession: SessionParticipantRole;
  protocolName: string;
  children: ReactNode;
};

export const SessionProvider = ({
  session,
  currentParticipant,
  roleInSession,
  protocolName,
  children,
}: SessionProviderProps) => {
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const actionSnapshot = useRef(gameState);
  actionSnapshot.current = gameState;
  const sendAction = useCallback(
    async (actionType: string, payload: object): Promise<SendActionResult> => {
      const snapshot = actionSnapshot.current;
      const scopedPayload = actionType === "submitScoring" ? { ...payload, armedPhase: snapshot?.phase,
        timerStartedAt: (snapshot?.stateJson as Record<string, Json> | undefined)?.timer_started_at } : payload;
      const operationId = crypto.randomUUID();
      const context = snapshot && typeof snapshot.stateJson === "object" && snapshot.stateJson !== null ? { phase: snapshot.phase, round: (snapshot.stateJson as Record<string, Json>).current_round ?? 0, timer: (snapshot.stateJson as Record<string, Json>).timer_started_at ?? null } : undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await withActionTimeout(() => fetch(`/api/session/${session.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionType, payload: scopedPayload, generation: session.lifecycle_version ?? 0, operationId, context }),
        }));
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Action failed (${res.status})`);
        }
        // `changed: false` means a server guard rejected the action and state is
        // untouched. Absent for protocols that do not report it — assume changed.
        try {
          const body = (await res.json()) as { changed?: boolean; retryAfterMs?: number };
          // A phone's clock can finish before the server deadline. Retry the same
          // timer instance so a valid early callback does not strand the room.
          if (attempt < 2 && typeof body.retryAfterMs === "number" &&
            Number.isFinite(body.retryAfterMs) && body.retryAfterMs > 0) {
            const delayMs = body.retryAfterMs + 50;
            await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
            continue;
          }
          return { changed: body.changed !== false };
        } catch {
          return { changed: true };
        }
      }
      return { changed: false };
    },
    [session.id, session.lifecycle_version]
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let stopped = false;
    let request = 0;
    let watermark = -1;
    let knownStatus: string | undefined;
    let controller: AbortController | null = null;
    let dirty = false;
    let interval: number | undefined;
    setConnectionError(null);

    const reconcile = async (force = false): Promise<void> => {
      if (cancelled || stopped) return;
      if (controller && !force) { dirty = true; return; }
      controller?.abort();
      const active = new AbortController();
      controller = active;
      const token = ++request;
      const timeout = window.setTimeout(() => active.abort(), 2500);
      try {
        const { data, error } = await supabase.from("session_state")
          .select("session_id, state_json, phase, current_round, revision, sessions(status)")
          .eq("session_id", session.id).abortSignal(active.signal).maybeSingle();
        if (cancelled || token !== request) return;
        if (error || !data) throw new Error("Workshop snapshot unavailable");
        const row = data as { session_id: string; state_json: Json; phase: string;
          current_round: number; revision: number; sessions: { status: string } | { status: string }[] | null };
        if (row.session_id !== session.id || !Number.isSafeInteger(row.revision) || row.revision < 0) {
          throw new Error("Invalid workshop revision");
        }
        const status = Array.isArray(row.sessions) ? row.sessions[0]?.status : row.sessions?.status;
        if (row.revision > watermark || (row.revision === watermark && status !== knownStatus)) {
          watermark = row.revision;
          knownStatus = status;
          setGameState({ sessionId: session.id, generation: session.lifecycle_version ?? 0, revision: row.revision, sessionStatus: status,
            stateJson: row.state_json, phase: row.phase, currentRound: row.current_round });
        }
        setConnectionError(null);
        if (row.revision >= watermark && (status === "completed" || status === "cancelled")) {
          stopped = true;
          window.clearInterval(interval);
          void supabase.removeChannel(channel);
        }
      } catch {
        if (!cancelled && token === request) setConnectionError("Connection interrupted. Reconnecting…");
      } finally {
        window.clearTimeout(timeout);
        if (controller === active) {
          controller = null;
          if (dirty && !cancelled && !stopped) { dirty = false; void reconcile(); }
        }
      }
    };

    // Notifications never directly replace state: a delayed payload must not
    // rewind the UI. Re-read the row on subscription/reconnection as well.
    const channel = supabase.channel(`session_state:${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_state",
        filter: `session_id=eq.${session.id}` }, () => { void reconcile(); })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void reconcile(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") void reconcile();
      });
    void reconcile();
    interval = window.setInterval(() => { void reconcile(); }, 2000);
    const resume = () => {
      if (document.visibilityState !== "hidden") void reconcile(true);
    };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      ++request;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
      void supabase.removeChannel(channel);
    };
  }, [session.id, session.lifecycle_version]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      currentParticipant,
      roleInSession,
      protocolName,
      sendAction,
      gameState: gameState?.sessionId === session.id && gameState.generation === (session.lifecycle_version ?? 0) ? gameState : null,
      connectionError,
    }),
    [
      session,
      currentParticipant,
      roleInSession,
      protocolName,
      sendAction,
      gameState,
      connectionError,
    ]
  );

  return <SessionContext.Provider value={value}>
    {connectionError ? <p role="status" className="mx-auto max-w-lg rounded-md bg-cloud-grey px-5 py-3 font-body text-sm text-slate">{connectionError}</p> : null}
    {children}
  </SessionContext.Provider>;
};

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used within SessionProvider");
  }
  return ctx;
}

export function useGameState(): {
  stateJson: Json;
  phase: string;
  currentRound: number;
  isLoading: boolean;
  connectionError: string | null;
  sessionStatus: string | undefined;
} {
  const { gameState, connectionError } = useSessionContext();
  return {
    stateJson: gameState?.stateJson ?? {},
    phase: gameState?.phase ?? "waiting",
    currentRound: gameState?.currentRound ?? 0,
    isLoading: gameState === null,
    connectionError,
    sessionStatus: gameState?.sessionStatus,
  };
}
