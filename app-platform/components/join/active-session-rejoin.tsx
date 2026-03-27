"use client";

import Link from "next/link";

type ActiveSessionRejoinProps = {
  sessionId: string;
  showRejoin: boolean;
};

export function ActiveSessionRejoin({
  sessionId,
  showRejoin,
}: ActiveSessionRejoinProps) {
  return (
    <div className="w-full max-w-md space-y-6 text-center">
      <h1 className="font-display text-3xl font-bold text-unmute-navy">
        Session in progress
      </h1>
      <p className="font-body text-lg text-slate">
        This session has already started. You can rejoin if you were already in
        this session on this device.
      </p>
      {showRejoin ? (
        <Link
          href={`/session/${sessionId}/lobby`}
          className="inline-flex w-full items-center justify-center rounded-md bg-unmute-navy px-6 py-4 font-display text-lg font-semibold text-white shadow-sm transition hover:bg-deep-navy"
        >
          Rejoin session
        </Link>
      ) : (
        <p className="font-body text-sm text-slate">
          No saved participant found on this browser. Ask your facilitator for
          help if you need to get back in.
        </p>
      )}
    </div>
  );
}
