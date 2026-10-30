"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { ZoningRightsViews } from "./components/ZoningRightsViews";
import { useZoningRightsPlay } from "./use-zoning-rights-play";

const ZoningRightsProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useZoningRightsPlay(sessionId);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading Zoning Rights…"}</p>
      </div>
    );
  }

  return (
    <ZoningRightsViews
      sessionId={sessionId}
      state={play.state}
      pending={play.pending}
      error={play.error}
      send={play.send}
    />
  );
};

export default ZoningRightsProtocol;
