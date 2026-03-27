/** HttpOnly cookie storing the current participant id after joining a session. */
export const PARTICIPANT_COOKIE = "unmute_participant_id";

/** Production join URL path shown on lobby projector (host only, no protocol). */
export const JOIN_URL_DISPLAY = "unmutelabs.com/join";

export type JoinGuestResult =
  | { ok: true }
  | { ok: false; error: string };
