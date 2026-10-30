type LobbyExplainerDotsProps = {
  count: number;
  current: number;
};

/**
 * Progress dots under a looping lobby explainer (moment-conventions §1).
 * Indicators only — not controls.
 */
export const LobbyExplainerDots = ({ count, current }: LobbyExplainerDotsProps) => {
  return (
    <div
      className="mt-5 flex justify-center gap-2.5"
      role="img"
      aria-label={`How it works, step ${current + 1} of ${count}`}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 rounded-full ${
            index === current ? "bg-unmute-navy" : "border-2 border-slate bg-transparent"
          }`}
        />
      ))}
    </div>
  );
};
