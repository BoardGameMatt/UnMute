"use client";

import { useEffect, useId, useRef, useState } from "react";

type WaoDisambiguationInfoProps = {
  rule: string;
  detail: string | null;
};

/**
 * Quiet "i" control beside the question title. Opens a popover with the
 * disambiguation rule/detail so they stay off the always-visible layout.
 */
export function WaoDisambiguationInfo({
  rule,
  detail,
}: WaoDisambiguationInfoProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent | TouchEvent) => {
      const node = rootRef.current;
      if (!node) return;
      if (event.target instanceof Node && !node.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="Question rules"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-cloud-grey bg-warm-white font-mono text-xs font-medium text-steel-blue transition hover:border-unmute-navy hover:text-unmute-navy"
      >
        i
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Disambiguation"
          className="absolute left-1/2 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-cloud-grey bg-warm-white p-4 text-left shadow-md sm:left-auto sm:right-0 sm:translate-x-0"
        >
          <p className="font-body text-sm font-semibold text-charcoal">{rule}</p>
          {detail ? (
            <p className="mt-2 font-body text-sm text-slate">{detail}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
