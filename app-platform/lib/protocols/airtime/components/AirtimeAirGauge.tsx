type Props = {
  label: string;
  /** 0–4 filled segments; only changes when the band changes. */
  segments: number;
};

export function AirtimeAirGauge({ label, segments }: Props) {
  const critical = segments <= 1;
  return (
    <div className="rounded-lg border border-cloud-grey bg-warm-white p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-steel-blue">Boat air</p>
        <p
          className={`font-display text-lg font-semibold ${
            critical ? "text-signal-red" : "text-unmute-navy"
          }`}
        >
          {label}
        </p>
      </div>
      <div
        className="mt-3 grid grid-cols-4 gap-1.5"
        role="meter"
        aria-label={`Boat air: ${label}`}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={segments}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3 rounded-sm ${
              i < segments
                ? critical
                  ? "bg-signal-red"
                  : "bg-unmute-navy"
                : "border border-cloud-grey bg-transparent"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
