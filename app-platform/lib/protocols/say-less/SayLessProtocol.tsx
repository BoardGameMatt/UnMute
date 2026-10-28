"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { SayLessViews } from "./components/SayLessViews";
import { useSayLessPlay } from "./use-say-less-play";

const SayLessProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useSayLessPlay(sessionId);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading Say Less…"}</p>
      </div>
    );
  }

  return (
    <SayLessViews
      state={play.state}
      pending={play.pending}
      error={play.error}
      send={play.send}
    />
  );
};

export default SayLessProtocol;
