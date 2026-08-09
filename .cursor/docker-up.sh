#!/usr/bin/env bash
# Start (or reuse) a Docker daemon suitable for this nested Cloud Agent VM.
# Idempotent: returns immediately if the daemon already answers.
set -euo pipefail

if docker info >/dev/null 2>&1; then
  echo "Docker daemon already running"
  exit 0
fi

# Same-bridge container traffic is filtered through the iptables FORWARD chain
# (default policy DROP) when bridge netfilter is on, which silently breaks
# container-to-container connectivity (e.g. Supabase realtime -> postgres).
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true

# fuse-overlayfs is required because the default overlay2 driver is unavailable
# inside this unprivileged nested environment.
sudo bash -c 'nohup dockerd --storage-driver=fuse-overlayfs >/tmp/dockerd.log 2>&1 &'

echo "Waiting for the Docker daemon to become ready..."
for _ in $(seq 1 60); do
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  if docker info >/dev/null 2>&1; then
    echo "Docker daemon is ready"
    exit 0
  fi
  sleep 1
done

echo "Docker daemon failed to start; last log lines:" >&2
tail -n 40 /tmp/dockerd.log >&2 || true
exit 1
