"use client";

import type { SessionParticipantRole } from "@/lib/types/database";

const SHOW_SESSION_IDENTITY_BANNER = true;

type SessionIdentityBannerProps = {
  displayName: string;
  roleInSession: SessionParticipantRole;
};

export const SessionIdentityBanner = ({
  displayName,
  roleInSession,
}: SessionIdentityBannerProps) => {
  if (!SHOW_SESSION_IDENTITY_BANNER) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-deep-navy px-4 py-2 text-center font-mono text-[11px] font-normal text-warm-white">
      <span>{displayName}</span>
      {roleInSession === "lead" ? (
        <span className="rounded-full border border-warm-white/40 px-2 py-0.5 text-[10px] text-warm-white/95">
          (Lead)
        </span>
      ) : null}
    </div>
  );
};
