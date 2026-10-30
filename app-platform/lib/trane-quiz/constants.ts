import type { TraneOfferingPhase, TraneResponsePhase } from "@/lib/types/database";

/** HttpOnly cookie: anonymous Trane Quiz participant row id. */
export const TRANE_QUIZ_PARTICIPANT_COOKIE = "trane_quiz_participant_id";

export const TRANE_JOIN_CODE_LENGTH = 6;

export const TRANE_PHASES: readonly TraneOfferingPhase[] = [
  "waiting",
  "pre_open",
  "pre_closed",
  "post_open",
  "closed",
] as const;

export const TRANE_RESPONSE_PHASES: readonly TraneResponsePhase[] = [
  "pre",
  "post",
] as const;

export const QUESTIONS_PER_COURSE = 10;
