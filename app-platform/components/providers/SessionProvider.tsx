"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Json,
  Participant,
  Session,
  SessionParticipantRole,
} from "@/lib/types/database";

type GameStateSnapshot = {
  stateJson: Json;
  phase: string;
  currentRound: number;
};

type SessionContextValue = {
  session: Session;
  currentParticipant: Participant;
  roleInSession: SessionParticipantRole;
  protocolName: string;
  sendAction: (actionType: string, payload: object) => Promise<void>;
  gameState: GameStateSnapshot | null;
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

  const sendAction = useCallback(
    async (actionType: string, payload: object) => {
      const res = await fetch(`/api/session/${session.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, payload }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Action failed (${res.status})`);
      }
    },
    [session.id]
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const applyRow = (row: {
      state_json: Json;
      phase: string;
      current_round: number;
    }) => {
      setGameState({
        stateJson: row.state_json,
        phase: row.phase,
        currentRound: row.current_round,
      });
    };

    void (async () => {
      const { data, error } = await supabase
        .from("session_state")
        .select("state_json, phase, current_round")
        .eq("session_id", session.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("session_state load:", error.message);
        setGameState({
          stateJson: {},
          phase: "waiting",
          currentRound: 0,
        });
        return;
      }

      if (data) {
        applyRow(data);
      } else {
        setGameState({
          stateJson: {},
          phase: "waiting",
          currentRound: 0,
        });
      }
    })();

    const channel = supabase
      .channel(`session_state:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_state",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const next = payload.new as {
            state_json?: Json;
            phase?: string;
            current_round?: number;
          } | null;
          if (!next || typeof next !== "object") return;
          if (
            next.state_json === undefined ||
            next.phase === undefined ||
            next.current_round === undefined
          ) {
            return;
          }
          setGameState({
            stateJson: next.state_json,
            phase: next.phase,
            currentRound: next.current_round,
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [session.id]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      currentParticipant,
      roleInSession,
      protocolName,
      sendAction,
      gameState,
    }),
    [
      session,
      currentParticipant,
      roleInSession,
      protocolName,
      sendAction,
      gameState,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
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
} {
  const { gameState } = useSessionContext();
  return {
    stateJson: gameState?.stateJson ?? {},
    phase: gameState?.phase ?? "waiting",
    currentRound: gameState?.currentRound ?? 0,
    isLoading: gameState === null,
  };
}
