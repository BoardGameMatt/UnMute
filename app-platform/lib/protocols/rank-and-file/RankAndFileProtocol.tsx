"use client";

import { useEffect } from "react";
import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { RankAndFileViews } from "./components/RankAndFileViews";
import { useRankAndFilePlay } from "./use-rank-and-file-play";

const RankAndFileProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useRankAndFilePlay(sessionId);
  const { isDisplay, pinDisplay, state } = play;

  useEffect(() => {
    if (state?.isLead && !isDisplay) {
      pinDisplay(true);
    }
  }, [state?.isLead, isDisplay, pinDisplay]);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading Rank and File…"}</p>
      </div>
    );
  }

  return (
    <RankAndFileViews
      sessionId={sessionId}
      state={play.state}
      pending={play.pending}
      error={play.error}
      send={play.send}
      isDisplay={play.isDisplay}
      pinDisplay={play.pinDisplay}
    />
  );
};

export default RankAndFileProtocol;
