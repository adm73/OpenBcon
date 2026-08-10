#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.production.yml"
ENV_FILE="$ROOT_DIR/deploy/.env.production"
SETUP_COMPLETE_FILE="$ROOT_DIR/deploy/.setup-complete"
SETUP_STATUS_FILE="$ROOT_DIR/deploy/.setup-status.json"
PROXY_OVERRIDE_FILE="$ROOT_DIR/deploy/docker-compose.proxy.yml"
SETUP_CONTAINER="openbcon-bootstrap-setup"
SETUP_MODE=0
SETUP_STATUS_ENABLED=0

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  printf '%s' "$value"
}

write_setup_status() {
  local phase="$1"
  local message="$2"
  printf '{"phase":"%s","message":"%s","updatedAt":"%s"}\n' \
    "$(json_escape "$phase")" "$(json_escape "$message")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SETUP_STATUS_FILE"
}

if [ "${1:-}" = "--setup" ]; then
  SETUP_MODE=1
elif [ -n "${1:-}" ]; then
  printf 'Usage: ./deploy/deploy.sh [--setup]\n' >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required. Install Docker Engine and Docker Compose first.\n' >&2
  exit 1
fi

if [ "$SETUP_MODE" -eq 1 ] || [ ! -f "$ENV_FILE" ]; then
  SETUP_STATUS_ENABLED=1
  rm -f "$SETUP_COMPLETE_FILE"
  rm -f "$SETUP_STATUS_FILE"
  setup_token="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  server_address="$(hostname -I 2>/dev/null | awk '{print $1}')"
  server_address="${server_address:-$(hostname 2>/dev/null || printf 'your-server-ip')}"

  docker rm -f "$SETUP_CONTAINER" >/dev/null 2>&1 || true
  docker run -d --rm \
    --name "$SETUP_CONTAINER" \
    --network host \
    --user "$(id -u):$(id -g)" \
    --env "SETUP_TOKEN=$setup_token" \
    --env "SERVER_ADDRESS=$server_address" \
    --env "SETUP_BIND_ADDRESS=0.0.0.0" \
    --env "SETUP_TTL_SECONDS=86400" \
    --volume "$ROOT_DIR/deploy:/setup:rw" \
    node:22-alpine \
    node /setup/setup-server.mjs >/dev/null

  cleanup_setup() {
    local exit_code=$?
    if [ "$exit_code" -eq 0 ]; then
      if ! grep -q '"phase":"completed"' "$SETUP_STATUS_FILE" 2>/dev/null; then
        write_setup_status "completed" "OpenBcon is deployed."
      fi
    elif [ -f "$SETUP_COMPLETE_FILE" ]; then
      if ! grep -q '"phase":"failed"' "$SETUP_STATUS_FILE" 2>/dev/null; then
        write_setup_status "failed" "Deployment failed. Check the VPS terminal output."
      fi
    fi
    sleep 20
    docker rm -f "$SETUP_CONTAINER" >/dev/null 2>&1 || true
    return "$exit_code"
  }
  trap cleanup_setup EXIT

  printf '\nOpenBcon Bootstrap Setup is ready.\n'
  printf 'The temporary setup server is available on %s:8090.\n' "$server_address"
  printf 'Open this URL from your browser:\n  http://%s:8090/setup?token=%s\n' "$server_address" "$setup_token"
  printf 'Port 8090 is temporary and the setup server expires after 24 hours.\n'
  printf 'If the page is unreachable, temporarily allow inbound TCP 8090 in the VPS firewall.\n'
  printf 'This terminal will continue automatically after you save the form.\n\n'

  while [ ! -f "$SETUP_COMPLETE_FILE" ]; do
    if ! docker inspect -f '{{.State.Running}}' "$SETUP_CONTAINER" 2>/dev/null | grep -q '^true$'; then
      write_setup_status "failed" "The setup page stopped before saving the configuration."
      exit 1
    fi
    sleep 1
  done
fi

cd "$ROOT_DIR"

# Stamp the frontend with the source commit so Admin Console can compare the
# running build with the latest commit on GitHub.
if [ -z "${VITE_APP_COMMIT:-}" ]; then
  VITE_APP_COMMIT="$(git rev-parse --short=12 HEAD 2>/dev/null || printf 'unknown')"
  export VITE_APP_COMMIT
fi

compose=(docker compose --project-name openbcon --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
if [ -f "$PROXY_OVERRIDE_FILE" ]; then
  compose+=( -f "$PROXY_OVERRIDE_FILE" )
fi
if [ "$SETUP_STATUS_ENABLED" -eq 1 ]; then
  write_setup_status "starting_services" "Starting PostgreSQL, MongoDB, and Ollama."
fi
if ! compose_config_error="$("${compose[@]}" config 2>&1)"; then
  write_setup_status "failed" "Docker Compose configuration is invalid: $(printf '%s' "$compose_config_error" | tr '\n' ' ' | cut -c1-240)"
  printf '%s\n' "$compose_config_error" >&2
  exit 1
fi
"${compose[@]}" up -d --build postgres mongodb ollama ollama-model

# The primary Postgres database is the shared platform catalog. Create the
# tenant databases before the API starts its per-database migrations. This is
# idempotent so repeated deployments do not disturb existing tenant data.
postgres_user="$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | head -n 1)"
postgres_user="${postgres_user:-admin}"
database_name_from_url() {
  local url="${1%%\?*}"
  printf '%s' "${url##*/}"
}

database_url_test="$(sed -n 's/^DATABASE_URL_TEST=//p' "$ENV_FILE" | head -n 1)"
database_url_live="$(sed -n 's/^DATABASE_URL_LIVE=//p' "$ENV_FILE" | head -n 1)"
database_prefix="$(sed -n 's/^DBOB_DATABASE_PREFIX=//p' "$ENV_FILE" | head -n 1)"
database_prefix="${database_prefix:-dbob1234567890}"
tenant_databases=(
  "$(database_name_from_url "${database_url_test:-postgresql://localhost/${database_prefix}_test}")"
  "$(database_name_from_url "${database_url_live:-postgresql://localhost/${database_prefix}_live}")"
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
if [ "$SETUP_STATUS_ENABLED" -eq 1 ]; then
  write_setup_status "starting_application" "Starting the OpenBcon API, AI service, and HTTPS proxy."
fi
if ! caddy_config_error="$("${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1)"; then
  write_setup_status "failed" "Caddy configuration validation failed: $(printf '%s' "$caddy_config_error" | tr '\n' ' ' | cut -c1-240)"
  printf '%s\n' "$caddy_config_error" >&2
  exit 1
fi
"${compose[@]}" up -d --build api python caddy
if [ "$SETUP_STATUS_ENABLED" -eq 1 ]; then
  write_setup_status "starting_application" "Waiting for API, AI service, and Caddy health checks."
fi
"${compose[@]}" ps

wait_for_healthy_service() {
  local service="$1"
  local timeout_seconds=180
  local started_at
  local container_id
  local health
  started_at="$(date +%s)"
  while true; do
    container_id="$("${compose[@]}" ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container_id" ]; then
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
      if [ "$health" = "healthy" ] || { [ "$service" = "caddy" ] && [ "$health" = "running" ]; }; then
        return 0
      fi
      if [ "$health" = "unhealthy" ] || [ "$health" = "exited" ] || [ "$health" = "dead" ]; then
        write_setup_status "failed" "The ${service} service is ${health}. Inspect its logs with: docker compose --env-file deploy/.env.production -f deploy/docker-compose.production.yml logs --tail=200 ${service}"
        return 1
      fi
    fi
    if [ "$(( $(date +%s) - started_at ))" -ge "$timeout_seconds" ]; then
      write_setup_status "failed" "The ${service} service did not become healthy within ${timeout_seconds} seconds. Inspect its logs with: docker compose --env-file deploy/.env.production -f deploy/docker-compose.production.yml logs --tail=200 ${service}"
      return 1
    fi
    sleep 3
  done
}

wait_for_public_health() {
  local domain
  local protocol
  local url
  local attempt
  local response
  local body
  local http_status
  local last_error="No response yet."
  domain="$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)"
  protocol="http"
  [ "$domain" != "localhost" ] && protocol="https"
  url="${protocol}://${domain}/api/health"
  if ! command -v curl >/dev/null 2>&1; then
    write_setup_status "failed" "Public health verification needs curl on the VPS. Install curl, then run ./deploy/deploy.sh --setup again."
    return 1
  fi
  for attempt in $(seq 1 24); do
    response="$(curl -sS --max-time 8 -w $'\n%{http_code}' "$url" 2>&1 || true)"
    http_status="${response##*$'\n'}"
    body="${response%$'\n'*}"
    if [ "$http_status" = "200" ] && printf '%s' "$body" | grep -q '"status":"ok"'; then
      return 0
    fi
    last_error="HTTP ${http_status}: $(printf '%s' "$body" | tr '\n' ' ' | cut -c1-160)"
    sleep 5
  done
  write_setup_status "failed" "Public ${protocol^^} health check failed for ${domain}. ${last_error} Check DNS, inbound TCP 80/443, and Caddy or Traefik logs."
  return 1
}

if [ "$SETUP_STATUS_ENABLED" -eq 1 ]; then
  for service in api python caddy; do
    wait_for_healthy_service "$service" || exit 1
  done
  write_setup_status "services_ready" "PostgreSQL, MongoDB, Ollama, API, Python, and Caddy are healthy. Verifying public HTTPS."
  write_setup_status "verifying" "Services are healthy. Waiting for ${domain:-the public domain} HTTPS and /api/health."
  wait_for_public_health || exit 1
  write_setup_status "completed" "OpenBcon is deployed and the public HTTPS health check passed."
fi

printf '\nDeployment started.\n'
printf 'Open https://%s after DNS and the first certificate issuance complete.\n' "$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)"
