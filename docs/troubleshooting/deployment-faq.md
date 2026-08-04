# Deployment FAQ

This FAQ collects common deployment failures and the checks that resolve them.
Use placeholders such as `open.example.com` and never paste production secrets
into GitHub issues, pull requests, or documentation.

## Docker Compose says `POSTGRES_PASSWORD` is missing

`.env.production` is not automatically loaded by Docker Compose. Add the env
file to every Compose command that reads the production file:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  ps
```

This also applies to `logs`, `config`, `up`, and `exec`.

## The API logs `tsx: not found`

The runtime image must install the production dependency that starts the API.
Pull the latest code and rebuild the API image without using an old image:

```bash
git pull --ff-only
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build api
```

The current image keeps `tsx` in runtime dependencies and installs it with
`npm ci --omit=dev`.

## PostgreSQL says `password authentication failed`

Check the values used by the running Compose project:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  config
```

Do not print or share the resulting secret values. If the PostgreSQL volume
was already initialized with a different password, changing the environment
file alone does not change the existing database password. Back up the data
and use a deliberate PostgreSQL password-rotation procedure instead of
deleting the volume.

## Migration fails with `cannot drop constraint app_users_pkey`

This means an obsolete UUID-to-numeric migration is being applied to a
baseline that already creates numeric IDs. The current `006_numeric_app_user_ids.sql`
and `007_numeric_company_ids.sql` are ordering-preserving no-op migrations for
fresh databases.

Pull the latest code and retry without deleting database volumes:

```bash
git pull --ff-only
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build api
```

If a historical database has not applied those migrations and still uses the
old UUID schema, stop and take a backup before attempting any manual migration.

## Ports 80 and 443 are already in use

Check which process owns the ports:

```bash
ss -ltnp | grep -E ':(80|443|8080)\b'
```

If Hostinger Traefik owns 80 and 443, do not stop it if other applications use
it. Map the OpenBcon Caddy service to loopback HTTP instead:

```yaml
ports:
  - "127.0.0.1:8080:80"
```

Then configure a Traefik router for the public hostname and point it to
`http://127.0.0.1:8080` when Traefik uses host networking. The project Caddy
should use `http://{$DOMAIN}` in this architecture.

## HTTPS returns a self-signed certificate

A self-signed certificate usually means the public request reached a default
Traefik certificate instead of a router with the Let’s Encrypt resolver.

Check:

```bash
dig +short A open.example.com
dig +short AAAA open.example.com
docker compose logs --tail=200 traefik
```

Confirm that the hostname router has:

```yaml
tls:
  certResolver: letsencrypt
```

Do not treat `curl -k` as a solution. It skips certificate verification.

## Traefik reports `dynamic.yml is a directory`

When a bind-mount source file does not exist, Docker can create a directory at
that path. Remove only the accidental empty directory and create a regular
file:

```bash
file /etc/traefik/dynamic.yml
if [ -d /etc/traefik/dynamic.yml ]; then rmdir /etc/traefik/dynamic.yml; fi
```

Use an absolute mount to remove ambiguity:

```yaml
- /etc/traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
```

Recreate Traefik after correcting the mount:

```bash
docker compose up -d --force-recreate traefik
```

Do not use `down -v`; the ACME certificate volume must be preserved.

## The API is healthy but the public URL returns 502

Test each layer separately:

```bash
curl -i http://127.0.0.1:8080/api/health
curl -i https://open.example.com/api/health
```

If the private request succeeds and the public request fails, inspect Traefik
router and service logs. If both fail, inspect the project API and Caddy logs:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  logs --tail=200 api caddy
```

## The Python AI service is unhealthy

Check the Python container logs and health endpoint:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  logs --tail=200 python
```

The Python service needs the database and MongoDB connection values from the
production env file. Live generation also requires a valid server-side
`OPENBCON_OPENAI_API_KEY`; never put that key in frontend variables.

## The browser shows a blank page after an update

Check API and Caddy health first, then force-refresh the browser. For a local
development server, restart Vite after moving or renaming a source module:

```bash
npm run dev
```

A successful production build is also useful:

```bash
npm run build
```

## What should be included in a GitHub issue?

Include:

- the OpenBcon commit or image tag
- the operating system and Docker version
- the sanitized Compose command
- relevant redacted logs
- the output of `docker compose ps`
- whether the failure is local, VPS-internal, or public HTTPS

Never include passwords, API keys, cookies, `acme.json`, database dumps, or
customer data.
