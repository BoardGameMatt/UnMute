import { TRANE_JOIN_CODE_LENGTH } from "./constants";

/** Same alphabet as Unmute unambiguous join codes (no 0/O/1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeTraneJoinCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TRANE_JOIN_CODE_LENGTH);
}

export function generateTraneJoinCode(): string {
  let result = "";
  for (let i = 0; i < TRANE_JOIN_CODE_LENGTH; i += 1) {
    const idx = Math.floor(Math.random() * ALPHABET.length);
    result += ALPHABET[idx] ?? "A";
  }
  return result;
}

export function buildTraneJoinUrl(origin: string, joinCode: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/trane-quiz/join/${normalizeTraneJoinCode(joinCode)}`;
}

export function buildTraneHostUrl(origin: string, hostToken: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/trane-quiz/host/${hostToken}`;
}
