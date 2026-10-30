"use client";

import { useEffect } from "react";
import { writeDisplayPin } from "../use-airtime-play";

export function AirtimeRoomDisplayPin({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    writeDisplayPin(sessionId, true);
  }, [sessionId]);

  return (
    <div className="mx-auto mt-4 max-w-md rounded-lg border border-cloud-grey bg-warm-white p-6">
      <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
        Shared screen
      </p>
      <p className="mt-2 font-display text-xl font-semibold text-unmute-navy">
        Join on your phone now.
      </p>
      <p className="mt-2 font-body text-sm text-charcoal">
        This laptop stays screen-shared in the call. Scan the QR and enter your name on your phone.
        Nothing private ever appears here.
      </p>
    </div>
  );
}
