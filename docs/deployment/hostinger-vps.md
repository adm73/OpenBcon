# Deploy OpenBcon on a Hostinger VPS

This guide documents a production deployment on a Hostinger VPS where the
Hostinger Docker Manager already runs Traefik on ports 80 and 443.

If no other service owns ports 80 and 443, use the default
`deploy/docker-compose.production.yml`: the project Caddy container can manage
public HTTPS directly. This guide is for the shared-entrypoint setup:

```text
Internet
  -> Hostinger Traefik :443
  -> 127.0.0.1:8080
  -> OpenBcon Caddy :80
  -> api:8787 / python:8010
  -> PostgreSQL / MongoDB
```

## Prerequisites

- A Hostinger VPS with Docker Engine and Docker Compose
- A DNS `A` record pointing the deployment hostname to the VPS public IPv4 address
- No conflicting `AAAA` record pointing the hostname to another server
- A working Hostinger Traefik application with ports 80 and 443 available for the hostname
- A server-side OpenAI API key if live generation is enabled

Do not commit `.env.production`, database passwords, API keys, or the Traefik
ACME storage file to Git.

## Prepare DNS

Create an `A` record such as:

```text
open.example.com -> YOUR_VPS_IPV4
```

Check the result from the VPS:

```bash
dig +short A open.example.com
dig +short AAAA open.example.com
```

The `A` response must be the VPS address. Remove or correct an unexpected
`AAAA` record before requesting a certificate.

## Configure production secrets

From the repository root:

```bash
cp deploy/.env.production.example deploy/.env.production
openssl rand -hex 32
```

Edit `deploy/.env.production` and set at least:

```dotenv
DOMAIN=your-domain.example
POSTGRES_PASSWORD=use_a_long_random_alphanumeric_value
MONGODB_ROOT_PASSWORD=use_a_different_long_random_value
APP_STATE_ENCRYPTION_KEY=the_64_character_hex_value_from_openssl
OPENBCON_OPENAI_API_KEY=your_server_side_key
SEED_DEMO_DATA=false
```

For email verification, keep the SMTP settings in the production example or
replace them with your provider's values:

```dotenv
PUBLIC_APP_URL=https://your-domain.example
EMAIL_PROVIDER=smtp
EMAIL_FROM=OpenBcon <no-reply@your-domain.example>
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@your-domain.example
SMTP_PASSWORD=your_mailbox_password
```

To enable Google registration, create a Google OAuth web client and add this
authorized redirect URI:

```text
https://your-domain.example/api/auth/google/callback
```

Then set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and
`GOOGLE_OAUTH_REDIRECT_URI` in `deploy/.env.production`. Never put these values
in Vite frontend variables or commit them to Git.

Keep `APP_STATE_ENCRYPTION_KEY` stable. Changing it can make previously
encrypted application settings unreadable.

## Adapt the project Caddy service

The default production Compose file maps Caddy directly to ports 80 and 443.
When Hostinger Traefik already owns those ports, change the `caddy` service to
map only a loopback HTTP port:

```yaml
ports:
  - "127.0.0.1:8080:80"
```

Do not map the project Caddy `443` port in this mode.

Change the first line of `deploy/Caddyfile` to make the internal Caddy listener
HTTP-only:

```caddyfile
http://{$DOMAIN} {
```

Keep the internal routes pointed at Docker service names:

```caddyfile
handle_path /ai-api/* {
    reverse_proxy python:8010
}

handle /api/* {
    reverse_proxy api:8787
}
```

Do not add `reverse_proxy 127.0.0.1:8080` to this file. That would make the
project Caddy proxy to its own host-mapped port.

## Configure Hostinger Traefik

Open Docker Manager and manage the existing `traefik` application. The Traefik
configuration needs a router for the public hostname and a service pointing to
the project Caddy port.

The Traefik application should have these static settings:

```yaml
network_mode: host
```

```yaml
command:
  - "--providers.docker=true"
  - "--providers.docker.exposedbydefault=false"
  - "--providers.file.filename=/etc/traefik/dynamic.yml"
  - "--providers.file.watch=true"
  - "--entrypoints.web.address=:80"
  - "--entrypoints.websecure.address=:443"
  - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
  - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
  - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
  - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
  - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
  - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
```

Mount the dynamic configuration as a file. An absent bind source can be
created as a directory by Docker, so create the file before starting Traefik:

```yaml
volumes:
  - traefik-letsencrypt:/letsencrypt
  - /var/run/docker.sock:/var/run/docker.sock:ro
  - /etc/traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
```

Create `/etc/traefik/dynamic.yml`:

```yaml
http:
  routers:
    openbcon:
      rule: "Host(`open.example.com`)"
      entryPoints:
        - websecure
      service: openbcon
      tls:
        certResolver: letsencrypt

  services:
    openbcon:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8080"
```

Because this Traefik container uses host networking, `127.0.0.1:8080` refers
to the VPS host and reaches the project Caddy mapping. If the Traefik
installation does not use host networking, use a host-gateway address that is
reachable from the Traefik container instead.

Make sure `dynamic.yml` is a regular file, not a directory:

```bash
file /etc/traefik/dynamic.yml
```

Then recreate Traefik without deleting its volumes:

```bash
docker compose up -d --force-recreate traefik
docker compose logs -f --tail=100 traefik
```

## Start OpenBcon

For the first deployment, the repository can run a temporary public setup page
so no SSH tunnel is required. Allow inbound TCP port `8090` temporarily in the
VPS firewall, run the setup command below, and open the URL printed in the VPS
terminal. The URL contains a one-time token and expires after 24 hours. Close
port `8090` again after the form is saved; the deployment script stops the setup
container automatically.

After saving, the page continues to display configuration, DNS, service,
HTTPS, and `/api/health` checks. When deployment succeeds it shows the public
application URL; when it fails it points you to the `deploy.sh` terminal output
and the retry command.

Run all Compose commands with the production env file. Compose does not
automatically load `.env.production` for interpolation:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build
```

Or use the repository deployment script, which supplies the env file for you:

```bash
./deploy/deploy.sh
```

To re-run the setup wizard for an existing deployment:

```bash
./deploy/deploy.sh --setup
```

Open the printed address in a browser, for example:

```text
http://YOUR_VPS_IPV4:8090/setup?token=...
```

Do not leave port `8090` open after setup. It is not an application port and is
only used for the temporary bootstrap wizard.

Check the services:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  ps
```

Inspect logs with the same `--env-file` flag:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  logs -f --tail=200 api
```

## Verify the deployment

Test the private project Caddy mapping from the VPS:

```bash
curl -i http://127.0.0.1:8080/api/health
```

Test the public HTTPS route:

```bash
curl -i https://open.example.com/api/health
```

A healthy Node API returns HTTP 200 and JSON containing:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Do not use `curl -k` as the final fix. It only bypasses certificate
verification and can hide a broken Traefik certificate configuration.

## Updates and data safety

```bash
git pull --ff-only
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build
```

The API runs migrations automatically when `AUTO_MIGRATE=true`. Do not run
`docker compose down --volumes` during a normal update. That command deletes
the PostgreSQL and MongoDB data volumes.

Before production upgrades, back up PostgreSQL and MongoDB and review the
migrations in `server/db/migrations/`.
