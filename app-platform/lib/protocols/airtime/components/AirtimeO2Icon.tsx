type IconProps = { className?: string };

export function AirtimeO2Icon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10.25" strokeWidth="1.5" />
      <ellipse cx="9.4" cy="12.4" rx="3.1" ry="3.7" strokeWidth="2" />
      <path d="M14.4 14.4c0-.9.7-1.5 1.5-1.5s1.5.6 1.5 1.4c0 .7-.4 1.1-1 1.7l-2 2h3.1" strokeWidth="1.3" />
      <path d="M15.2 6.6a4.2 4.2 0 0 1 3.4 3.3" strokeWidth="1.3" />
    </svg>
  );
}

type CostProps = { amount: number; className?: string };

/** "− O₂ O₂": air drained per turn, one icon per unit. */
export function AirtimeO2Cost({ amount, className = "" }: CostProps) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`minus ${amount} oxygen per turn`}>
      <span className="mr-0.5 font-mono text-sm" aria-hidden>
        −
      </span>
      {Array.from({ length: amount }, (_, i) => (
        <AirtimeO2Icon key={i} />
      ))}
    </span>
  );
}
