"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { OtspStage } from "./components/OtspStage";
import { useOtspPlay } from "./use-otsp-play";

export default function OnTheSamePageProtocol({ sessionId }: SessionProtocolProps) {
  const play = useOtspPlay(sessionId);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading On the Same Page…"}</p>
      </div>
    );
  }

  return (
    <OtspStage
      state={play.state}
      pending={play.pending}
      error={play.error}
      clockOffsetMs={play.clockOffsetMs}
      onAction={play.send}
    />
  );
}
