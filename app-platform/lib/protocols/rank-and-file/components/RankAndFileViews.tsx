"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { SessionProgressBar } from "@/components/ui/SessionProgressBar";
import { WaoPlayTimer } from "@/lib/protocols/wrong-answers-only/components/WaoPlayTimer";
import {
  CLUE_MAX_LEN,
  WRITE_DISPLAY_SECONDS,
  WRITE_SECONDS,
  WRITE_URGENT_SECONDS,
  placeInSlot,
  returnToTray,
  swapSlots,
  validateClue,
} from "../engine";
import type { RankAndFileAction, RankAndFilePlayState, RankTile } from "../types";

const EASE = [0.4, 0, 0.2, 1] as const;

type Props = {
  sessionId: string;
  state: RankAndFilePlayState;
  pending: boolean;
  error: string | null;
  send: (action: RankAndFileAction) => Promise<boolean>;
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

function SubjectCard({
  theme,
  lowEnd,
  highEnd,
}: {
  theme: string | null;
  lowEnd: string | null;
  highEnd: string | null;
}) {
  if (!theme) return null;
  return (
    <div className="rounded-lg border border-unmute-navy/20 bg-warm-white p-6">
      <p className="font-display text-2xl font-semibold text-unmute-navy">{theme}</p>
      <div className="mt-4 flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-2xl font-medium text-unmute-navy">0</p>
          <p className="mt-1 font-body text-sm text-slate">{lowEnd}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-medium text-unmute-navy">100</p>
          <p className="mt-1 font-body text-sm text-slate">{highEnd}</p>
        </div>
      </div>
    </div>
  );
}

function TileCard({
  tile,
  selected,
  draggable,
  onSelect,
}: {
  tile: RankTile;
  selected?: boolean;
  draggable?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", tile.dealId);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      className={`flex h-full min-h-[4.5rem] w-full flex-col justify-center rounded-lg border bg-warm-white px-3 py-3 text-left ${
        selected
          ? "border-2 border-unmute-navy border-l-4"
          : "border-2 border-unmute-navy/20"
      }`}
    >
      <p className="font-body text-sm text-charcoal">{tile.clueText}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
        {tile.displayName}
        {tile.dealtNumber !== null ? ` · ${tile.dealtNumber}` : ""}
      </p>
    </button>
  );
}

function RankRail({
  state,
  canRank,
  selectedId,
  setSelectedId,
  onSetRail,
}: {
  state: RankAndFilePlayState;
  canRank: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onSetRail: (dealIds: (string | null)[]) => void;
}) {
  const slots = state.rail.map((tile) => tile?.dealId ?? null);

  const dropOnSlot = (index: number, dealId: string) => {
    onSetRail(placeInSlot(slots, dealId, index));
    setSelectedId(dealId);
  };

  const returnDropped = (dealId: string) => {
    onSetRail(returnToTray(slots, dealId));
    setSelectedId(null);
  };

  const trayForRow: (RankTile | null)[] = [];
  let trayCursor = 0;
  for (const tile of state.rail) {
    if (tile) {
      trayForRow.push(null);
      continue;
    }
    const next = state.tray[trayCursor] ?? null;
    if (next) trayCursor += 1;
    trayForRow.push(next);
  }

  return (
    <div className="grid grid-cols-2 items-stretch gap-x-6 gap-y-2">
      <div>
        <p className="font-mono text-2xl font-medium text-unmute-navy">0</p>
        <p className="font-body text-sm text-slate">{state.lowEnd}</p>
      </div>
      <div className="flex flex-col justify-end">
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
          Unranked
        </p>
      </div>
      {state.rail.map((tile, index) => {
        const trayTile = trayForRow[index];
        return (
          <Fragment key={`row-${index}`}>
            <div
              className="h-full"
              onDragOver={(event) => {
                if (!canRank) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!canRank) return;
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain");
                if (id) dropOnSlot(index, id);
              }}
            >
              {tile ? (
                <div className="flex h-full items-stretch gap-2">
                  <div className="min-w-0 flex-1">
                    <TileCard
                      tile={tile}
                      selected={selectedId === tile.dealId}
                      draggable={canRank}
                      onSelect={() => {
                        if (!canRank) return;
                        setSelectedId(selectedId === tile.dealId ? null : tile.dealId);
                      }}
                    />
                  </div>
                  {canRank ? (
                    <div className="flex flex-col justify-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        className="rounded-md border border-cloud-grey px-2 py-1 font-display text-sm text-unmute-navy disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Move up"
                        onClick={() => {
                          onSetRail(swapSlots(slots, index, -1));
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === state.rail.length - 1}
                        className="rounded-md border border-cloud-grey px-2 py-1 font-display text-sm text-unmute-navy disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Move down"
                        onClick={() => {
                          onSetRail(swapSlots(slots, index, 1));
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canRank}
                  onClick={() => {
                    if (selectedId) dropOnSlot(index, selectedId);
                  }}
                  className="flex h-full min-h-[4.5rem] w-full items-center justify-center rounded-lg border-2 border-dashed border-unmute-navy bg-cloud-grey/40 font-mono text-[10px] uppercase tracking-widest text-steel-blue"
                  aria-label={`Empty slot ${index + 1}`}
                >
                  Drop here
                </button>
              )}
            </div>
            <div
              className="h-full"
              onDragOver={(event) => {
                if (!canRank) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!canRank) return;
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain");
                if (id) returnDropped(id);
              }}
            >
              {trayTile ? (
                <TileCard
                  tile={trayTile}
                  selected={selectedId === trayTile.dealId}
                  draggable={canRank}
                  onSelect={() => {
                    if (!canRank) return;
                    setSelectedId(selectedId === trayTile.dealId ? null : trayTile.dealId);
                  }}
                />
              ) : null}
            </div>
          </Fragment>
        );
      })}
      <div>
        <p className="font-mono text-2xl font-medium text-unmute-navy">100</p>
        <p className="font-body text-sm text-slate">{state.highEnd}</p>
      </div>
      <div />
    </div>
  );
}

function HitSoundwave() {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <p className="mt-4 text-center font-display text-5xl text-sunrise-gold" aria-hidden="true">
        ✓
      </p>
    );
  }
  return (
    <div className="relative mx-auto mt-6 h-52 w-52" aria-hidden="true">
      <motion.div
        className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-amber/30"
        initial={{ opacity: 0.7, scale: 0.85 }}
        animate={{ opacity: [0.55, 0.2, 0.45], scale: [0.9, 1, 0.95] }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-signal-amber"
          initial={{ scale: 0.4, opacity: 0.9 }}
          animate={{ scale: 2.8, opacity: 0 }}
          transition={{ duration: 1.15, delay: i * 0.14, ease: EASE }}
        />
      ))}
      <p className="absolute inset-0 flex items-center justify-center font-display text-6xl text-sunrise-gold">
        ✓
      </p>
    </div>
  );
}

function useSecondsLeft(startedAt: string | null, durationSeconds: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || !durationSeconds) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, durationSeconds]);

  if (!startedAt || !durationSeconds) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, durationSeconds - (now - start) / 1000);
}

function WriteClueForm({
  draft,
  setDraft,
  pending,
  error,
  urgent,
  onLock,
}: {
  draft: string;
  setDraft: (value: string) => void;
  pending: boolean;
  error: string | null;
  urgent: boolean;
  onLock: () => void;
}) {
  const valid = validateClue(draft);
  const rejected = draft.trim().length > 0 && !valid.ok;
  const ready = valid.ok;

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onLock();
      }}
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={CLUE_MAX_LEN}
        rows={3}
        className={`w-full resize-none rounded-md bg-warm-white px-3 py-3 font-body text-charcoal ${
          rejected
            ? "border-2 border-signal-red"
            : ready
              ? "border-2 border-unmute-navy border-l-4"
              : "border border-unmute-navy/20"
        }`}
        placeholder="A vivid example — adjectives welcome"
      />
      <p className="text-right font-mono text-[11px] text-slate">
        {draft.length}/{CLUE_MAX_LEN}
      </p>
      {rejected ? (
        <p className="font-body text-sm text-signal-red" role="alert">
          {valid.ok ? error : valid.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !ready}
        className={`w-full rounded-md px-4 py-3 font-display text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          ready
            ? urgent
              ? "bg-signal-amber text-deep-navy hover:bg-sunrise-gold"
              : "bg-unmute-navy text-white hover:bg-deep-navy"
            : "bg-cloud-grey text-slate"
        }`}
      >
        Lock in
      </button>
    </form>
  );
}

export function RankAndFileViews({
  sessionId,
  state,
  pending,
  error,
  send,
  isDisplay,
  pinDisplay,
}: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const [draft, setDraft] = useState("");
  const [wrapConfirm, setWrapConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showFacilitatorPhone = state.isLead && !isDisplay;

  useEffect(() => {
    setDraft("");
    setSelectedId(null);
    setWrapConfirm(false);
  }, [state.roundIndex, state.phase]);

  const showTimer =
    (state.phase === "write" && state.writeStartedAt) ||
    (state.phase === "rank" && state.rankStartedAt);
  const writeSecondsLeft = useSecondsLeft(
    state.phase === "write" ? state.writeStartedAt : null,
    WRITE_DISPLAY_SECONDS
  );
  const writeUrgent = Boolean(
    state.phase === "write" &&
      state.dealtNumber !== null &&
      !state.myClueLocked &&
      writeSecondsLeft !== null &&
      writeSecondsLeft > 0 &&
      writeSecondsLeft <= WRITE_URGENT_SECONDS
  );

  useEffect(() => {
    if (state.phase !== "write" || !state.writeStartedAt) return;
    const start = new Date(state.writeStartedAt).getTime();
    if (Number.isNaN(start)) return;
    const delay = Math.max(0, start + WRITE_SECONDS * 1000 - Date.now());
    const id = window.setTimeout(() => {
      void send({ type: "timerExpired" });
    }, delay);
    return () => window.clearTimeout(id);
  }, [state.phase, state.writeStartedAt, send]);

  return (
    <div className={`mx-auto flex flex-col gap-6 px-5 ${state.canRank || isDisplay ? "max-w-5xl" : "max-w-lg"}`}>
      <SessionProgressBar progress={state.progress} />
      <p className="text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Rank and File
      </p>

      {showTimer && state.timerSeconds ? (
        <div className="flex justify-center">
          <WaoPlayTimer
            durationSeconds={state.timerSeconds}
            startedAt={state.phase === "write" ? state.writeStartedAt : state.rankStartedAt}
            urgentBelowSeconds={state.phase === "write" ? WRITE_URGENT_SECONDS : 15}
            onComplete={() => {
              if (state.phase === "write") void send({ type: "timerExpired" });
            }}
          />
        </div>
      ) : null}

      {state.persistentInstruction ? (
        <p className="text-center font-body text-sm text-charcoal">{state.persistentInstruction}</p>
      ) : null}

      <SubjectCard theme={state.theme} lowEnd={state.lowEnd} highEnd={state.highEnd} />

      {state.phase === "write" ? (
        <>
          <p className="text-center font-body text-slate">
            {state.lockedCount}/{state.clueGiverCount} locked in.
          </p>
          <div className="flex flex-wrap justify-center gap-1">
            {state.roster
              .filter((row) => row.isClueGiver)
              .map((row) => (
                <span
                  key={row.participantId}
                  className={`rounded-full px-2 py-1 font-body text-[11px] ${
                    row.locked
                      ? "bg-unmute-navy text-warm-white"
                      : "border border-cloud-grey bg-warm-white text-charcoal"
                  }`}
                >
                  {row.displayName}
                </span>
              ))}
          </div>
          {state.dealtNumber !== null ? (
            <motion.div
              className={`rounded-lg border bg-warm-white p-6 text-center ${
                writeUrgent ? "border-2 border-signal-amber" : "border-unmute-navy/20"
              }`}
              animate={
                writeUrgent && !reduceMotion
                  ? { opacity: [1, 0.55, 1], scale: [1, 0.97, 1] }
                  : { opacity: 1, scale: 1 }
              }
              transition={
                writeUrgent && !reduceMotion
                  ? { duration: 0.6, repeat: Infinity, ease: EASE }
                  : { duration: 0.2, ease: EASE }
              }
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                Your number
              </p>
              <p className="mt-2 font-display text-5xl font-bold text-unmute-navy">
                {state.dealtNumber}
              </p>
              {state.myClueLocked ? (
                <div className="mt-4 space-y-3">
                  <p className="font-body text-slate">✓ Locked in.</p>
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-md bg-signal-amber px-4 py-3 font-display text-base font-semibold text-deep-navy opacity-100"
                  >
                    Lock in
                  </button>
                </div>
              ) : (
                <WriteClueForm
                  draft={draft}
                  setDraft={setDraft}
                  pending={pending}
                  error={error}
                  urgent={writeUrgent}
                  onLock={() => {
                    void send({ type: "lockClue", text: draft });
                  }}
                />
              )}
            </motion.div>
          ) : !isDisplay ? (
            <div className="rounded-lg bg-unmute-navy p-6">
              <p className="text-center font-mono text-sm uppercase tracking-widest text-warm-white">
                {state.instruction}
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {state.phase === "rank" ? (
        state.canRank ? (
          <>
            <p className="text-center font-body text-sm text-charcoal">{state.instruction}</p>
            <RankRail
              state={state}
              canRank
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onSetRail={(dealIds) => {
                void send({ type: "setRail", dealIds });
              }}
            />
            <button
              type="button"
              disabled={pending || !state.canCommit}
              onClick={() => {
                void send({ type: "commit" });
              }}
              className={`w-full rounded-md px-4 py-3 font-display text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                state.canCommit
                  ? "bg-signal-amber text-deep-navy hover:bg-sunrise-gold"
                  : "bg-cloud-grey text-slate"
              }`}
            >
              Commit
            </button>
          </>
        ) : (
          <div className="rounded-lg bg-unmute-navy p-6">
            <p className="text-center font-mono text-sm uppercase tracking-widest text-warm-white">
              {state.instruction}
            </p>
          </div>
        )
      ) : null}

      {state.phase === "reveal" ? (
        <>
          <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
            {state.zeroTiles ? (
              <p className="text-center font-body text-charcoal">No examples were locked in.</p>
            ) : (
              <>
                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                  {state.isHit ? "In order" : "One card off."}
                </p>
                {state.isHit ? (
                  <>
                    <p className="mt-2 text-center font-display text-3xl font-semibold text-sunrise-gold">
                      Exact order
                    </p>
                    <HitSoundwave />
                  </>
                ) : null}
                <div className="mt-4 space-y-2">
                  <p className="font-mono text-lg text-unmute-navy">0</p>
                  <p className="font-body text-xs text-slate">{state.lowEnd}</p>
                  {state.rail.map((tile) =>
                    tile ? <TileCard key={tile.dealId} tile={tile} /> : null
                  )}
                  <p className="font-mono text-lg text-unmute-navy">100</p>
                  <p className="font-body text-xs text-slate">{state.highEnd}</p>
                </div>
                {state.truthRow ? (
                  <div className="mt-4 space-y-2 border-t border-cloud-grey pt-4">
                    {state.truthRow.map((tile) => (
                      <div key={tile.dealId} className="rounded-lg border-2 border-unmute-navy bg-warm-white px-3 py-3">
                        <p className="font-body text-sm text-charcoal">{tile.clueText}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
                          {tile.displayName} · {tile.dealtNumber}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              Rounds in order
            </p>
            <p className="text-center font-display text-4xl font-bold text-unmute-navy">{state.hits}</p>
          </div>
          {state.isLead ? (
            <div className="space-y-3">
              {state.canNextRound ? (
                <PrimaryButton
                  disabled={pending}
                  onClick={() => {
                    void send({ type: "nextRound" });
                  }}
                >
                  Next round
                </PrimaryButton>
              ) : null}
              {state.canAnotherRound ? (
                <PrimaryButton
                  disabled={pending}
                  onClick={() => {
                    void send({ type: "anotherRound" });
                  }}
                >
                  Another round
                </PrimaryButton>
              ) : null}
              {state.canWrap ? (
                wrapConfirm ? (
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
                )
              ) : null}
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
              Rounds in order
            </p>
            <p className="font-display text-5xl font-bold text-unmute-navy">
              {state.hits}/{state.committedRounds}
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              In order
            </p>
            <p className="font-display text-3xl font-bold text-unmute-navy">{state.percentInOrder}%</p>
          </div>
          {state.isLead ? (
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

      {showFacilitatorPhone && state.phase !== "scoreboard" && state.phase !== "rank" ? (
        <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
            Facilitator
          </p>
          <p className="mt-2 font-body text-sm text-slate">
            Round {state.roundIndex} · {state.lockedCount}/{state.clueGiverCount} locked ·{" "}
            {state.remainingSubjects} subjects left
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
