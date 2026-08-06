"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { WaoPlayView } from "./components/WaoPlayView";

/**
 * Wrong Answers Only — play shell for one existing pair.
 * Round creation, scoring, and reveal are out of scope for this step.
 */
const WrongAnswersOnlyProtocol = ({
  sessionId,
  participantId,
  role,
}: SessionProtocolProps) => {
  return (
    <WaoPlayView
      sessionId={sessionId}
      participantId={participantId}
      role={role}
    />
  );
};

export default WrongAnswersOnlyProtocol;
