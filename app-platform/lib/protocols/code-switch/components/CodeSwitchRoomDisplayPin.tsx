"use client";

import { useEffect, useState } from "react";
import { readDisplayPin, writeDisplayPin } from "../use-code-switch-play";

export function CodeSwitchRoomDisplayPin({ sessionId }: { sessionId: string }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(readDisplayPin(sessionId));
  }, [sessionId]);

  return (
    <div className="mx-auto mt-4 max-w-md rounded-lg border border-cloud-grey bg-warm-white p-6">
      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Facilitator
      </p>
      <p className="mt-2 font-body text-sm text-charcoal">
        Pick on your phone. Leave this laptop on the shared screen.
      </p>
      <button
        type="button"
        className={`mt-4 w-full rounded-md px-4 py-3 font-display text-sm font-semibold transition-colors ${
          pinned
            ? "bg-unmute-navy text-white"
            : "border border-cloud-grey bg-warm-white text-unmute-navy hover:bg-cloud-grey"
        }`}
        onClick={() => {
          const next = !pinned;
          writeDisplayPin(sessionId, next);
          setPinned(next);
        }}
      >
        {pinned ? "This laptop is the shared screen" : "This is the shared screen"}
      </button>
    </div>
  );
}
