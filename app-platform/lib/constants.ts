/** HttpOnly cookie storing the current participant id after joining a session. */
export const PARTICIPANT_COOKIE = "unmute_participant_id";

export type JoinGuestResult =
  | { ok: true }
  | { ok: false; error: string };
