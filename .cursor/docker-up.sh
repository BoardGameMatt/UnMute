#!/usr/bin/env bash
# Start (or reuse) a Docker daemon suitable for this nested Cloud Agent VM.
# Idempotent: returns immediately if the daemon already answers.
set -euo pipefail

DOCKER_LOG=/var/log/unmute-dockerd.log

if docker info >/dev/null 2>&1; then
  echo "Docker daemon already running"
  exit 0
fi

# Same-bridge container traffic is filtered through the iptables FORWARD chain
# (default policy DROP) when bridge netfilter is on, which silently breaks
# container-to-container connectivity (e.g. Supabase realtime -> postgres).
sudo modprobe br_netfilter 2>/dev/null || true
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true

# Remove stale runtime files a snapshot may have captured while dockerd was
# running; a leftover pidfile/socket can prevent a fresh daemon from starting.
sudo rm -f /var/run/docker.pid /run/docker.pid /var/run/docker.sock 2>/dev/null || true

# Pre-create a world-writable log file so the redirection below never fails on
# ownership, regardless of what the snapshot captured.
sudo rm -f "$DOCKER_LOG" 2>/dev/null || true
sudo touch "$DOCKER_LOG"
sudo chmod 666 "$DOCKER_LOG"

# fuse-overlayfs is required because the default overlay2 driver is unavailable
# inside this unprivileged nested environment.
sudo bash -c "nohup dockerd --storage-driver=fuse-overlayfs >>'$DOCKER_LOG' 2>&1 &"

echo "Waiting for the Docker daemon to become ready..."
for _ in $(seq 1 90); do
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  if docker info >/dev/null 2>&1; then
    echo "Docker daemon is ready"
    exit 0
  fi
  sleep 1
done

echo "Docker daemon failed to start after 90s. Diagnostics:" >&2
echo "--- dockerd process ---" >&2
pgrep -a dockerd >&2 || echo "(no dockerd process)" >&2
echo "--- full daemon log ---" >&2
sudo cat "$DOCKER_LOG" >&2 || true
exit 1
