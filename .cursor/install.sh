#!/usr/bin/env bash
# One-time environment bootstrap for the UnMute Cloud Agent environment.
# Runs after checkout to build the snapshot: installs Docker + the Supabase CLI,
# installs npm deps, boots a local Supabase stack (pulling images so they are
# baked into the snapshot), applies migrations + grants, and seeds demo data.
# Must be idempotent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/app-platform"

echo "==> Installing system packages (Docker, fuse-overlayfs, uidmap)"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq docker.io fuse-overlayfs uidmap postgresql-client

echo "==> Selecting legacy iptables (nftables backend breaks Docker bridge networking in this nested VM)"
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

echo "==> Installing the Supabase CLI"
if ! command -v supabase >/dev/null 2>&1; then
  ARCH="$(dpkg --print-architecture)"
  TAG="$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
  VER="${TAG#v}"
  TMP_DEB="$(mktemp --suffix=.deb)"
  curl -fsSL -o "$TMP_DEB" "https://github.com/supabase/cli/releases/download/${TAG}/supabase_${VER}_linux_${ARCH}.deb"
  sudo dpkg -i "$TMP_DEB"
  rm -f "$TMP_DEB"
fi
supabase --version

echo "==> Starting the Docker daemon"
"$REPO_ROOT/.cursor/docker-up.sh"

echo "==> Installing npm dependencies"
cd "$APP_DIR"
npm ci

echo "==> Writing app-platform/.env.local (local Supabase dev keys)"
"$REPO_ROOT/.cursor/write-env-local.sh"

echo "==> Booting local Supabase stack once to pull images and validate migrations"
# This bakes the Supabase container images into the snapshot and confirms the
# migrations + seed.sql grants apply cleanly.
"$REPO_ROOT/.cursor/supabase-up.sh"

echo "==> Tearing the stack down so the snapshot bakes images only (no containers)"
# The environment build snapshots the VM after install runs. Leaving containers
# running would force dockerd to restore them on every future boot (slow and
# fragile in this nested VM), so we keep only the cached images. start.sh
# recreates the stack and seeds demo data on each boot.
supabase stop --no-backup >/dev/null 2>&1 || true

echo "==> install.sh complete"
