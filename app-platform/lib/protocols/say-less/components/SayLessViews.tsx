"use client";

import { useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import {
  SAY_LESS_HOLD_SECONDS,
  SAY_LESS_PREVIEW_SECONDS,
  SAY_LESS_TURN_SECONDS,
  canPassInRound,
} from "../engine";
import type { SayLessAction, SayLessPlayState } from "../types";
import { SayLessCardFace } from "./SayLessCardFace";
import { SayLessTurnControls } from "./SayLessTurnControls";

type Props = {
  state: SayLessPlayState;
  pending: boolean;
  error: string | null;
  send: (action: SayLessAction) => Promise<boolean>;
};

function Instruction({ text }: { text: string }) {
  return <p className="text-center font-body text-sm text-slate">{text}</p>;
}

function TeamBoards({
  state,
  pending,
  onSwap,
}: {
  state: SayLessPlayState;
  pending: boolean;
  onSwap?: (a: string, b: string) => void;
}) {
  const [selected, setSelected] = useState<{ id: string; teamId: string } | null>(null);

  const tap = (participantId: string, teamId: string) => {
    if (!onSwap || pending) return;
    if (!selected) {
      setSelected({ id: participantId, teamId });
      return;
    }
    if (selected.id === participantId) {
      setSelected(null);
      return;
    }
    if (selected.teamId === teamId) {
      setSelected({ id: participantId, teamId });
      return;
    }
    onSwap(selected.id, participantId);
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-4">
        {state.teams.map((team) => (
          <li key={team.id} className="rounded-lg border border-cloud-grey bg-warm-white p-6">
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
              {team.name}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {team.members.map((member) => {
                const label = `${member.displayName}${member.id === state.participantId ? " (you)" : ""}`;
                const isSel = selected?.id === member.id;
                return (
                  <li key={member.id}>
                    {onSwap ? (
                      <button
                        type="button"
                        onClick={() => tap(member.id, team.id)}
                        disabled={pending}
                        aria-pressed={isSel}
                        className={`w-full rounded-md px-3 py-2 text-left font-body text-base text-charcoal transition-colors duration-200 ${
                          isSel
                            ? "border-2 border-unmute-navy"
                            : "border-2 border-transparent hover:bg-cloud-grey"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {label}
                      </button>
                    ) : (
                      <p className="px-3 py-1 font-body text-base text-charcoal">{label}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {onSwap ? (
        <p className="text-center font-body text-sm text-slate">
          {selected
            ? "Now tap someone on the other team to switch them."
            : "To switch two people, tap a name, then a name on the other team."}
        </p>
      ) : null}
    </div>
  );
}

function ScoreBoard({ scores }: { scores: SayLessPlayState["scores"] }) {
  if (!scores) return null;
  return (
    <div className="grid grid-cols-2 gap-4">
      {scores.map((team) => (
        <div
          key={team.label}
          className="rounded-lg border border-cloud-grey bg-warm-white px-5 py-6 text-center"
        >
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
            {team.name}
          </p>
          <p className="mt-2 font-display text-4xl font-bold text-unmute-navy">{team.score}</p>
        </div>
      ))}
    </div>
  );
}

function clueLine(state: SayLessPlayState): string | null {
  if (!state.clueGiverName) return null;
  const giver = state.viewerRole === "clue" ? "You are" : `${state.clueGiverName} is`;
  const guessers = state.guesserNames;
  if (guessers.length === 0) return `${giver} giving clues`;
  const list =
    guessers.length === 1
      ? guessers[0]
      : `${guessers.slice(0, -1).join(", ")} and ${guessers[guessers.length - 1]}`;
  return `${giver} giving clues to ${list}`;
}

export function SayLessViews({ state, pending, error, send }: Props) {
  useEffect(() => {
    if (state.paused) return;
    if (state.phase !== "preview" && state.phase !== "turn" && state.phase !== "hold") return;
    if (!state.deadlineAt) return;
    const wait = Math.max(0, Date.parse(state.deadlineAt) - Date.now()) + 50;
    const id = window.setTimeout(() => {
      void send({ type: "advance" });
    }, wait);
    return () => window.clearTimeout(id);
  }, [state.deadlineAt, state.paused, state.phase, send]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col gap-6 px-5 py-6">
      <SessionProgressBar progress={state.progress} />
      <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Say Less
      </p>
      <Instruction text={state.instruction} />
      {state.roleLine ? <Instruction text={state.roleLine} /> : null}
      {error ? (
        <p className="text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}

      {state.phase === "lobby" ? (
        <p className="text-center font-body text-slate">Waiting for the facilitator to start.</p>
      ) : null}

      {state.phase === "teams" ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            Mix departments across both teams.
          </h1>
          <TeamBoards
            state={state}
            pending={pending}
            onSwap={
              state.isLead
                ? (a, b) => {
                    void send({ type: "swapPlayers", a, b });
                  }
                : undefined
            }
          />
          {state.isLead ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void send({ type: "confirmTeams" })}
              className="rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy disabled:opacity-40"
            >
              Confirm teams
            </button>
          ) : (
            <p className="text-center font-body text-slate">Waiting for the facilitator.</p>
          )}
        </>
      ) : null}

      {state.phase === "preview" ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            A preview of the deck
          </h1>
          <p className="-mt-3 text-center font-body text-slate">
            These cards will come up in play. Remember them.
          </p>
          <WaoPlayTimer
            durationSeconds={SAY_LESS_PREVIEW_SECONDS}
            startedAt={state.startedAt}
            onComplete={() => {
              void send({ type: "advance" });
            }}
            retryMs={2000}
          />
          <div className="flex flex-col gap-4">
            {(state.previewCards ?? []).map((card) => (
              <SayLessCardFace key={card.id} card={card} />
            ))}
          </div>
        </>
      ) : null}

      {state.phase === "ready" ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            Round 1. Describe freely.
          </h1>
          {state.isLead ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void send({ type: "startRound" })}
              className="rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy disabled:opacity-40"
            >
              Start round 1
            </button>
          ) : (
            <p className="text-center font-body text-slate">Waiting for the facilitator.</p>
          )}
        </>
      ) : null}

      {state.phase === "turn" ? <TurnView state={state} pending={pending} send={send} /> : null}

      {state.phase === "hold" ? (
        <>
          <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
            {state.lastEndReason === "timer"
              ? "Time's up."
              : state.lastEndReason === "pile_empty"
                ? "Deck is clear."
                : state.lastEndReason === "skipped"
                  ? "Turn skipped."
                  : "Turn over."}
          </h1>
          {state.cardsGotThisTurn != null ? (
            <p className="text-center font-display text-xl text-unmute-navy">
              +{state.cardsGotThisTurn} this turn
            </p>
          ) : null}
          <p className="text-center font-body text-slate">
            {state.cardsLeft} of 20 left
            {state.nextClueGiverName ? ` · Next: ${state.nextClueGiverName}` : ""}
          </p>
          {!state.paused ? (
            <WaoPlayTimer
              durationSeconds={SAY_LESS_HOLD_SECONDS}
              startedAt={state.startedAt}
              onComplete={() => {
                void send({ type: "advance" });
              }}
              retryMs={2000}
            />
          ) : (
            <p className="text-center font-body text-slate">Paused.</p>
          )}
          {state.isLead ? <LeadHoldControls state={state} pending={pending} send={send} /> : null}
        </>
      ) : null}

      {state.phase === "round_break" ? (
        <>
          <h1 className="text-center font-display text-2xl font-bold text-unmute-navy">
            Same cards. One word only.
          </h1>
          {state.hostLine && state.isLead ? (
            <p className="text-center font-body text-slate">{state.hostLine}</p>
          ) : null}
          <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
            Round 1 score
          </p>
          <ScoreBoard scores={state.scores} />
          {state.isLead ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void send({ type: "startRound" })}
              className="rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy disabled:opacity-40"
            >
              Start round 2
            </button>
          ) : (
            <p className="text-center font-body text-slate">Waiting for the facilitator.</p>
          )}
        </>
      ) : null}

      {state.phase === "final_scores" ? (
        <>
          <h1 className="text-center font-display text-3xl font-bold text-unmute-navy">
            {state.winner === "tie"
              ? "It's a tie!"
              : state.winner
                ? `Team ${state.winner} wins!`
                : "Final score"}
          </h1>
          <ScoreBoard scores={state.scores} />
          {state.hostLine && state.isLead ? (
            <p className="text-center font-body text-slate">{state.hostLine}</p>
          ) : null}
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
  state: SayLessPlayState;
  pending: boolean;
  send: (action: SayLessAction) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Facilitator · Round {state.round} · {state.turnsThisRound} turns · {state.cardsLeft} left
      </p>
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
      <button
        type="button"
        disabled={pending}
        onClick={() => void send({ type: "endRound" })}
        className="rounded-md border border-cloud-grey px-4 py-3 font-display font-semibold text-unmute-navy"
      >
        End round now
      </button>
    </div>
  );
}

function TurnView({
  state,
  pending,
  send,
}: {
  state: SayLessPlayState;
  pending: boolean;
  send: (action: SayLessAction) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {clueLine(state) ? (
        <p className="text-center font-display text-xl font-semibold text-unmute-navy">
          {clueLine(state)}
        </p>
      ) : null}
      <p className="font-body text-sm text-slate">{state.cardsLeft} of 20 left</p>
      <WaoPlayTimer
        durationSeconds={SAY_LESS_TURN_SECONDS}
        startedAt={state.startedAt}
        onComplete={() => {
          void send({ type: "advance" });
        }}
        retryMs={2000}
      />
      {state.currentCard ? (
        <div className="w-full">
          <SayLessCardFace card={state.currentCard} hintOnTap />
        </div>
      ) : null}
      {state.canActOnCard && state.currentCard ? (
        <div className="w-full">
          <SayLessTurnControls
            disabled={pending}
            passBlocked={!canPassInRound(state.round)}
            onGotIt={() => {
              void send({
                type: "cardAction",
                outcome: "got_it",
                cardId: state.currentCard!.id,
              });
            }}
            onPass={() => {
              void send({
                type: "cardAction",
                outcome: "pass",
                cardId: state.currentCard!.id,
              });
            }}
          />
        </div>
      ) : null}
      {state.canSkipTurn ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void send({ type: "skipTurn" })}
          className="text-center font-body text-sm text-slate underline-offset-2 hover:underline disabled:opacity-40"
        >
          Skip turn
        </button>
      ) : null}
    </div>
  );
}
