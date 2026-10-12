"use client";

import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import type { SessionProtocolProps } from "@/lib/protocols/registry";
import type { AirtimePlayState, Choice } from "./types";
import { AirtimeBoatsAndRules } from "./components/AirtimeBoatsAndRules";
import { END_BANNER, Banner, ProtocolLabel, isBefore, useServerNow } from "./components/AirtimeChrome";
import { AirtimeCrewView } from "./components/AirtimeCrewView";
import { AirtimeDiverView } from "./components/AirtimeDiverView";
import { AirtimeFinal } from "./components/AirtimeFinal";
import { AirtimeResults } from "./components/AirtimeResults";
import { AirtimeSharedScreen } from "./components/AirtimeSharedScreen";
import { AirtimeTurnTimer } from "./components/AirtimeTurnTimer";
import { AirtimeWaitingView } from "./components/AirtimeWaitingView";
import { useAirtimePlay } from "./use-airtime-play";

type PhoneProps = {
  state: AirtimePlayState;
  now: number;
  clockOffsetMs: number;
  pending: boolean;
  onChoose: (choice: Choice) => void;
  onExpire: () => void;
};

const PhoneDive = ({ state, now, clockOffsetMs, pending, onChoose, onExpire }: PhoneProps) => {
  const closesAt = state.windowOpensAt
    ? new Date(new Date(state.windowOpensAt).getTime() + state.turnSeconds * 1000).toISOString()
    : null;
  const windowState = isBefore(now, state.windowOpensAt)
    ? "beat"
    : isBefore(now, closesAt)
      ? "open"
      : "closed";
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <ProtocolLabel dive={state.diveNumber} />
        {state.viewerRole !== "waiting" ? (
          <AirtimeTurnTimer
            windowOpensAt={state.windowOpensAt}
            turnSeconds={state.turnSeconds}
            turn={state.turn}
            now={now}
            clockOffsetMs={clockOffsetMs}
            onExpire={onExpire}
            size={72}
          />
        ) : null}
      </div>
      {isBefore(now, state.endBannerUntil) ? <Banner tone="amber">{END_BANNER}</Banner> : null}

      {state.viewerRole === "diver" && state.diver ? (
        <AirtimeDiverView diver={state.diver} windowState={windowState} pending={pending} onChoose={onChoose} />
      ) : state.viewerRole === "crew" && state.crew ? (
        <AirtimeCrewView crew={state.crew} myResult={state.myResult} meId={state.me?.participantId ?? null} />
      ) : state.viewerRole === "waiting" ? (
        <AirtimeWaitingView myResult={state.myResult} />
      ) : (
        <p className="font-body text-base text-slate">A dive is underway. Watch the shared screen.</p>
      )}
    </div>
  );
};

const AirtimeProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useAirtimePlay(sessionId);
  const { state, clockOffsetMs, pending, send } = play;
  const now = useServerNow(clockOffsetMs);

  if (!state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading Airtime…"}</p>
      </div>
    );
  }

  const expire = () => void send({ type: "timerExpired" });

  if (state.isDisplay) {
    return (
      <>
        <SessionProgressBar progress={state.progress} className="fixed left-0 right-0 top-0 z-40" />
        <div className="mx-auto w-full max-w-6xl px-8 py-12">
          <AirtimeSharedScreen state={state} now={now} clockOffsetMs={clockOffsetMs} pending={pending} send={send} />
          {play.error ? <p className="mt-4 font-body text-sm text-signal-red">{play.error}</p> : null}
        </div>
      </>
    );
  }

  const meId = state.me?.participantId ?? null;

  return (
    <>
      <SessionProgressBar progress={state.progress} className="fixed left-0 right-0 top-0 z-40" />
      <div className="mx-auto w-full max-w-md px-5 py-6">
        {state.phase === "boats" || state.phase === "rules" ? (
          <AirtimeBoatsAndRules state={state} clockOffsetMs={clockOffsetMs} onRulesExpire={expire} />
        ) : state.phase === "dive_active" ? (
          <PhoneDive
            state={state}
            now={now}
            clockOffsetMs={clockOffsetMs}
            pending={pending}
            onChoose={(choice) => void send({ type: "choose", choice, turn: state.turn })}
            onExpire={expire}
          />
        ) : state.phase === "dive_results" && state.results ? (
          <div className="space-y-5">
            <ProtocolLabel dive={state.diveNumber} />
            <AirtimeResults results={state.results} meId={meId} />
            <p className="text-center font-body text-sm text-slate">The facilitator picks what&apos;s next.</p>
          </div>
        ) : state.phase === "final" && state.final ? (
          <div className="space-y-5">
            <ProtocolLabel />
            <AirtimeFinal final={state.final} meId={meId} />
          </div>
        ) : (
          <p className="font-body text-slate">Loading…</p>
        )}
        {play.error ? <p className="mt-4 font-body text-sm text-signal-red">{play.error}</p> : null}
      </div>
    </>
  );
};

export default AirtimeProtocol;
