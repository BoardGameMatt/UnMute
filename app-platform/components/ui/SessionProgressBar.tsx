"use client";

type SessionProgressBarProps = {
  /** 0–1 how far through the session (rounds completed / expected total). */
  progress: number;
  className?: string;
};

/**
 * Thin environmental progress — navy on cloud-grey, no labels.
 */
export const SessionProgressBar = ({
  progress,
  className = "",
}: SessionProgressBarProps) => {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <div
      className={`h-[3px] w-full bg-cloud-grey ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-unmute-navy transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
