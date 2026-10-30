"use client";

type TrainMember = {
  id: string;
  displayName: string;
  isStarter?: boolean;
};

type TrainOrderProps = {
  members: TrainMember[];
  /** Explainer-only: who is adding the next spoken word in the teaching loop. */
  activeId?: string | null;
  caption?: string;
  pulse?: boolean;
};

/**
 * Ordered Clue Train. Wrap-around is visible. Live play marks who starts this
 * word with a label only — no live “whose turn” highlight.
 */
export function TrainOrder({
  members,
  activeId = null,
  caption = "Clue Train",
  pulse = false,
}: TrainOrderProps) {
  if (members.length === 0) return null;
  const first = members[0];
  const last = members[members.length - 1];

  return (
    <div className="w-full">
      <p className="mb-2 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        {caption}
      </p>
      <div className="flex gap-3">
        <div className="flex w-8 shrink-0 flex-col items-center pt-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-unmute-navy" />
          <span className="w-px flex-1 bg-unmute-navy/25" />
          <span className="flex h-8 items-center font-mono text-[1.65rem] leading-none text-unmute-navy">
            ↺
          </span>
        </div>
        <ol className="flex min-w-0 flex-1 flex-col gap-1.5">
          {members.map((member) => {
            const isActive = activeId === member.id;
            const isStarter = Boolean(member.isStarter) && !activeId;
            return (
              <li
                key={member.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  isActive || pulse
                    ? "border-unmute-navy bg-warm-white"
                    : "border-cloud-grey bg-warm-white"
                } ${pulse ? "animate-pulse" : ""}`}
              >
                <span
                  className={`truncate font-display text-sm sm:text-base ${
                    isActive
                      ? "font-semibold text-unmute-navy"
                      : "font-medium text-unmute-navy"
                  }`}
                >
                  {member.displayName}
                </span>
                {isStarter ? (
                  <span className="ml-2 shrink-0 font-mono text-[10px] uppercase tracking-widest text-signal-amber">
                    Starts
                  </span>
                ) : null}
                {isActive ? (
                  <span className="ml-2 shrink-0 font-mono text-[10px] uppercase tracking-widest text-signal-amber">
                    This word
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      {first && last && members.length > 1 ? (
        <p className="mt-2 text-center font-body text-xs text-slate">
          After {last.displayName}, back to {first.displayName}.
        </p>
      ) : null}
    </div>
  );
}
