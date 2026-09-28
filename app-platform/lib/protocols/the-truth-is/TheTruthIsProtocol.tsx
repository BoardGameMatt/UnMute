"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { isSharedScreenName } from "@/lib/protocols/rank-and-file/engine";
import { BackToLobbyLink } from "@/components/session/back-to-lobby-link";
import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { SessionIdentityBanner } from "./components/SessionIdentityBanner";
import { LeaderboardView } from "./components/LeaderboardView";
import { ReadingView } from "./components/ReadingView";
import { ResultsView } from "./components/ResultsView";
import { RevealView } from "./components/RevealView";
import { SubmissionView } from "./components/SubmissionView";
import { TruthIsRoomDisplay } from "./components/TruthIsRoomDisplay";
import { VotingView } from "./components/VotingView";
import { WrapUpView } from "./components/WrapUpView";
import { useTruthIsPlay } from "./use-truth-is-play";

const TheTruthIsProtocol = ({ sessionId }: SessionProtocolProps) => {
  const router = useRouter();
  const { currentParticipant, roleInSession } = useSessionContext();
  const play = useTruthIsPlay(sessionId);
  const state = play.state;

  useEffect(() => {
    if (!state?.ended) return;
    router.replace(`/session/${sessionId}/feedback`);
  }, [router, sessionId, state?.ended]);

  if (!state) {
    return (
      <div className="px-5 py-12">
        <p className="text-center font-body text-slate" role={play.error ? "alert" : undefined}>
          {play.error ?? "Loading…"}
        </p>
        {play.error ? <BackToLobbyLink sessionId={sessionId} /> : null}
      </div>
    );
  }

  const roomDisplay = isSharedScreenName(currentParticipant.display_name);
  const showProgress =
    state.phase !== "SUBMISSION_1" &&
    state.phase !== "SUBMISSION_2" &&
    state.phase !== "RESULTS";

  return (
    <div className="min-h-screen bg-warm-white">
      <SessionIdentityBanner
        displayName={currentParticipant.display_name}
        roleInSession={roleInSession}
      />
      {showProgress ? <SessionProgressBar progress={state.progress} /> : null}
      {play.error ? (
        <p className="px-5 pt-4 text-center font-body text-sm text-signal-red" role="alert">
          {play.error}
        </p>
      ) : null}

      {roomDisplay &&
      (state.phase === "SUBMISSION_1" ||
        state.phase === "SUBMISSION_2" ||
        state.phase === "VOTING") ? (
        <TruthIsRoomDisplay state={state} />
      ) : null}
      {!roomDisplay && (state.phase === "SUBMISSION_1" || state.phase === "SUBMISSION_2") ? (
        <SubmissionView state={state} pending={play.pending} send={play.send} />
      ) : null}
      {state.phase === "DISCUSSION" ||
      state.phase === "READING_ASSIGNMENT" ||
      state.phase === "BLUFF_RULES" ? (
        <ReadingView state={state} pending={play.pending} send={play.send} />
      ) : null}
      {!roomDisplay && state.phase === "VOTING" ? (
        <VotingView state={state} pending={play.pending} send={play.send} />
      ) : null}
      {state.phase === "REVEAL" && state.reveal ? (
        <RevealView
          key={state.currentEntryId ?? `reveal-${state.currentRound}`}
          state={state}
          send={play.send}
        />
      ) : null}
      {state.phase === "LEADERBOARD" ? (
        <LeaderboardView state={state} pending={play.pending} send={play.send} />
      ) : null}
      {state.phase === "WRAP_UP" ? (
        <WrapUpView state={state} pending={play.pending} send={play.send} />
      ) : null}
      {state.phase === "RESULTS" ? (
        <ResultsView sessionId={sessionId} state={state} pending={play.pending} send={play.send} />
      ) : null}
    </div>
  );
};

export default TheTruthIsProtocol;
