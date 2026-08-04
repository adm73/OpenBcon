#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.production.yml"
ENV_FILE="$ROOT_DIR/deploy/.env.production"

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required. Install Docker Engine and Docker Compose first.\n' >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  printf 'Missing %s\n' "$ENV_FILE" >&2
  printf 'Run: cp deploy/.env.production.example deploy/.env.production\n' >&2
  exit 1
fi

cd "$ROOT_DIR"

# Stamp the frontend with the source commit so Admin Console can compare the
# running build with the latest commit on GitHub.
if [ -z "${VITE_APP_COMMIT:-}" ]; then
  VITE_APP_COMMIT="$(git rev-parse --short=12 HEAD 2>/dev/null || printf 'unknown')"
  export VITE_APP_COMMIT
fi

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config >/dev/null
"${compose[@]}" up -d --build
"${compose[@]}" ps

printf '\nDeployment started.\n'
printf 'Open https://%s after DNS and the first certificate issuance complete.\n' "$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)"
