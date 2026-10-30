"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { useCoverStoryPlay } from "@/lib/cover-story/use-cover-story-play";
import { CoverStoryPlayViews } from "./components/CoverStoryViews";

const CoverStoryProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useCoverStoryPlay(sessionId);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading Cover Story…"}</p>
      </div>
    );
  }

  return (
    <CoverStoryPlayViews
      state={play.state}
      pending={play.pending}
      error={play.error}
      send={play.send}
      reload={play.reload}
    />
  );
};

export default CoverStoryProtocol;
