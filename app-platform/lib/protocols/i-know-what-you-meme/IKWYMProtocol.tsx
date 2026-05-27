"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { useGameState, useSessionContext } from "@/components/providers/SessionProvider";
import { BackToLobbyLink } from "@/components/session/back-to-lobby-link";
import { createClient } from "@/lib/supabase/client";
import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { SessionIdentityBanner } from "@/lib/protocols/the-truth-is/components/SessionIdentityBanner";
import { RevealView } from "./components/RevealView";
import { RoundPromptView } from "./components/RoundPromptView";
import { RoundSelectingView } from "./components/RoundSelectingView";
import { ScoreboardView } from "./components/ScoreboardView";
import { isIKWYMState, type IKWYMState } from "./types";

const IKWYMProtocol = ({
  sessionId,
  participantId,
  role,
}: SessionProtocolProps) => {
  const { sendAction, currentParticipant, roleInSession } = useSessionContext();
  const { stateJson, isLoading } = useGameState();
  const [initError, setInitError] = useState<string | null>(null);

  const send = useCallback(
    async (actionType: string, payload: object) => {
      await sendAction(actionType, payload);
    },
    [sendAction]
  );

  useEffect(() => {
    if (isLoading) return;
    if (isIKWYMState(stateJson)) return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("session_participants")
        .select("participant_id, participants ( id, display_name )")
        .eq("session_id", sessionId);

      if (cancelled) return;
      if (error || !data?.length) {
        setInitError("Could not load participants for this session.");
        return;
      }

      const participants = (
        data as {
          participant_id: string;
          participants:
            | { id: string; display_name: string }
            | { id: string; display_name: string }[]
            | null;
        }[]
      ).map((row) => {
        const p = row.participants;
        const one = Array.isArray(p) ? p[0] : p;
        return {
          id: one?.id ?? row.participant_id,
          display_name: one?.display_name ?? "Player",
        };
      });

      try {
        await send("initializeGame", { participants });
      } catch (e) {
        setInitError(e instanceof Error ? e.message : "Failed to start protocol.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, stateJson, sessionId, send]);

  if (initError) {
    return (
      <div className="px-5 py-12">
        <p className="text-center font-body text-signal-red" role="alert">
          {initError}
        </p>
        <BackToLobbyLink sessionId={sessionId} />
      </div>
    );
  }

  if (isLoading || !isIKWYMState(stateJson)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5 font-body text-slate">
        Loading…
      </div>
    );
  }

  const state = stateJson as IKWYMState;
  const showProgress = state.phase === "reveal";
  const progress =
    state.revealQueue.length > 0
      ? Math.min(
          1,
          (state.revealIndex + (state.roundResolved ? 1 : 0)) / state.revealQueue.length
        )
      : 0;

  const phaseKey = `${state.phase}-${state.revealIndex}-${state.roundResolved}`;

  return (
    <div className="min-h-screen bg-warm-white">
      <SessionIdentityBanner
        displayName={currentParticipant.display_name}
        roleInSession={roleInSession}
      />
      {showProgress ? <SessionProgressBar progress={progress} /> : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={phaseKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <PhaseBody
            state={state}
            participantId={participantId}
            role={role}
            send={send}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

type PhaseBodyProps = {
  state: IKWYMState;
  participantId: string;
  role: SessionProtocolProps["role"];
  send: (actionType: string, payload: object) => Promise<void>;
};

const PhaseBody = ({ state, participantId, role, send }: PhaseBodyProps) => {
  switch (state.phase) {
    case "round1_prompts":
      return (
        <RoundPromptView
          state={state}
          round={1}
          prompts={state.round1Prompts}
          role={role}
          sendAction={send}
        />
      );
    case "round1_selecting":
      return (
        <RoundSelectingView
          state={state}
          round={1}
          prompts={state.round1Prompts}
          responses={state.round1Responses}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "round2_prompts":
      if (!state.round2Prompts) {
        return (
          <p className="px-5 py-8 text-center font-body text-slate">
            Preparing round 2…
          </p>
        );
      }
      return (
        <RoundPromptView
          state={state}
          round={2}
          prompts={state.round2Prompts}
          role={role}
          sendAction={send}
        />
      );
    case "round2_selecting":
      if (!state.round2Prompts) return null;
      return (
        <RoundSelectingView
          state={state}
          round={2}
          prompts={state.round2Prompts}
          responses={state.round2Responses}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "reveal":
      return (
        <RevealView
          state={state}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "complete":
      return <ScoreboardView state={state} sendAction={send} />;
    default:
      return (
        <p className="px-5 py-8 text-center font-body text-slate">Unknown phase.</p>
      );
  }
};

export default IKWYMProtocol;
