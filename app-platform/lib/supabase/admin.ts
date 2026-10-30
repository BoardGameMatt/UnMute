// Build-time guard: importing this from a client component fails the build.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Runtime backstop for any path the bundler condition does not cover.
if (typeof window !== "undefined") {
  throw new Error("lib/supabase/admin.ts must never be loaded in the browser");
}

/**
 * Service-role client for server-only operations (signed URLs, WAO tables, etc.).
 *
 * Returned untyped: lib/types/database.ts uses interfaces for Row shapes, and
 * supabase-js's createClient<Database> requires those to satisfy GenericSchema
 * (Record<string, unknown>). Interfaces do not, so Schema collapses to never
 * and every .from().insert() becomes a type error. The SSR anon client avoids
 * this by falling back to any; we match that here rather than rewriting every
 * table type to a type alias in this step.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}
