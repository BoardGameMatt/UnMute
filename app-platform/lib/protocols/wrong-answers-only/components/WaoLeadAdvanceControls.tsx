"use client";

export type WaoFacilitatorStatus = {
  finishedRoundNumber: number | null;
  roundsCompleted: number;
  plannedRounds: number;
  concurrenceRate: number | null;
  hasOpenRound: boolean;
  canStartAnother: boolean;
  canEndSession: boolean;
};

type WaoLeadAdvanceControlsProps = {
  status: WaoFacilitatorStatus | null;
  statusError: string | null;
  actionError: string | null;
  startingNext: boolean;
  ending: boolean;
  onStartNext: () => void;
  onEndSession: () => void;
};

function formatConcurrence(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) return "—";
  const n = typeof rate === "number" ? rate : Number(rate);
  if (Number.isNaN(n)) return "—";
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
}

/**
 * Facilitator-only controls after a round reveal.
 * Start another round or end session → scoreboard → reflection.
 */
export function WaoLeadAdvanceControls({
  status,
  statusError,
  actionError,
  startingNext,
  ending,
  onStartNext,
  onEndSession,
}: WaoLeadAdvanceControlsProps) {
  const busy = startingNext || ending;

  return (
    <section className="mt-6 space-y-4 border-t border-cloud-grey pt-5">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-steel-blue">
        Facilitator
      </p>

      {statusError ? (
        <p className="font-body text-sm text-signal-red" role="alert">
          {statusError}
        </p>
      ) : null}

      {status ? (
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              Rounds completed
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold text-unmute-navy">
              {status.roundsCompleted}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">
              Concurrence
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold text-unmute-navy">
              {formatConcurrence(status.concurrenceRate)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="font-body text-sm text-slate">Loading session status…</p>
      )}

      {actionError ? (
        <p className="font-body text-sm text-signal-red" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy || !status?.canStartAnother}
          onClick={onStartNext}
          className="w-full rounded-md bg-signal-amber px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {startingNext ? "Starting…" : "Start another round"}
        </button>
        <button
          type="button"
          disabled={busy || !status?.canEndSession}
          onClick={onEndSession}
          className="w-full rounded-md bg-unmute-navy px-6 py-3 font-display text-base font-semibold text-warm-white shadow-sm transition hover:bg-deep-navy disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ending ? "Ending…" : "End session"}
        </button>
      </div>
    </section>
  );
}
