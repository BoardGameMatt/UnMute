/** HttpOnly cookie storing the current participant id after joining a session. */
export const PARTICIPANT_COOKIE = "unmute_participant_id";

/** Production join URL path shown on lobby projector (host only, no protocol). */
export const JOIN_URL_DISPLAY = "app.unmutelabs.com/join";

/** Cap on participant-supplied display names. Duplicates are allowed. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

/** Session and team join codes are always six characters. */
export const JOIN_CODE_LENGTH = 6;

/**
 * Normalize a typed or URL join code for lookup.
 * Uppercases, strips whitespace/hyphens and other noise, keeps A–Z0–9 so
 * legacy codes that still contain 0/O/1/I/L continue to resolve.
 */
export function normalizeJoinCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, JOIN_CODE_LENGTH);
}

/** Trim and cap a participant-supplied display name. Empty means invalid. */
export function normalizeDisplayName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
}
