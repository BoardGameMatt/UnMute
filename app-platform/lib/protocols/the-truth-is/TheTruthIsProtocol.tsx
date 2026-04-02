"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { useGameState, useSessionContext } from "@/components/providers/SessionProvider";
import { BackToLobbyLink } from "@/components/session/back-to-lobby-link";
import { createClient } from "@/lib/supabase/client";
import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { SessionIdentityBanner } from "./components/SessionIdentityBanner";
import { LeaderboardView } from "./components/LeaderboardView";
import { ReadingView } from "./components/ReadingView";
import { ResultsView } from "./components/ResultsView";
import { RevealView } from "./components/RevealView";
import { SubmissionView } from "./components/SubmissionView";
import { VotingView } from "./components/VotingView";
import { WrapUpView } from "./components/WrapUpView";
import { isTruthIsState, type TruthIsState } from "./types";

const TheTruthIsProtocol = ({
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
    if (isTruthIsState(stateJson)) return;

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

  if (isLoading || !isTruthIsState(stateJson)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5 font-body text-slate">
        Loading…
      </div>
    );
  }

  const state = stateJson as TruthIsState;
  const showProgress =
    state.phase !== "SUBMISSION_1" &&
    state.phase !== "SUBMISSION_2" &&
    state.phase !== "RESULTS";

  const progress =
    state.progress_total_rounds > 0
      ? Math.min(1, state.total_rounds_played / state.progress_total_rounds)
      : 0;

  return (
    <div className="min-h-screen bg-warm-white">
      <SessionIdentityBanner
        displayName={currentParticipant.display_name}
        roleInSession={roleInSession}
      />
      {showProgress ? <SessionProgressBar progress={progress} /> : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={state.phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <PhaseBody state={state} participantId={participantId} role={role} send={send} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

type PhaseBodyProps = {
  state: TruthIsState;
  participantId: string;
  role: SessionProtocolProps["role"];
  send: (actionType: string, payload: object) => Promise<void>;
};

const PhaseBody = ({ state, participantId, role, send }: PhaseBodyProps) => {
  switch (state.phase) {
    case "SUBMISSION_1":
      return (
        <SubmissionView
          round={1}
          state={state}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "SUBMISSION_2":
      return (
        <SubmissionView
          round={2}
          state={state}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "READING_ASSIGNMENT":
    case "DISCUSSION":
      return (
        <ReadingView state={state} participantId={participantId} sendAction={send} />
      );
    case "VOTING":
      return (
        <VotingView state={state} participantId={participantId} sendAction={send} />
      );
    case "REVEAL":
      return (
        <RevealView
          key={state.current_entry_id ?? "reveal"}
          state={state}
          sendAction={send}
        />
      );
    case "LEADERBOARD":
      return <LeaderboardView state={state} role={role} sendAction={send} />;
    case "WRAP_UP":
      return <WrapUpView state={state} role={role} sendAction={send} />;
    case "RESULTS":
      return <ResultsView state={state} role={role} sendAction={send} />;
    default:
      return (
        <p className="px-5 py-8 text-center font-body text-slate">Unknown phase.</p>
      );
  }
};

export default TheTruthIsProtocol;
