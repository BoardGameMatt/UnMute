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
    <div className="flex flex-wrap items-center justify-center gap-2 bg-deep-navy px-5 py-4 text-center font-body text-base text-warm-white">
      <span className="font-semibold">{displayName}</span>
      {roleInSession === "lead" ? (
        <span className="rounded-full border border-warm-white/40 px-2.5 py-0.5 text-sm text-warm-white/95">
          (Lead)
        </span>
      ) : null}
    </div>
  );
};
