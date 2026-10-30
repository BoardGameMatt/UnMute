import { NextResponse } from "next/server";

/**
 * 303 with a same-origin relative Location.
 *
 * Next's `request.url` origin is often `http://localhost:3000` even when the
 * browser is on a LAN IP. An absolute redirect to localhost is then
 * cross-origin from the page, and `fetch()` throws TypeError: Failed to fetch.
 */
export function redirectSameOrigin(pathAndQuery: string): NextResponse {
  const location = pathAndQuery.startsWith("/")
    ? pathAndQuery
    : `/${pathAndQuery}`;
  return new NextResponse(null, {
    status: 303,
    headers: { Location: location },
  });
}
