"use client";

import { useEffect } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { TALK_TRACK_HOLD_SECONDS, TALK_TRACK_TURN_SECONDS } from "../engine";
import type { TalkTrackAction, TalkTrackPlayState } from "../types";
import { TrainOrder } from "./TrainOrder";
import { WordLadder } from "./WordLadder";

type Props = {
  state: TalkTrackPlayState;
  pending: boolean;
  error: string | null;
  send: (action: TalkTrackAction) => Promise<boolean>;
};

function Instruction({ text }: { text: string }) {
  return (
    <p className="text-center font-body text-sm text-slate">{text}</p>
  );
}

function TeamList({
  state,
  onNudge,
}: {
  state: TalkTrackPlayState;
  onNudge?: (teamId: string, delta: 1 | -1) => void;
}) {
  if (!state.scoresVisible && state.phase === "turn") return null;
  return (
    <ul className="flex flex-col gap-3">
      {state.teams.map((team) => (
        <li
          key={team.id}
          className="rounded-lg border border-cloud-grey bg-warm-white px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-unmute-navy">
                {team.name}
              </p>
              <p className="font-body text-sm text-slate">{team.memberNames.join(", ")}</p>
            </div>
            {state.scoresVisible ? (
              <div className="flex flex-col items-end gap-1">
                {onNudge ? (
                  <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
                    Facilitator
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                {onNudge ? (
                  <>
                    <button
                      type="button"
                      className="rounded-md border border-cloud-grey px-2 py-1 font-mono text-sm"
                      onClick={() => onNudge(team.id, -1)}
                    >
                      −
                    </button>
                    <span className="min-w-[2ch] text-center font-display text-2xl font-bold text-unmute-navy">
                      {team.score}
                    </span>
                    <button
                      type="button"
                      className="rounded-md border border-cloud-grey px-2 py-1 font-mono text-sm"
                      onClick={() => onNudge(team.id, 1)}
                    >
                      +
                    </button>
                  </>
                ) : (
                  <span className="font-display text-2xl font-bold text-unmute-navy">
                    {team.score}
                  </span>
                )}
                </div>
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TalkTrackViews({ state, pending, error, send }: Props) {
  useEffect(() => {
    if (state.phase !== "hold" && state.phase !== "team_reveal") return;
    if (state.paused || !state.hold) return;
    const started = Date.parse(state.hold.holdStartedAt);
    const wait = Math.max(0, started + TALK_TRACK_HOLD_SECONDS * 1000 - Date.now()) + 50;
    const id = window.setTimeout(() => {
      void send({ type: "advanceHold" });
    }, wait);
    return () => window.clearTimeout(id);
  }, [state.hold, state.paused, state.phase, send]);

  const nudge =
    state.isLead && (state.phase === "hold" || state.phase === "final_scores")
      ? (teamId: string, delta: 1 | -1) => {
          void send({ type: "nudge", teamId, delta });
        }
      : undefined;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col gap-6 px-5 py-6">
      <SessionProgressBar progress={state.progress} />
      <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Talk Track
      </p>
      <Instruction text={state.instruction} />
      {error ? (
        <p className="text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}

      {state.phase === "lobby" ? (
        <p className="text-center font-body text-slate">Waiting for the facilitator to start.</p>
      ) : null}

      {state.phase === "team_reveal" ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            Stay in this room.
          </h1>
          <p className="text-center font-body text-slate">We are not splitting into breakouts.</p>
          <TeamList state={{ ...state, scoresVisible: false }} />
          {state.isLead ? (
            <LeadHoldControls state={state} pending={pending} send={send} />
          ) : null}
        </>
      ) : null}

      {state.phase === "turn" && state.turn ? (
        <TurnView state={state} pending={pending} send={send} />
      ) : null}

      {state.phase === "hold" ? (
        <>
          <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
            {state.hold?.reason === "timer"
              ? "Time's up."
              : state.hold?.reason === "all_five"
                ? "All five."
                : "Turn over."}
          </h1>
          {state.hold?.turnPoints != null ? (
            <p className="text-center font-display text-xl text-unmute-navy">
              +{state.hold.turnPoints}
            </p>
          ) : null}
          <TeamList state={state} onNudge={nudge} />
          {state.isLead ? (
            <LeadHoldControls state={state} pending={pending} send={send} />
          ) : null}
        </>
      ) : null}

      {state.phase === "another_round" ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            Another round for every team?
          </h1>
          <p className="text-center font-body text-slate">
            One more round for every team — not just the team that just played.
          </p>
          <TeamList state={state} />
          {state.isLead ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={pending || !state.canDealAnotherCycle}
                onClick={() => void send({ type: "anotherRound", yes: true })}
                className="rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy disabled:opacity-40"
              >
                Yes — one more round
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void send({ type: "anotherRound", yes: false })}
                className="rounded-md border border-cloud-grey px-6 py-3 font-display font-semibold text-unmute-navy"
              >
                No — go to scores
              </button>
              {!state.canDealAnotherCycle ? (
                <p className="text-center font-body text-sm text-slate">
                  No unused cards left.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-center font-body text-slate">Waiting for the facilitator.</p>
          )}
        </>
      ) : null}

      {state.phase === "final_scores" ? (
        <>
          <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
            Final scores
          </h1>
          <TeamList state={state} onNudge={nudge} />
          {state.isLead ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void send({ type: "complete" })}
              className="rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <p className="text-center font-body text-slate">Waiting for the facilitator.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

function LeadHoldControls({
  state,
  pending,
  send,
}: {
  state: TalkTrackPlayState;
  pending: boolean;
  send: (action: TalkTrackAction) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {state.paused ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void send({ type: "resumeHold" })}
          className="rounded-md bg-signal-amber px-4 py-3 font-display font-semibold text-deep-navy"
        >
          Resume
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => void send({ type: "pauseHold" })}
          className="rounded-md border border-cloud-grey px-4 py-3 font-display font-semibold text-unmute-navy"
        >
          Pause
        </button>
      )}
    </div>
  );
}

function TurnView({
  state,
  pending,
  send,
}: {
  state: TalkTrackPlayState;
  pending: boolean;
  send: (action: TalkTrackAction) => Promise<boolean>;
}) {
  const turn = state.turn;
  if (!turn) return null;

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="font-display text-xl font-semibold text-unmute-navy">{turn.teamName}</p>
      <WaoPlayTimer
        durationSeconds={TALK_TRACK_TURN_SECONDS}
        startedAt={turn.startedAt}
        onComplete={() => {
          void send({ type: "timerExpired" });
        }}
      />
      <p className="font-body text-sm text-slate">
        Guesser: <span className="font-semibold text-unmute-navy">{turn.guesserName}</span>
      </p>
      {turn.words ? (
        <div className="w-full">
          <WordLadder words={turn.words} currentSlot={turn.slot} />
        </div>
      ) : (
        <p className="font-display text-lg text-unmute-navy">
          {turn.subphase === "guessing" ? "Guess. They cannot help." : "Listen."}
        </p>
      )}
      <TrainOrder
        members={turn.train.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          isStarter: member.isStarter,
        }))}
        caption="Clue Train"
      />
      {state.spectatorInstruction && state.viewerRole === "spectator" ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          {state.spectatorInstruction}
        </p>
      ) : null}
      {turn.canStop ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void send({ type: "stop" })}
          className="w-full rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy disabled:opacity-40"
        >
          Stop
        </button>
      ) : null}
      {turn.canResolve ? (
        <div className="flex w-full gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => void send({ type: "resolve", outcome: "got_it" })}
            className="flex-1 rounded-md bg-signal-amber px-4 py-4 font-display font-semibold text-deep-navy disabled:opacity-40"
          >
            Got it
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void send({ type: "resolve", outcome: "pass" })}
            className="flex-1 rounded-md border border-cloud-grey px-4 py-4 font-display font-semibold text-unmute-navy disabled:opacity-40"
          >
            Pass
          </button>
        </div>
      ) : null}
    </div>
  );
}
