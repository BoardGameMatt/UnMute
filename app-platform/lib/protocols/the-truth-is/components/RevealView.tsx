"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeRoundScores } from "../engine";
import type { TruthIsState } from "../types";

type RevealViewProps = {
  state: TruthIsState;
  sendAction: (type: string, payload: object) => Promise<void>;
};

type Step = "votes" | "slot" | "landed" | "correct";

export const RevealView = ({ state, sendAction }: RevealViewProps) => {
  const [step, setStep] = useState<Step>("votes");
  const sentRef = useRef(false);

  const author = useMemo(
    () => state.participants.find((p) => p.id === state.current_author_id),
    [state.participants, state.current_author_id]
  );

  const readerIsAuthor = useMemo(
    () =>
      state.current_reader_id !== null &&
      state.current_reader_id === state.current_author_id,
    [state.current_reader_id, state.current_author_id]
  );

  const roundScores = useMemo(() => computeRoundScores(state), [state]);

  const voteRows = useMemo(() => {
    const rows: { voter: string; guess: string }[] = [];
    for (const [voterId, guessedId] of Object.entries(state.votes_this_round)) {
      const voter = state.participants.find((p) => p.id === voterId);
      const guess = state.participants.find((p) => p.id === guessedId);
      if (voter && guess) {
        rows.push({ voter: voter.display_name, guess: guess.display_name });
      }
    }
    return rows;
  }, [state.votes_this_round, state.participants]);

  const names = useMemo(
    () => state.participants.map((p) => p.display_name),
    [state.participants]
  );

  const authorName = author?.display_name ?? "";

  const correctGuessersNonBluff = useMemo(() => {
    const aid = state.current_author_id;
    if (!aid) return [] as { id: string; displayName: string }[];
    const out: { id: string; displayName: string }[] = [];
    for (const [voterId, guessed] of Object.entries(state.votes_this_round)) {
      if (guessed === aid) {
        const p = state.participants.find((x) => x.id === voterId);
        if (p) out.push({ id: voterId, displayName: p.display_name });
      }
    }
    return out;
  }, [state.votes_this_round, state.current_author_id, state.participants]);

  const fooledDisplay = useMemo(() => {
    return roundScores.fooledVoterIds.map((id) => {
      const p = state.participants.find((x) => x.id === id);
      return { id, displayName: p?.display_name ?? "?" };
    });
  }, [roundScores.fooledVoterIds, state.participants]);

  const caughtDisplay = useMemo(() => {
    return roundScores.caughtVoterIds.map((id) => {
      const p = state.participants.find((x) => x.id === id);
      return { id, displayName: p?.display_name ?? "?" };
    });
  }, [roundScores.caughtVoterIds, state.participants]);

  const allCaughtNoFool = useMemo(
    () =>
      readerIsAuthor &&
      roundScores.fooledVoterIds.length === 0 &&
      roundScores.caughtVoterIds.length > 0,
    [
      readerIsAuthor,
      roundScores.fooledVoterIds.length,
      roundScores.caughtVoterIds.length,
    ]
  );

  useEffect(() => {
    if (step !== "votes") return;
    const t = window.setTimeout(() => setStep("slot"), 2800);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== "correct") return;
    sentRef.current = false;
    const t = window.setTimeout(() => {
      if (sentRef.current) return;
      sentRef.current = true;
      void sendAction("processReveal", {});
    }, 2500);
    return () => clearTimeout(t);
  }, [step, sendAction]);

  if (step === "votes") {
    return (
      <motion.div
        className="min-h-[50vh] px-5 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      >
        <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          THE GUESSES
        </p>
        <ul className="mt-8 space-y-3 font-body text-sm text-charcoal">
          {voteRows.map((row) => (
            <li key={`${row.voter}-${row.guess}`}>
              <span className="font-medium">{row.voter}</span> guessed →{" "}
              <span className="text-unmute-navy">{row.guess}</span>
            </li>
          ))}
          {voteRows.length === 0 ? (
            <li className="text-slate">No votes recorded this round.</li>
          ) : null}
        </ul>
      </motion.div>
    );
  }

  if (step === "slot") {
    return (
      <SlotMachineReveal
        names={names}
        targetName={authorName}
        onSettled={() => setStep("landed")}
      />
    );
  }

  if (step === "landed") {
    return (
      <LandedAuthor
        authorName={authorName}
        onPauseComplete={() => setStep("correct")}
      />
    );
  }

  if (step === "correct") {
    if (readerIsAuthor) {
      return (
        <motion.div
          className="min-h-[50vh] px-5 py-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
            POINTS THIS ROUND
          </p>

          <div className="mx-auto mt-6 max-w-md rounded-md bg-deep-navy px-4 py-3 text-center font-mono text-xs font-normal leading-relaxed text-warm-white">
            That was {authorName}&apos;s own statement.
          </div>

          {allCaughtNoFool ? (
            <p className="mt-8 text-center font-body text-base text-slate">
              They saw right through it.
            </p>
          ) : (
            <>
              {roundScores.authorBluffed ? (
                <p className="mt-6 text-center font-mono text-sm font-medium text-signal-amber">
                  Perfect bluff. +1 bonus.
                </p>
              ) : null}

              {fooledDisplay.length > 0 ? (
                <ul className="mt-6 space-y-2 text-center font-body text-base">
                  {fooledDisplay.map((f) => (
                    <li key={f.id}>
                      <span className="font-medium text-charcoal">{f.displayName}</span>
                      <span className="font-mono text-signal-amber"> +1</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {caughtDisplay.length > 0 ? (
                <ul className="mt-6 space-y-2 text-center font-body text-sm">
                  {caughtDisplay.map((c) => (
                    <li key={c.id} className="text-slate">
                      <span>{c.displayName}</span>{" "}
                      <span className="text-slate/90">caught you</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </motion.div>
      );
    }

    return (
      <motion.div
        className="min-h-[50vh] px-5 py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      >
        <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
          POINTS THIS ROUND
        </p>
        <div className="mt-8 space-y-3 text-center font-body text-base text-charcoal">
          {correctGuessersNonBluff.length === 0 ? (
            <p className="text-slate">No one guessed the author this round.</p>
          ) : (
            correctGuessersNonBluff.map((g) => (
              <p key={g.id}>
                <span className="font-medium">{g.displayName}</span> guessed right!{" "}
                <span className="font-mono text-signal-amber">+1</span>
              </p>
            ))
          )}
        </div>
      </motion.div>
    );
  }

  return null;
};

type SlotMachineRevealProps = {
  names: string[];
  targetName: string;
  onSettled: () => void;
};

/** Fills reel slots with no two identical names adjacent; landing index shows `targetName`. */
function buildReelRowsNoAdjacentDuplicates(
  displayNames: string[],
  targetName: string,
  total: number,
  endIndex: number
): string[] {
  const pool = displayNames.length > 0 ? displayNames : [targetName];
  const unique = Array.from(new Set(pool));
  const out: string[] = new Array(total);

  for (let i = 0; i < total; i++) {
    if (i === endIndex) {
      out[i] = targetName;
      continue;
    }

    const prev = i === 0 ? "" : out[i - 1]!;
    const slotBeforeLand = i === endIndex - 1;

    const forbidden = new Set<string>();
    if (prev) forbidden.add(prev);
    if (slotBeforeLand) forbidden.add(targetName);

    let choices = unique.filter((n) => !forbidden.has(n));
    if (choices.length === 0) {
      choices = unique.filter((n) => n !== prev);
    }
    if (choices.length === 0) {
      choices = unique.filter((n) => n !== targetName);
    }
    if (choices.length === 0) {
      choices = unique.slice();
    }

    out[i] = choices[Math.floor(Math.random() * choices.length)]!;
  }

  out[endIndex] = targetName;
  if (endIndex > 0 && out[endIndex - 1] === targetName) {
    const twoBack = endIndex >= 2 ? out[endIndex - 2] : "";
    const swap =
      unique.find((n) => n !== targetName && n !== twoBack) ?? unique[0];
    out[endIndex - 1] = swap;
  }

  return out;
}

const SlotMachineReveal = ({
  names,
  targetName,
  onSettled,
}: SlotMachineRevealProps) => {
  const settledRef = useRef(false);

  const reel = useMemo(() => {
    const endIdx = 44;
    const total = 52;
    const rows = buildReelRowsNoAdjacentDuplicates(names, targetName, total, endIdx);
    return { rows, endIndex: endIdx };
  }, [names, targetName]);

  const rowH = 48;
  const viewportH = 220;
  const finalY = -reel.endIndex * rowH + viewportH / 2 - rowH / 2;

  const handleComplete = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettled();
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center overflow-hidden px-4 py-8">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        THE AUTHOR
      </p>
      <div
        className="relative mt-8 w-full max-w-sm overflow-hidden rounded-lg border border-cloud-grey bg-warm-white shadow-sm"
        style={{ height: viewportH }}
      >
        <motion.div
          className="absolute left-0 right-0 top-0 px-3"
          initial={{ y: 0 }}
          animate={{ y: finalY }}
          transition={{
            type: "spring",
            bounce: 0,
            visualDuration: 3,
          }}
          onAnimationComplete={handleComplete}
        >
          {reel.rows.map((n, i) => (
            <div
              key={`${n}-${i}`}
              className="flex h-12 items-center justify-center font-display text-lg text-slate"
            >
              {n}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

type LandedAuthorProps = {
  authorName: string;
  onPauseComplete: () => void;
};

const LandedAuthor = ({ authorName, onPauseComplete }: LandedAuthorProps) => {
  useEffect(() => {
    const t = window.setTimeout(() => onPauseComplete(), 2100);
    return () => clearTimeout(t);
  }, [onPauseComplete]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-5 py-10">
      <p className="text-center font-mono text-[10px] font-normal uppercase tracking-widest text-steel-blue">
        THE AUTHOR
      </p>
      <motion.div
        className="truth-is-reveal-glow mt-8 rounded-lg border border-cloud-grey bg-warm-white px-8 py-4 shadow-sm"
        initial={{ scale: 1, opacity: 0 }}
        animate={{
          scale: [1, 1.08, 1],
          opacity: 1,
        }}
        transition={{
          scale: { duration: 0.9, times: [0, 0.5, 1], ease: [0.4, 0, 0.2, 1] },
          opacity: { duration: 0.2 },
        }}
      >
        <p className="text-center font-display text-2xl font-semibold text-deep-navy">
          {authorName}
        </p>
      </motion.div>
    </div>
  );
};
