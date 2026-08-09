#!/usr/bin/env bash
# Per-boot reconciliation for the UnMute Cloud Agent environment.
# Re-establishes host networking sysctls, starts the Docker daemon, brings the
# local Supabase stack back up, and ensures demo data is present. Idempotent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/app-platform"

echo "==> Ensuring legacy iptables backend"
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true

echo "==> Starting the Docker daemon"
"$REPO_ROOT/.cursor/docker-up.sh"

echo "==> Ensuring app-platform/.env.local exists"
[ -f "$APP_DIR/.env.local" ] || "$REPO_ROOT/.cursor/write-env-local.sh"

echo "==> Bringing up the local Supabase stack"
cd "$APP_DIR"
"$REPO_ROOT/.cursor/supabase-up.sh"

echo "==> Seeding demo data (idempotent)"
npm run seed
npm run load:wao

echo "==> start.sh complete"
