"use client";

import type { SessionProtocolProps } from "@/lib/protocols/registry";
import { WaoPlayView } from "./components/WaoPlayView";

/**
 * Wrong Answers Only — play, reveal, lead advance / end session.
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
