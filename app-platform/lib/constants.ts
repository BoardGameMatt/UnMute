/** HttpOnly cookie storing the current participant id after joining a session. */
export const PARTICIPANT_COOKIE = "unmute_participant_id";

/** Production join URL path shown on lobby projector (host only, no protocol). */
export const JOIN_URL_DISPLAY = "app.unmutelabs.com/join";

/** Cap on participant-supplied display names. Duplicates are allowed. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

/** Trim and cap a participant-supplied display name. Empty means invalid. */
export function normalizeDisplayName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
}
