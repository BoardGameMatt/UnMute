"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { useGameState, useSessionContext } from "@/components/providers/SessionProvider";
import { BackToLobbyLink } from "@/components/session/back-to-lobby-link";
import { createClient } from "@/lib/supabase/client";
import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { SessionIdentityBanner } from "@/lib/protocols/the-truth-is/components/SessionIdentityBanner";
import { BreakoutSetupView } from "./components/BreakoutSetupView";
import { DescribeView } from "./components/DescribeView";
import { FinalResultsView } from "./components/FinalResultsView";
import { ImageRevealView } from "./components/ImageRevealView";
import { LeaderboardView } from "./components/LeaderboardView";
import { MaterialsCheckView } from "./components/MaterialsCheckView";
import { RoundAggregateView } from "./components/RoundAggregateView";
import { RoundScoringView } from "./components/RoundScoringView";
import { TeamFormationView } from "./components/TeamFormationView";
import { TutorialResultsView } from "./components/TutorialResultsView";
import { TutorialScoringView } from "./components/TutorialScoringView";
import type { DibeCriterion, DibeImageCatalogEntry, DibeState } from "./types";
import { isDrawItByEarState } from "./types";

function parseCriteria(raw: unknown): DibeCriterion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is { text: string; points: number } =>
        c !== null &&
        typeof c === "object" &&
        typeof (c as { text?: unknown }).text === "string" &&
        typeof (c as { points?: unknown }).points === "number"
    )
    .map((c) => ({
      text: c.text,
      points: c.points as 1 | 2 | 3,
    }));
}

const DrawItByEarProtocol = ({
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
    if (isDrawItByEarState(stateJson)) return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: participantRows, error: participantErr } = await supabase
        .from("session_participants")
        .select("participant_id, participants ( id, display_name )")
        .eq("session_id", sessionId);

      if (cancelled) return;
      if (participantErr || !participantRows?.length) {
        setInitError("Could not load participants for this session.");
        return;
      }

      const { data: imageRows, error: imageErr } = await supabase
        .from("protocol_images")
        .select("id, name, criteria")
        .eq("protocol_slug", "draw-it-by-ear");

      if (cancelled) return;
      if (imageErr || !imageRows?.length) {
        setInitError("Could not load image library.");
        return;
      }

      const participants = (
        participantRows as {
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

      const imageCatalog: DibeImageCatalogEntry[] = imageRows.map((row) => ({
        id: row.id,
        name: row.name,
        criteria: parseCriteria(row.criteria),
      }));

      try {
        await send("initializeGame", { participants, imageCatalog });
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

  if (isLoading || !isDrawItByEarState(stateJson)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5 font-body text-slate">
        Loading…
      </div>
    );
  }

  const state = stateJson as DibeState;
  const showProgress =
    state.phase !== "MATERIALS_CHECK" && state.phase !== "FINAL_RESULTS";
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
          <PhaseBody
            state={state}
            sessionId={sessionId}
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
  state: DibeState;
  sessionId: string;
  participantId: string;
  role: SessionProtocolProps["role"];
  send: (actionType: string, payload: object) => Promise<void>;
};

const PhaseBody = ({ state, sessionId, participantId, role, send }: PhaseBodyProps) => {
  switch (state.phase) {
    case "MATERIALS_CHECK":
      return <MaterialsCheckView state={state} role={role} sendAction={send} />;
    case "TUTORIAL_DESCRIBE":
      return (
        <DescribeView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
          tutorial
        />
      );
    case "TUTORIAL_IMAGE_REVEAL":
      return (
        <ImageRevealView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
          heading="And here's the actual picture the describer was using."
        />
      );
    case "TUTORIAL_SCORING_1PT":
      return (
        <TutorialScoringView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "TUTORIAL_RESULTS":
      return (
        <TutorialResultsView state={state} role={role} sendAction={send} />
      );
    case "TEAM_FORMATION":
      return (
        <TeamFormationView
          state={state}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "BREAKOUT_SETUP":
      return (
        <BreakoutSetupView
          state={state}
          participantId={participantId}
          role={role}
          sendAction={send}
        />
      );
    case "ROUND_DESCRIBE":
      return (
        <DescribeView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "ROUND_IMAGE_REVEAL":
      return (
        <ImageRevealView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
          heading="And here's the actual picture the describer was using."
        />
      );
    case "ROUND_SCORING_1PT":
    case "ROUND_SCORING_2PT":
    case "ROUND_SCORING_3PT":
      return (
        <RoundScoringView
          state={state}
          sessionId={sessionId}
          participantId={participantId}
          sendAction={send}
        />
      );
    case "ROUND_AGGREGATE":
      return (
        <RoundAggregateView state={state} role={role} sendAction={send} />
      );
    case "LEADERBOARD":
      return <LeaderboardView state={state} role={role} sendAction={send} />;
    case "FINAL_RESULTS":
      return <FinalResultsView state={state} role={role} sendAction={send} />;
    default:
      return (
        <p className="px-5 py-8 text-center font-body text-slate">Unknown phase.</p>
      );
  }
};

export default DrawItByEarProtocol;
