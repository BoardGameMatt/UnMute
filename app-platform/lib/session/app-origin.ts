import { APP_ORIGIN_DISPLAY, normalizeJoinCode } from "@/lib/constants";

/** Hostnames a phone on a different network cannot reach. */
export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * Absolute origin for URLs a participant opens on their own phone.
 *
 * Reads the request the facilitator's browser actually made, so the QR encodes
 * whatever public origin they are already on. APP_ORIGIN overrides it for
 * deployments behind a proxy that rewrites Host.
 */
export function resolveAppOrigin(requestHeaders: Headers): string {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) return stripTrailingSlash(configured);

  const host =
    firstHeaderValue(requestHeaders.get("x-forwarded-host")) ??
    firstHeaderValue(requestHeaders.get("host"));

  if (!host) return APP_ORIGIN_DISPLAY;

  const hostname = host.split(":")[0] ?? host;
  const proto =
    firstHeaderValue(requestHeaders.get("x-forwarded-proto")) ??
    (isLocalHostname(hostname) ? "http" : "https");

  return `${proto}://${host}`;
}

/** Absolute self-service join URL for a session, safe to encode in a QR code. */
export function buildJoinUrl(origin: string, joinCode: string): string {
  return `${stripTrailingSlash(origin)}/join/${normalizeJoinCode(joinCode)}`;
}
