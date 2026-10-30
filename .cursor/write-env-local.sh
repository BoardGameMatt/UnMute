#!/usr/bin/env bash
# Write app-platform/.env.local for local Supabase development.
# The anon/service-role keys below are the well-known, fixed keys that every
# local `supabase start` generates (derived from the default demo JWT secret),
# so they are safe to commit to an environment bootstrap script.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/app-platform/.env.local"

cat > "$ENV_FILE" <<'ENV'
# Local Supabase (supabase start) — standard local-dev keys.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Optional integrations (left blank for local dev; features degrade gracefully)
NEXT_PUBLIC_GIPHY_API_KEY=
NEXT_PUBLIC_EVALUOI_SURVEY_ID=
NEXT_PUBLIC_EVALUOI_EMBED_SRC=https://survey.evaluoi.app/embed.js
ENV

echo "Wrote $ENV_FILE"
