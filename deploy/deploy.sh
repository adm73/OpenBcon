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
"${compose[@]}" up -d --build postgres mongodb ollama ollama-model

# The primary Postgres database is the shared platform catalog. Create the
# tenant databases before the API starts its per-database migrations. This is
# idempotent so repeated deployments do not disturb existing tenant data.
postgres_user="$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | head -n 1)"
postgres_user="${postgres_user:-bconomics}"
database_name_from_url() {
  local url="${1%%\?*}"
  printf '%s' "${url##*/}"
}

database_url_test="$(sed -n 's/^DATABASE_URL_TEST=//p' "$ENV_FILE" | head -n 1)"
database_url_live="$(sed -n 's/^DATABASE_URL_LIVE=//p' "$ENV_FILE" | head -n 1)"
tenant_databases=(
  "$(database_name_from_url "${database_url_test:-postgresql://localhost/bconomics_test}")"
  "$(database_name_from_url "${database_url_live:-postgresql://localhost/bconomics_live}")"
)
for tenant_database in "${tenant_databases[@]}"; do
  if [[ ! "$tenant_database" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    printf 'Invalid tenant database name: %s\n' "$tenant_database" >&2
    exit 1
  fi
  if ! "${compose[@]}" exec -T postgres psql -U "$postgres_user" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$tenant_database'" | grep -q '^1$'; then
    "${compose[@]}" exec -T postgres createdb -U "$postgres_user" "$tenant_database"
  fi
done

# Recreate the API/Python containers after the tenant databases exist, so
# their health checks observe fully initialized Test and Live stores.
"${compose[@]}" up -d --build api python caddy
"${compose[@]}" ps

printf '\nDeployment started.\n'
printf 'Open https://%s after DNS and the first certificate issuance complete.\n' "$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)"
