"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { TalkTrackViews } from "./components/TalkTrackViews";
import { useTalkTrackPlay } from "./use-talk-track-play";

const TalkTrackProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useTalkTrackPlay(sessionId);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading Talk Track…"}</p>
      </div>
    );
  }

  return (
    <TalkTrackViews
      state={play.state}
      pending={play.pending}
      error={play.error}
      send={play.send}
    />
  );
};

export default TalkTrackProtocol;
