type SayLessTurnControlsProps = {
  disabled?: boolean;
  /** Round 1: Pass / Oops looks disabled but still taps through to the server's refusal. */
  passBlocked?: boolean;
  highlight?: "got_it" | "pass" | null;
  onGotIt?: () => void;
  onPass?: () => void;
};

export const SayLessTurnControls = ({
  disabled = false,
  passBlocked = false,
  highlight = null,
  onGotIt,
  onPass,
}: SayLessTurnControlsProps) => {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={onGotIt}
        className={`rounded-md px-6 py-4 font-display text-lg font-semibold text-deep-navy shadow-sm transition hover:bg-sunrise-gold disabled:cursor-not-allowed disabled:opacity-40 ${
          highlight === "got_it" || !highlight ? "bg-signal-amber" : "bg-signal-amber/70"
        }`}
      >
        Got it
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-disabled={passBlocked}
        onClick={onPass}
        className={`rounded-md border px-4 py-3 font-display font-semibold text-unmute-navy disabled:cursor-not-allowed disabled:opacity-40 ${
          passBlocked ? "cursor-not-allowed opacity-40" : ""
        } ${highlight === "pass" ? "border-2 border-unmute-navy bg-cloud-grey" : "border-cloud-grey"}`}
      >
        Pass / Oops
      </button>
    </div>
  );
};
