"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import { OTSP, PIECE_FILL, TILE_IDS, type ReactionKind, type TileId } from "../config";
import type { OtspClientState } from "../types";
import type { OtspSendAction } from "../use-otsp-play";
import { OtspTile } from "./OtspTile";

const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "with_you", emoji: "👍", label: "With you" },
  { kind: "not_sure", emoji: "🤔", label: "Not sure" },
  { kind: "lost", emoji: "🤷", label: "Lost me" },
  { kind: "see_it", emoji: "👀", label: "I see it" },
];

type Props = {
  state: OtspClientState;
  pending: boolean;
  error: string | null;
  clockOffsetMs: number;
  onAction: (action: OtspSendAction) => Promise<boolean>;
};

export function OtspStage({ state, pending, error, clockOffsetMs, onAction }: Props) {
  const router = useRouter();
  const now = useNow(clockOffsetMs);
  const [tile, setTile] = useState<TileId | null>(null);
  const [cell, setCell] = useState<{ row: number; col: number } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const finished = state.phase === "scoreboard" ? state.roundNumber : Math.max(0, state.roundNumber - 1);
  const clockRunning = state.phaseDurationMs > 0 && !(state.phase === "reveal" && state.revealStep === "outcome");
  const placements = state.placements;
  const latest = state.placements.at(-1);

  const activePlacer = state.placers.find((placer) => placer.active);
  const showTurnClock = state.phase === "build" && Boolean(activePlacer);
  const showRevealClock = state.phase === "reveal" && state.revealStep !== "outcome" && state.phaseDurationMs > 0;
  const showClock = showTurnClock || showRevealClock;

  useEffect(() => {
    if (!state.isMyTurn) {
      setTile(null);
      setCell(null);
    }
  }, [state.isMyTurn, state.roundNumber, state.lap, activePlacer?.id]);

  useEffect(() => {
    if (!state.isMyTurn || !tile || !cell) return;
    if (state.preview?.tile === tile && state.preview.row === cell.row && state.preview.col === cell.col) return;
    void onAction({ type: "preview", tile, row: cell.row, col: cell.col });
  }, [cell, onAction, state.isMyTurn, state.preview, tile]);

  const ready = Boolean(tile && cell);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <div className="fixed left-0 right-0 top-0 z-10">
        <SessionProgressBar progress={finished / OTSP.expectedRounds} />
      </div>
      <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        On the Same Page
      </p>
      {state.canControl ? (
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">Facilitator</p>
      ) : null}

      <header className="mt-3 min-h-[5.5rem] rounded-lg border border-cloud-grey bg-warm-white px-4 py-3">
        <h1 className="font-display text-xl font-semibold text-unmute-navy">{state.headerTitle}</h1>
        <p className="mt-1 font-body text-sm text-charcoal">{state.headerBody}</p>
      </header>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate">
            Round {state.roundNumber}
            {state.phase === "build" ? ` · Lap ${state.lap}` : state.phase === "checkin" ? " · Check-in" : ""}
          </p>
          {showTurnClock && activePlacer ? (
            <p className="mt-1 font-display text-lg font-semibold text-unmute-navy">
              {state.isMyTurn ? "Your turn" : `${activePlacer.name}'s turn`}
            </p>
          ) : null}
        </div>
        {clockRunning ? (
          <div className={showClock ? undefined : "hidden"}>
            <WaoPlayTimer
              key={`${state.phase}-${state.revealStep}-${state.phaseEndsAt}`}
              durationSeconds={Math.max(1, Math.round(state.phaseDurationMs / 1000))}
              startedAt={new Date(state.phaseEndsAt - state.phaseDurationMs).toISOString()}
              clockOffsetMs={clockOffsetMs}
              onComplete={() => void onAction({ type: "expire" })}
              retryMs={1000}
              urgentBelowSeconds={state.phase === "checkin" ? OTSP.checkinAmberSeconds : OTSP.turnAmberSeconds}
              numericBelowSeconds={OTSP.numericSeconds}
              size={64}
            />
          </div>
        ) : (
          <span />
        )}
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-2">
        {state.placers.map((placer) => (
          <li key={placer.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setHighlight((current) => (current === placer.id ? null : placer.id))}
              className={`w-full rounded-md bg-warm-white px-2 py-2 text-left ${
                placer.active ? "border-2 border-unmute-navy" : "border border-cloud-grey"
              }`}
            >
              <span className="flex items-center gap-2">
                {placer.color ? (
                  <span className="h-3 w-3 shrink-0 rounded-full border border-charcoal/30" style={{ backgroundColor: PIECE_FILL[placer.color] }} />
                ) : null}
                <span className="min-w-0 break-words font-body text-sm text-charcoal">{placer.name}</span>
              </span>
              {placer.active ? (
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-unmute-navy">Turn</span>
              ) : null}
            </button>
          </li>
        ))}
      </ol>

      <div className="relative mt-4">
        <div className="grid grid-cols-10 gap-px rounded-lg border border-cloud-grey bg-cloud-grey p-px">
          {Array.from({ length: 100 }, (_, index) => {
            const row = Math.floor(index / 10);
            const col = index % 10;
            const placed = placements.find((item) => item.row === row && item.col === col);
            const previewHere = state.isMyTurn && cell?.row === row && cell.col === col && tile;
            const outlined = placed && highlight === placed.participantId;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                disabled={!state.isMyTurn}
                onClick={() => state.isMyTurn && setCell({ row, col })}
                onDragOver={(event) => {
                  if (state.isMyTurn) event.preventDefault();
                }}
                onDrop={(event) => {
                  const dropped = event.dataTransfer.getData("text/otsp-tile");
                  if (state.isMyTurn && isTile(dropped)) {
                    setTile(dropped);
                    setCell({ row, col });
                  }
                }}
                className={`relative aspect-square bg-warm-white ${outlined ? "ring-2 ring-inset ring-unmute-navy" : ""} ${
                  previewHere ? "ring-2 ring-inset ring-signal-amber" : ""
                }`}
              >
                {placed ? <OtspTile tile={placed.tile} color={state.monochrome ? "indigo" : (placed.color ?? "indigo")} className="h-full w-full" /> : null}
                {previewHere && tile ? (
                  <span className="absolute inset-0 opacity-70">
                    <OtspTile tile={tile} color="indigo" className="h-full w-full" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          {state.reactions
            .filter((reaction) => now - reaction.at < 4000)
            .slice(-4)
            .map((reaction) => (
              <motion.span
                key={reaction.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: [0, 1, 0], y: -72 }}
                transition={{ duration: 2.4, ease: [0.4, 0, 0.2, 1] }}
                className="mx-1 text-3xl leading-none"
                role="img"
                aria-label={REACTIONS.find((item) => item.kind === reaction.kind)?.label}
              >
                {REACTIONS.find((item) => item.kind === reaction.kind)?.emoji}
              </motion.span>
            ))}
        </div>
      </div>

      {state.phase !== "reveal" && state.phase !== "scoreboard" ? (
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-slate">
          {state.lockCount} of {state.inspectorCount} inspectors locked
        </p>
      ) : null}
      {state.isMyTurn ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {TILE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/otsp-tile", id)}
                onClick={() => setTile(id)}
                className={`rounded-md bg-warm-white p-1 ${tile === id ? "border-2 border-unmute-navy" : "border border-cloud-grey"}`}
                aria-label={id}
              >
                <OtspTile tile={id} color="indigo" className="h-8 w-full" />
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!ready || pending}
            onClick={() => {
              if (!tile || !cell) return;
              void onAction({ type: "place", tile, row: cell.row, col: cell.col });
            }}
            className={`w-full rounded-md px-4 py-3 font-display text-lg font-semibold ${
              ready ? "bg-signal-amber text-deep-navy hover:bg-sunrise-gold" : "cursor-not-allowed bg-cloud-grey text-slate opacity-40"
            }`}
          >
            Place
          </button>
        </div>
      ) : null}

      {state.canReact && !state.isMyTurn ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {REACTIONS.map((reaction) => (
              <button
                key={reaction.kind}
                type="button"
                disabled={pending}
                aria-label={reaction.label}
                onClick={() =>
                  void onAction({
                    type: "react",
                    kind: reaction.kind,
                    tileKey: latest ? `${latest.row},${latest.col}` : null,
                  })
                }
                className="rounded-md border border-cloud-grey bg-warm-white py-3 text-2xl leading-none hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
          {state.canPin ? (
            <div>
              <h2 className="font-display text-lg font-semibold text-unmute-navy">Who is the Improviser?</h2>
              <p className="mt-1 font-body text-sm text-slate">Tap a name. Tap another to change it, or tap it again to clear it.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {state.placers
                  .filter((placer) => placer.id !== state.selfId)
                  .map((placer) => (
                    <PinButton
                      key={placer.id}
                      name={placer.name}
                      selected={state.myPinId === placer.id}
                      disabled={pending}
                      onClick={() => void onAction({ type: "pin", targetId: state.myPinId === placer.id ? null : placer.id })}
                    />
                  ))}
              </div>
            </div>
          ) : null}
          {state.guessList.length > 0 ? (
            <div>
              <h2 className="font-display text-lg font-semibold text-unmute-navy">What are they building?</h2>
              <p className="mt-1 font-body text-sm text-slate">Tap a picture. Tap another to change it. A correct guess scores more the earlier you make it.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {state.guessList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!state.canGuess || pending}
                    onClick={() => void onAction({ type: "guess", itemId: item.id })}
                    className={`rounded-md bg-warm-white px-3 py-3 text-left font-body text-sm shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 ${
                      state.myGuessId === item.id ? "border-2 border-unmute-navy text-unmute-navy" : "border border-cloud-grey text-charcoal"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.phase === "reveal" || state.phase === "scoreboard" ? <Reveal state={state} /> : null}

      {state.canControl && state.phase === "reveal" && state.revealStep === "outcome" ? (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => void onAction({ type: "anotherRound" })}
            className="w-full rounded-md bg-signal-amber px-4 py-3 font-display text-lg font-semibold text-deep-navy hover:bg-sunrise-gold"
          >
            Another round
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onAction({ type: "scoreboard" })}
            className="w-full rounded-md bg-unmute-navy px-4 py-3 font-display text-lg font-semibold text-warm-white"
          >
            Reflection questions
          </button>
        </div>
      ) : null}

      {state.canControl && state.phase === "scoreboard" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            void onAction({ type: "complete" }).then((ok) => {
              if (ok) router.replace(`/session/${state.sessionId}/feedback`);
            })
          }
          className="mt-6 w-full rounded-md bg-signal-amber px-4 py-3 font-display text-lg font-semibold text-deep-navy hover:bg-sunrise-gold"
        >
          Continue
        </button>
      ) : null}

      {pending ? <p className="mt-3 text-center font-body text-sm text-slate">Sending…</p> : null}
      {error ? (
        <p className="mt-3 text-center font-body text-sm text-signal-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PinButton({ name, selected, disabled, onClick }: { name: string; selected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md bg-warm-white px-3 py-3 text-left font-body text-sm shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? "border-2 border-unmute-navy text-unmute-navy" : "border border-cloud-grey text-charcoal"
      }`}
    >
      {name}
    </button>
  );
}

function Reveal({ state }: { state: OtspClientState }) {
  const max = Math.max(1, ...state.suspicion.map((bar) => bar.count));
  return (
    <section className="mt-6 space-y-4">
      {state.suspicion.length > 0 && state.revealStep === "suspicion" ? (
        <ul className="space-y-2">
          {state.suspicion.map((bar) => (
            <li key={bar.id} className="flex items-center gap-3">
              <span className="w-24 truncate font-body text-sm text-charcoal">{bar.name}</span>
              <span className="h-3 flex-1 rounded-full bg-cloud-grey">
                <span className="block h-3 rounded-full bg-unmute-navy" style={{ width: `${(bar.count / max) * 100}%` }} />
              </span>
              <span className="w-6 text-right font-mono text-sm text-unmute-navy">{bar.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {state.improviserName && (state.revealStep === "improviser" || state.revealStep === "guess") ? (
        <p className="font-display text-2xl font-semibold text-unmute-navy">{state.improviserName} was improvising.</p>
      ) : null}
      {state.improviserGuessLabel && state.revealStep === "guess" ? (
        <p className="font-body text-base text-charcoal">Their guess: {state.improviserGuessLabel}</p>
      ) : null}
      {state.pictureLabel && (state.revealStep === "picture" || state.revealStep === "outcome" || state.phase === "scoreboard") ? (
        <p className="font-display text-2xl font-semibold text-unmute-navy">The picture was {state.pictureLabel}.</p>
      ) : null}
      {state.readPicture !== null && state.revealStep === "picture" ? (
        <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
          Read the picture {Math.round(state.readPicture * 100)}%
        </p>
      ) : null}
      {state.showTotals && (state.revealStep === "outcome" || state.phase === "scoreboard") ? (
        <div className="space-y-3">
          {state.readPicture !== null && state.readPerson !== null ? (
            <p className="font-mono text-xs uppercase tracking-widest text-steel-blue">
              Read the picture {Math.round(state.readPicture * 100)}% · Read the person {Math.round(state.readPerson * 100)}%
            </p>
          ) : null}
          <ul className="space-y-2">
            {state.totals.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between border-b border-cloud-grey py-2">
                <span className="font-body text-base text-charcoal">{row.name}</span>
                <span className="font-display text-2xl font-semibold text-unmute-navy">
                  {row.total}
                  {state.revealStep === "outcome" ? <span className="ml-2 font-mono text-xs text-slate">+{row.roundPoints}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {state.phase === "scoreboard" ? <p className="font-body text-base text-charcoal">{state.bridge}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function isTile(value: string): value is TileId {
  return (TILE_IDS as readonly string[]).includes(value);
}

function useNow(offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offsetMs), 200);
    return () => window.clearInterval(id);
  }, [offsetMs]);
  return now;
}
