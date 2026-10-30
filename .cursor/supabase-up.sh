#!/usr/bin/env bash
# Bring the local Supabase stack up, tolerating containers that a snapshot may
# have captured in a stale state. Must be run from the app-platform directory.
set -euo pipefail

if supabase start; then
  exit 0
fi

echo "supabase start failed; recreating the stack from a clean state..." >&2
supabase stop --no-backup >/dev/null 2>&1 || true
supabase start
