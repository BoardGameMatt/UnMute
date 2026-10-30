"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { IkwymViews } from "./components/IkwymViews";
import { useIkwymPlay } from "./use-ikwym-play";

const IKWYMProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useIkwymPlay(sessionId);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading I Know What You Meme…"}</p>
      </div>
    );
  }

  return (
    <IkwymViews
      sessionId={sessionId}
      state={play.state}
      pending={play.pending}
      error={play.error}
      send={play.send}
    />
  );
};

export default IKWYMProtocol;
