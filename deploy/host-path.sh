#!/usr/bin/env bash

# Docker bind sources are resolved on the daemon host, not inside the updater.
resolve_openbcon_host_root() {
  local checkout_root="$1"
  local configured_root="$2"
  local from_updater="$3"
  local host_root

  if [ "$from_updater" != "1" ]; then
    printf '%s\n' "$checkout_root"
    return 0
  fi

  host_root="$configured_root"
  host_root="${host_root%\"}"
  host_root="${host_root#\"}"
  host_root="${host_root%\'}"
  host_root="${host_root#\'}"
  host_root="${host_root%/}"
  if [ -z "$host_root" ] || [[ "$host_root" != /* ]] ||
    [ "$host_root" = "/workspace" ] || [[ "$host_root" == /workspace/* ]]; then
    # Recover old or missing settings from the updater's actual bind mount.
    host_root="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' "${HOSTNAME:-openbcon-updater-1}" 2>/dev/null || true)"
  fi

  if [ -z "$host_root" ] || [[ "$host_root" != /* ]] ||
    [ "$host_root" = "/workspace" ] || [[ "$host_root" == /workspace/* ]]; then
    printf 'Cannot resolve the server checkout path. Set OPENBCON_ROOT in deploy/.env.production to the server directory (for example /opt/openbcon), then run ./deploy/deploy.sh from the server terminal.\n' >&2
    return 1
  fi

  printf '%s\n' "$host_root"
}
