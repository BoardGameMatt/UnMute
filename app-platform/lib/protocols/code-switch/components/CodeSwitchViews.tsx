"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { roundTypeLabel, roundTypeRule } from "../engine";
import type { CodeSwitchAction, CodeSwitchPlayState } from "../types";

type Props = {
  sessionId: string;
  state: CodeSwitchPlayState;
  pending: boolean;
  error: string | null;
  send: (action: CodeSwitchAction) => Promise<boolean>;
  isDisplay: boolean;
  pinDisplay: (pinned: boolean) => void;
};

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-signal-amber px-4 py-3 font-display text-base font-semibold text-deep-navy transition-colors hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NavyButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-md bg-unmute-navy px-4 py-3 font-display text-base font-semibold text-white transition-colors hover:bg-deep-navy disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ClueTiles({ clues }: { clues: string[] }) {
  if (clues.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-unmute-navy bg-warm-white px-4 py-6 text-center font-body text-slate">
        No clues made it through.
      </div>
    );
  }
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {clues.map((clue) => (
        <li
          key={clue}
          className="rounded-lg border border-unmute-navy/20 bg-warm-white px-4 py-3 font-display text-lg font-semibold text-unmute-navy"
        >
          {clue}
        </li>
      ))}
    </ul>
  );
}

export function CodeSwitchViews({
  sessionId,
  state,
  pending,
  error,
  send,
  isDisplay,
  pinDisplay,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [wrapConfirm, setWrapConfirm] = useState(false);
  const showLead = state.isLead && !isDisplay;

  useEffect(() => {
    setDraft("");
  }, [state.roundIndex, state.phase, state.writeStartedAt, state.guessStartedAt]);
  const showTimer =
    (state.phase === "write" && state.writeStartedAt) ||
    (state.phase === "guess" && state.guessStartedAt);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-5">
      <SessionProgressBar progress={state.progress} />
      <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        SwitchCode
      </p>

      {showTimer && state.timerSeconds ? (
        <div className="flex justify-center">
          <WaoPlayTimer
            durationSeconds={state.timerSeconds}
            startedAt={state.phase === "write" ? state.writeStartedAt : state.guessStartedAt}
            onComplete={() => {
              void send({ type: "timerExpired" });
            }}
          />
        </div>
      ) : null}

      {state.persistentInstruction && !(state.phase === "write" && state.roundType) ? (
        <p className="text-center font-body text-sm text-charcoal">{state.persistentInstruction}</p>
      ) : null}

      {state.phase === "write" ? (
        <>
          <p className="text-center font-body text-slate">
            {state.guesserName} is guessing. {state.lockedCount}/{state.clueGiverCount} locked in.
          </p>
          {state.word && state.roundType ? (
            <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
              <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-unmute-navy">
                {roundTypeLabel(state.roundType)}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-charcoal">
                {roundTypeRule(state.roundType)}
              </p>
              <p className="mt-3 font-body text-xs text-slate">Don’t say the type out loud.</p>
              <p className="mt-5 font-display text-3xl font-bold text-unmute-navy">{state.word}</p>
              {state.myClueLocked ? (
                <p className="mt-4 font-body text-slate">Locked in.</p>
              ) : (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send({ type: "lockClue", text: draft }).then((ok) => {
                      if (ok) setDraft("");
                    });
                  }}
                >
                  <input
                    key={`clue-${state.roundIndex}-${state.writeStartedAt ?? ""}`}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={32}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className={`w-full rounded-md border bg-warm-white px-3 py-3 font-display text-lg text-unmute-navy ${
                      draft.trim()
                        ? "border-2 border-unmute-navy"
                        : "border border-unmute-navy/20"
                    }`}
                    placeholder="One word"
                  />
                  <PrimaryButton
                    disabled={pending || !draft.trim()}
                    onClick={() => {
                      void send({ type: "lockClue", text: draft }).then((ok) => {
                        if (ok) setDraft("");
                      });
                    }}
                  >
                    Lock in
                  </PrimaryButton>
                </form>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-cloud-grey bg-unmute-navy p-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-sunrise-gold">
                You’re guessing
              </p>
              <p className="mt-2 font-body text-warm-white">{state.instruction}</p>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {state.roster.map((chip) => (
              <span
                key={chip.participantId}
                className={`rounded-full px-3 py-1 font-body text-sm ${
                  chip.locked
                    ? "bg-unmute-navy text-white"
                    : "border border-cloud-grey bg-warm-white text-charcoal"
                }`}
              >
                {chip.displayName}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {state.phase === "guess" ? (
        <>
          <ClueTiles clues={state.filteredClues} />
          {state.viewerRole === "guesser" && !isDisplay ? (
            state.myGuessLocked ? (
              <p className="text-center font-body text-slate">Locked in.</p>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send({ type: "lockGuess", text: draft });
                }}
              >
                <input
                  key={`guess-${state.roundIndex}-${state.guessStartedAt ?? ""}`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={40}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className={`w-full rounded-md border bg-warm-white px-3 py-3 font-display text-lg text-unmute-navy ${
                    draft.trim()
                      ? "border-2 border-unmute-navy"
                      : "border border-unmute-navy/20"
                  }`}
                  placeholder="Your guess"
                />
                <PrimaryButton
                  disabled={pending || !draft.trim()}
                  onClick={() => {
                    void send({ type: "lockGuess", text: draft });
                  }}
                >
                  Lock in
                </PrimaryButton>
              </form>
            )
          ) : (
            <p className="text-center font-body text-slate">{state.instruction}</p>
          )}
        </>
      ) : null}

      {state.phase === "reveal" ? (
        <>
          <div className="rounded-lg border border-cloud-grey bg-warm-white p-6 text-center">
            {state.abandoned ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                  Round skipped
                </p>
                <p className="mt-2 font-body text-charcoal">{state.instruction}</p>
              </>
            ) : (
              <>
                <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                  {state.isHit ? "Got it" : "Miss"}
                </p>
                <p className="mt-2 font-display text-3xl font-bold text-unmute-navy">
                  {state.targetWord}
                </p>
                <p className="mt-2 font-body text-slate">
                  Guess: {state.guessText?.trim() ? state.guessText : "—"}
                </p>
                {state.isHit ? (
                  <p className="mt-2 font-display text-xl text-unmute-navy" aria-hidden="true">
                    ✓
                  </p>
                ) : null}
              </>
            )}
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              Team score
            </p>
            <p className="font-display text-4xl font-bold text-unmute-navy">{state.teamScore}</p>
          </div>
          {state.abandoned ? null : <ClueTiles clues={state.filteredClues} />}
          {state.breakdown ? (
            <ul className="space-y-2">
              {state.breakdown.map((row) => (
                <li
                  key={`${row.displayName}-${row.text}`}
                  className={`rounded-lg border bg-warm-white px-4 py-3 ${
                    row.survived
                      ? "border-2 border-unmute-navy"
                      : "border border-dashed border-unmute-navy"
                  }`}
                >
                  <p className="font-display font-semibold text-unmute-navy">{row.text}</p>
                  <p className="font-body text-sm text-slate">
                    {row.displayName}
                    {row.isMine ? " · yours" : ""}
                    {row.survived ? " · shown" : " · filtered"}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {showLead ? (
            <div className="space-y-3">
              <PrimaryButton
                disabled={pending || !state.canAnotherRound}
                onClick={() => {
                  setDraft("");
                  setWrapConfirm(false);
                  void send({ type: "anotherRound" });
                }}
              >
                Another round
              </PrimaryButton>
              {wrapConfirm ? (
                <NavyButton
                  disabled={pending}
                  onClick={() => {
                    void send({ type: "wrap" });
                  }}
                >
                  Confirm wrap
                </NavyButton>
              ) : (
                <NavyButton disabled={pending} onClick={() => setWrapConfirm(true)}>
                  Wrap things up
                </NavyButton>
              )}
            </div>
          ) : (
            <p className="text-center font-body text-slate">Waiting for the facilitator.</p>
          )}
        </>
      ) : null}

      {state.phase === "scoreboard" ? (
        <>
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              Team score
            </p>
            <p className="font-display text-5xl font-bold text-unmute-navy">{state.teamScore}</p>
          </div>
          {state.shownTheMostName ? (
            <p className="text-center font-body text-charcoal">
              <span className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                Shown the most
              </span>
              <br />
              {state.shownTheMostName}
            </p>
          ) : null}
          <ol className="space-y-2">
            {state.shownLeaderboard.map((row, index) => (
              <li
                key={row.participantId}
                className={`flex items-center justify-between rounded-lg border bg-warm-white px-4 py-3 ${
                  row.displayName === state.rateLeaderName
                    ? "border-2 border-unmute-navy"
                    : "border-cloud-grey"
                }`}
              >
                <span className="font-display font-semibold text-unmute-navy">
                  {index + 1}. {row.displayName}
                </span>
                <span className="font-mono text-sm text-unmute-navy">
                  {Math.round(row.shownRate * 100)}% · {row.shownCount}
                </span>
              </li>
            ))}
          </ol>
          {showLead ? (
            <PrimaryButton
              disabled={pending || !state.canAdvanceRecap}
              onClick={() => {
                void send({ type: "advanceRecap" }).then((ok) => {
                  if (ok) router.replace(`/session/${sessionId}/feedback`);
                });
              }}
            >
              Continue to debrief
            </PrimaryButton>
          ) : (
            <p className="text-center font-body text-slate">
              Waiting for the facilitator to continue.
            </p>
          )}
        </>
      ) : null}

      {showLead && state.phase !== "scoreboard" ? (
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Facilitator
          </p>
          <p className="mt-2 font-body text-sm text-slate">
            Round {state.roundIndex} · {state.lockedCount}/{state.clueGiverCount} locked ·{" "}
            {state.remainingWords} words left
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-md border border-cloud-grey px-3 py-2 font-display text-sm text-unmute-navy"
            onClick={() => pinDisplay(true)}
          >
            This is the shared screen
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
