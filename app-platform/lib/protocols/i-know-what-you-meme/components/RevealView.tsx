"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { TimerArc } from "@/components/ui/TimerArc";
import type { SessionParticipantRole } from "@/lib/types/database";
import { REVEAL_TIMER_MS } from "../engine";
import type { IKWYMState } from "../types";

type RevealViewProps = {
  state: IKWYMState;
  participantId: string;
  role: SessionParticipantRole;
  sendAction: (type: string, payload: object) => Promise<void>;
};

export const RevealView = ({
  state,
  participantId,
  role,
  sendAction,
}: RevealViewProps) => {
  const [selected, setSelected] = useState<string>("");
  const [locked, setLocked] = useState(false);

  const current = state.revealQueue[state.revealIndex];
  const ownerId = current?.participantId ?? null;
  const ownerName = state.participants.find((p) => p.id === ownerId)?.display_name;
  const isOwner = ownerId === participantId;

  const guessOptions = useMemo(
    () => state.participants.filter((p) => p.id !== participantId),
    [state.participants, participantId]
  );

  const timerStartedAt = state.timerStart
    ? new Date(state.timerStart).toISOString()
    : null;

  const handleLockIn = useCallback(async () => {
    if (!selected || locked || state.roundResolved || isOwner) return;
    setLocked(true);
    await sendAction("ikwym/submit_guess", {
      participantId,
      guessedParticipantId: selected,
      revealIndex: state.revealIndex,
    });
  }, [
    selected,
    locked,
    state.roundResolved,
    isOwner,
    sendAction,
    participantId,
    state.revealIndex,
  ]);

  const handleTimerComplete = useCallback(async () => {
    if (state.roundResolved) return;
    await sendAction("ikwym/guess_timer_expired", {});
  }, [sendAction, state.roundResolved]);

  const isLastReveal = state.revealIndex >= state.revealQueue.length - 1;

  let lockClass =
    "mt-6 w-full rounded-md px-5 py-4 font-display text-base font-semibold transition-colors duration-200";
  if (locked || state.roundResolved) {
    lockClass += " bg-signal-amber text-deep-navy";
  } else if (selected) {
    lockClass += " bg-unmute-navy text-warm-white hover:bg-deep-navy";
  } else {
    lockClass += " cursor-not-allowed bg-cloud-grey text-slate opacity-40";
  }

  const correctGuessersNonBluff = useMemo(() => {
    if (!ownerId) return [];
    const key = String(state.revealIndex);
    const guesses = state.guesses[key] ?? {};
    return state.participants.filter(
      (p) => p.id !== ownerId && guesses[p.id] === ownerId
    );
  }, [state.guesses, state.revealIndex, state.participants, ownerId]);

  return (
    <div className="min-h-[70vh] px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        WHO PICKED THIS?
      </p>
      <p className="mt-2 text-center font-mono text-xs uppercase tracking-widest text-slate">
        GIF {state.revealIndex + 1} of {state.revealQueue.length}
      </p>

      {current ? (
        <p className="mx-auto mt-4 max-w-lg text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          {current.promptLabel}
        </p>
      ) : null}

      {current ? (
        <div className="mx-auto mt-4 max-w-lg overflow-hidden rounded-lg border border-cloud-grey bg-warm-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.gifUrl}
            alt="GIF to guess"
            className="max-h-[40vh] w-full object-contain"
          />
        </div>
      ) : null}

      {!state.roundResolved ? (
        <>
          {isOwner ? (
            <motion.div
              className="mx-auto mt-8 max-w-md"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="rounded-md bg-deep-navy px-4 py-3 text-center font-mono text-xs font-normal leading-relaxed text-warm-white">
                Your GIF is up — see if they can figure it out.
              </div>
              <p className="mt-6 text-center font-body text-sm text-slate">
                Hang tight while everyone guesses.
              </p>
            </motion.div>
          ) : (
            <>
              <p className="mt-6 text-center font-display text-lg font-medium text-charcoal">
                Who picked this GIF?
              </p>

              <div className="mx-auto mt-6 max-w-md">
                <label htmlFor="guess-select" className="sr-only">
                  Select team member
                </label>
                <select
                  id="guess-select"
                  value={selected}
                  disabled={locked}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full rounded-md border border-cloud-grey bg-warm-white px-4 py-3 font-body text-base text-charcoal focus:border-unmute-navy focus:outline-none"
                >
                  <option value="">Choose a name…</option>
                  {guessOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={!selected || locked}
                onClick={() => void handleLockIn()}
                className={lockClass}
              >
                {locked ? "Guess locked" : "Lock In"}
              </button>
            </>
          )}

          <div className="mt-8 flex justify-center">
            <TimerArc
              durationSeconds={REVEAL_TIMER_MS / 1000}
              startedAt={timerStartedAt}
              onComplete={() => void handleTimerComplete()}
              size={120}
            />
          </div>
        </>
      ) : (
        <motion.div
          className="mx-auto mt-8 max-w-md space-y-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
            POINTS THIS ROUND
          </p>

          <div className="rounded-md bg-deep-navy px-4 py-3 text-center font-mono text-xs font-normal leading-relaxed text-warm-white">
            {isOwner
              ? "That was your GIF."
              : `${ownerName ?? "Someone"} picked this GIF.`}
          </div>

          {isOwner ? (
            <p className="text-center font-body text-base text-slate">
              Let&apos;s see who figured it out.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-center font-body text-base text-charcoal">
              {correctGuessersNonBluff.length === 0 ? (
                <p className="text-slate">No one guessed correctly this round.</p>
              ) : (
                correctGuessersNonBluff.map((g) => (
                  <p key={g.id}>
                    <span className="font-medium">{g.display_name}</span> guessed right!{" "}
                    <span className="font-mono text-signal-amber">+1</span>
                  </p>
                ))
              )}
            </div>
          )}

          <ul className="space-y-2 rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
            {state.participants.map((p) => {
              if (p.id === ownerId) return null;
              const key = String(state.revealIndex);
              const guess = state.guesses[key]?.[p.id];
              const correct = guess === ownerId;
              const isSelf = p.id === participantId;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between font-body text-sm ${
                    isSelf && correct
                      ? "text-unmute-navy"
                      : isSelf && guess
                        ? "text-signal-red"
                        : "text-charcoal"
                  }`}
                >
                  <span>{p.display_name}</span>
                  <span className="font-mono text-xs uppercase tracking-widest">
                    {guess ? (correct ? "Correct +1" : "Incorrect") : "No guess"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="rounded-lg border border-cloud-grey bg-warm-white p-4 shadow-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              Running scores
            </p>
            <ul className="mt-2 space-y-1">
              {state.participants.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between font-body text-sm text-charcoal"
                >
                  <span>{p.display_name}</span>
                  <span className="font-mono text-xs">{state.scores[p.id] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>

          {role === "lead" ? (
            <button
              type="button"
              onClick={() => void sendAction("ikwym/next_reveal", { role })}
              className="w-full rounded-md bg-signal-amber px-5 py-4 font-display text-base font-semibold text-deep-navy hover:bg-sunrise-gold"
            >
              {isLastReveal ? "See Final Scores" : "Next GIF"}
            </button>
          ) : null}
        </motion.div>
      )}
    </div>
  );
};
