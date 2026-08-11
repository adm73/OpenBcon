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

# The updater needs to know the host checkout path for its bind mount. Keep the
# generated token and path in the ignored production env file so direct Compose
# commands use the same values as this script.
set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  printf 'Missing %s. Run ./deploy/deploy.sh --setup first.\n' "$ENV_FILE" >&2
  exit 1
fi

# Migrate older single-domain environment files before Compose interpolates
# its required values. Existing deployments may only have DOMAIN and
# PUBLIC_APP_URL; derive the new public/dashboard settings without changing
# credentials or data-volume configuration.
get_env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | head -n 1
}

public_domain="$(get_env_value PUBLIC_DOMAIN)"
if [ -z "$public_domain" ]; then
  public_domain="$(get_env_value DOMAIN)"
  # Older deployments commonly used www.example.com as DOMAIN. The new
  # public/dashboard split uses the base domain plus dashboard.base-domain.
  public_domain="${public_domain#www.}"
fi
dashboard_domain="$(get_env_value DASHBOARD_DOMAIN)"
dashboard_domain="${dashboard_domain:-dashboard.${public_domain}}"
if [ -z "$public_domain" ] || [ -z "$dashboard_domain" ]; then
  printf 'Missing PUBLIC_DOMAIN/DASHBOARD_DOMAIN. Set PUBLIC_DOMAIN (or legacy DOMAIN) in %s, then rerun.\n' "$ENV_FILE" >&2
  exit 1
fi
if [ "$public_domain" = "localhost" ]; then
  public_site_url="http://localhost:5173"
else
  public_site_url="https://${public_domain}"
fi
if [ "$dashboard_domain" = "localhost" ]; then
  dashboard_app_url="http://localhost:5173"
else
  dashboard_app_url="https://${dashboard_domain}"
fi
set_env_value PUBLIC_DOMAIN "$public_domain"
set_env_value DASHBOARD_DOMAIN "$dashboard_domain"
if [ -z "$(get_env_value PUBLIC_SITE_URL)" ]; then
  set_env_value PUBLIC_SITE_URL "$public_site_url"
fi
if [ -z "$(get_env_value DASHBOARD_APP_URL)" ]; then
  set_env_value DASHBOARD_APP_URL "$dashboard_app_url"
fi
if [ -z "$(get_env_value PUBLIC_APP_URL)" ]; then
  set_env_value PUBLIC_APP_URL "$dashboard_app_url"
fi
if [ -z "$(get_env_value CORS_ORIGIN)" ]; then
  set_env_value CORS_ORIGIN "${public_site_url},${dashboard_app_url}"
fi

# The update agent runs this script from its /workspace bind mount. In that
# context, keep the host path already stored in the env file. Compose must use
# that host path when the Docker daemon recreates the services.
if [ "${OPENBCON_SKIP_UPDATE_AGENT:-0}" != "1" ]; then
  set_env_value OPENBCON_ROOT "$ROOT_DIR"
fi

# Older setup sessions generated a relative Caddyfile path. The update agent
# runs Compose inside a container, but the Docker daemon mounts paths from the
# host, so normalize that generated override before Compose validates it.
if [ -f "$PROXY_OVERRIDE_FILE" ]; then
  sed -i 's|\./Caddyfile\.http|${OPENBCON_ROOT:-/opt/openbcon}/deploy/Caddyfile.http|g' "$PROXY_OVERRIDE_FILE"
fi

update_agent_token="$(sed -n 's/^OPENBCON_UPDATE_TOKEN=//p' "$ENV_FILE" | head -n 1)"
if [ -z "$update_agent_token" ] || [[ "$update_agent_token" == replace_* ]]; then
  update_agent_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  set_env_value OPENBCON_UPDATE_TOKEN "$update_agent_token"
fi

# Stamp the frontend with the current checkout, not inherited values from an
# older container or shell. This keeps Admin Console's build label accurate
# after an update agent fast-forwards the repository.
VITE_APP_COMMIT="$(git rev-parse --short=12 HEAD 2>/dev/null || printf 'unknown')"
export VITE_APP_COMMIT
VITE_APP_VERSION="$(git describe --tags --exact-match HEAD 2>/dev/null || printf 'unreleased')"
export VITE_APP_VERSION

compose=(docker compose --project-name openbcon --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
enable_ollama="$(sed -n 's/^ENABLE_OLLAMA=//p' "$ENV_FILE" | head -n 1 | tr '[:upper:]' '[:lower:]')"
enable_ollama="${enable_ollama:-false}"
if [ "$enable_ollama" = "true" ] || [ "$enable_ollama" = "1" ] || [ "$enable_ollama" = "yes" ]; then
  compose+=( --profile ollama )
  enable_ollama=1
else
  enable_ollama=0
fi
if [ -f "$PROXY_OVERRIDE_FILE" ]; then
  compose+=( -f "$PROXY_OVERRIDE_FILE" )
fi
if [ "$SETUP_STATUS_ENABLED" -eq 1 ]; then
  if [ "$enable_ollama" -eq 1 ]; then
    write_setup_status "starting_services" "Starting PostgreSQL, MongoDB, and Ollama."
  else
    write_setup_status "starting_services" "Starting PostgreSQL and MongoDB. Ollama is disabled."
  fi
fi
if ! compose_config_error="$("${compose[@]}" config 2>&1)"; then
  write_setup_status "failed" "Docker Compose configuration is invalid: $(printf '%s' "$compose_config_error" | tr '\n' ' ' | cut -c1-240)"
  printf '%s\n' "$compose_config_error" >&2
  exit 1
fi
if [ "$enable_ollama" -eq 1 ]; then
  "${compose[@]}" up -d --build postgres mongodb ollama ollama-model
else
  "${compose[@]}" up -d --build postgres mongodb
fi

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
database_url_shared="$(sed -n 's/^DATABASE_URL_SHARED=//p' "$ENV_FILE" | head -n 1)"
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
application_services=(api python caddy)
if [ "${OPENBCON_SKIP_UPDATE_AGENT:-0}" != "1" ]; then
  application_services+=(updater)
fi
"${compose[@]}" up -d --build --force-recreate "${application_services[@]}"
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
  local public_domain
  local dashboard_domain
  local domain
  local protocol
  local url
  local attempt
  local response
  local body
  local http_status
  local last_error
  public_domain="$(sed -n 's/^PUBLIC_DOMAIN=//p' "$ENV_FILE" | head -n 1)"
  public_domain="${public_domain:-$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)}"
  dashboard_domain="$(sed -n 's/^DASHBOARD_DOMAIN=//p' "$ENV_FILE" | head -n 1)"
  dashboard_domain="${dashboard_domain:-dashboard.${public_domain}}"
  if ! command -v curl >/dev/null 2>&1; then
    write_setup_status "failed" "HTTPS health verification needs curl on the VPS. Install curl, then run ./deploy/deploy.sh --setup again."
    return 1
  fi
  for domain in "$public_domain" "$dashboard_domain"; do
    [ -z "$domain" ] && continue
    protocol="http"
    [ "$domain" != "localhost" ] && protocol="https"
    url="${protocol}://${domain}/api/health"
    last_error="No response yet."
    for attempt in $(seq 1 24); do
      response="$(curl -sS --max-time 8 -w $'\n%{http_code}' "$url" 2>&1 || true)"
      http_status="${response##*$'\n'}"
      body="${response%$'\n'*}"
      if [ "$http_status" = "200" ] && printf '%s' "$body" | grep -q '"status":"ok"'; then
        last_error=""
        break
      fi
      last_error="HTTP ${http_status}: $(printf '%s' "$body" | tr '\n' ' ' | cut -c1-160)"
      sleep 5
    done
    if [ -n "$last_error" ]; then
      write_setup_status "failed" "${protocol^^} health check failed for ${domain}. ${last_error} Check DNS, inbound TCP 80/443, and Caddy or Traefik logs."
      return 1
    fi
  done
}

bootstrap_admin_account() {
  local admin_email
  local admin_password_b64
  local admin_password
  local admin_database
  local admin_sql_file
  local admin_email_sql
  local admin_password_sql
  admin_email="$(sed -n 's/^OPENBCON_INITIAL_ADMIN_EMAIL=//p' "$ENV_FILE" | head -n 1)"
  admin_password_b64="$(sed -n 's/^OPENBCON_INITIAL_ADMIN_PASSWORD_B64=//p' "$ENV_FILE" | head -n 1)"
  if [ -z "$admin_email" ] && [ -z "$admin_password_b64" ]; then
    return 0
  fi
  if [ -z "$admin_email" ] || [ -z "$admin_password_b64" ]; then
    write_setup_status "failed" "The initial administrator credentials are incomplete. Run ./deploy/deploy.sh --setup again."
    return 1
  fi
  if ! admin_password="$(printf '%s' "$admin_password_b64" | base64 -d 2>/dev/null)" || [ -z "$admin_password" ]; then
    write_setup_status "failed" "The initial administrator password could not be decoded. Run ./deploy/deploy.sh --setup again."
    return 1
  fi

  sql_literal() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\'/\'\'}"
    printf '%s' "$value"
  }
  admin_email_sql="$(sql_literal "$admin_email")"
  admin_password_sql="$(sql_literal "$admin_password")"
  admin_sql_file="$(mktemp "$ROOT_DIR/deploy/.bootstrap-admin.XXXXXX.sql")"
  chmod 600 "$admin_sql_file"
  cat > "$admin_sql_file" <<SQL
\\set admin_email '$admin_email_sql'
\\set admin_password '$admin_password_sql'
BEGIN;
WITH admin_user AS (
  INSERT INTO app_users (email, display_name, role, status, password_hash, email_verified_at)
  VALUES (lower(:'admin_email'), 'OpenBcon Administrator', 'admin', 'active', crypt(:'admin_password', gen_salt('bf')), now())
  ON CONFLICT (email) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = 'admin',
    status = 'active',
    password_hash = EXCLUDED.password_hash,
    email_verified_at = COALESCE(app_users.email_verified_at, now())
  RETURNING id
)
INSERT INTO workspaces (name, slug, kind, status, created_by)
SELECT 'OpenBcon workspace', 'openbcon-admin-workspace', 'founder', 'active', id
FROM admin_user
ON CONFLICT (slug) DO UPDATE SET
  status = 'active',
  created_by = EXCLUDED.created_by;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT workspaces.id, app_users.id, 'owner'
FROM workspaces
JOIN app_users ON lower(app_users.email) = lower(:'admin_email')
WHERE workspaces.slug = 'openbcon-admin-workspace'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
COMMIT;
SQL

  # Create the administrator in the shared catalog database first, then in
  # both runtime databases. Shared catalog rows use the first shared user as
  # their created_by/updated_by actor; runtime users remain mode-isolated.
  for admin_database in \
    "$(database_name_from_url "${database_url_shared:-postgresql://localhost/${database_prefix}}")" \
    "$(database_name_from_url "${database_url_test:-postgresql://localhost/${database_prefix}_test}")" \
    "$(database_name_from_url "${database_url_live:-postgresql://localhost/${database_prefix}_live}")"; do
    if "${compose[@]}" exec -T postgres psql -U "$postgres_user" -d "$admin_database" -v ON_ERROR_STOP=1 < "$admin_sql_file"; then
      :
    else
      rm -f "$admin_sql_file"
      write_setup_status "failed" "The initial administrator account could not be created in database ${admin_database}. Inspect the API and PostgreSQL logs, then run ./deploy/deploy.sh --setup again."
      return 1
    fi
  done
  rm -f "$admin_sql_file"

  # This value is only needed during first bootstrap. Never leave the admin
  # password, even encoded, in the deployment environment after success.
  sed -i \
    -e 's/^OPENBCON_INITIAL_ADMIN_EMAIL=.*/OPENBCON_INITIAL_ADMIN_EMAIL=/' \
    -e 's/^OPENBCON_INITIAL_ADMIN_PASSWORD_B64=.*/OPENBCON_INITIAL_ADMIN_PASSWORD_B64=/' \
    "$ENV_FILE"
}

if [ "$SETUP_STATUS_ENABLED" -eq 1 ]; then
  for service in api python caddy updater; do
    wait_for_healthy_service "$service" || exit 1
  done
  bootstrap_admin_account || exit 1
  if [ "$enable_ollama" -eq 1 ]; then
    write_setup_status "services_ready" "PostgreSQL, MongoDB, Ollama, API, Python, and Caddy are healthy. The initial administrator account was created in Shared, Test, and Live databases. Verifying public HTTPS."
  else
    write_setup_status "services_ready" "PostgreSQL, MongoDB, API, Python, and Caddy are healthy. Ollama is disabled. The initial administrator account was created in Shared, Test, and Live databases. Verifying public HTTPS."
  fi
  public_domain="$(sed -n 's/^PUBLIC_DOMAIN=//p' "$ENV_FILE" | head -n 1)"
  public_domain="${public_domain:-$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)}"
  dashboard_domain="$(sed -n 's/^DASHBOARD_DOMAIN=//p' "$ENV_FILE" | head -n 1)"
  dashboard_domain="${dashboard_domain:-dashboard.${public_domain}}"
  write_setup_status "verifying" "Services are healthy. Waiting for ${public_domain} and ${dashboard_domain} HTTPS and /api/health."
  wait_for_public_health || exit 1
  write_setup_status "completed" "OpenBcon is deployed and the public HTTPS health check passed."
fi

printf '\nDeployment started.\n'
public_domain="$(sed -n 's/^PUBLIC_DOMAIN=//p' "$ENV_FILE" | head -n 1)"
public_domain="${public_domain:-$(sed -n 's/^DOMAIN=//p' "$ENV_FILE" | head -n 1)}"
dashboard_domain="$(sed -n 's/^DASHBOARD_DOMAIN=//p' "$ENV_FILE" | head -n 1)"
dashboard_domain="${dashboard_domain:-dashboard.${public_domain}}"
printf 'Open https://%s for the public site and https://%s for the dashboard after DNS and the first certificate issuance complete.\n' "$public_domain" "$dashboard_domain"
