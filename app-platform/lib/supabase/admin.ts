// Build-time guard: importing this from a client component fails the build.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Runtime backstop for any path the bundler condition does not cover.
if (typeof window !== "undefined") {
  throw new Error("lib/supabase/admin.ts must never be loaded in the browser");
}

/** Service-role client for server-only operations (signed URLs, etc.). */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(url, key);
}
