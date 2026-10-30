"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { CodeSwitchViews } from "./components/CodeSwitchViews";
import { useCodeSwitchPlay } from "./use-code-switch-play";

const CodeSwitchProtocol = ({ sessionId }: SessionProtocolProps) => {
  const play = useCodeSwitchPlay(sessionId);

  if (!play.state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <p className="font-body text-slate">{play.error ?? "Loading SwitchCode…"}</p>
      </div>
    );
  }

  return (
    <CodeSwitchViews
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

export default CodeSwitchProtocol;
