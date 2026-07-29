# PostgreSQL Architecture

## Purpose

The database layer persists every editable state currently exposed by the React
application while preserving the existing frontend behavior. PostgreSQL is the
cross-session source of truth; `localStorage` remains a cache and offline fallback.

## Schema

### `app_users`

Stores user identity, account role, and status. The included seed creates one
development owner.

### `workspaces`

Stores the tenant boundary. A workspace has a type of `founder`, `partner`, or
`client`.

### `workspace_members`

Maps users to workspaces with `owner`, `admin`, `member`, or `viewer` roles.

### `app_state`

Stores the currently implemented frontend modules as scoped JSONB records:

```text
scope       platform | workspace | user
owner_id    platform sentinel, workspace ID, or user ID
key         allowlisted Bconomics state key
value       JSONB document
version     incremented on each update
updated_by  user responsible for the mutation
```

The composite primary key is `(scope, owner_id, key)`.

### `audit_logs`

Records each state update or deletion with the actor, workspace, state key, and
scope. Audit entries are append-only through the application API.

## State ownership

Platform state includes branding, feature flags, payment/AI configuration, data
sources, and synchronized catalog records.

Workspace state includes companies, applications, saved programs, Quick Generate
drafts, selected records, and generated document packages.

User state includes profile settings, notification preferences, pinned resources,
saved tools, workspace list, and active workspace selection.

Authentication and refresh tokens are explicitly excluded by both frontend and
server allowlists.

## API

```text
GET    /api/health
GET    /api/bootstrap
POST   /api/state/batch
PUT    /api/state/:key
DELETE /api/state/:key?scope=workspace
```

`/api/bootstrap` loads platform, active workspace, and user state in one request.
The frontend uploads supported local-only records on its first successful
connection.

During development the API uses `DEMO_USER_ID` and `DEMO_WORKSPACE_ID`.
User-supplied identity headers are intentionally ignored. Replace this development
context with verified server-side session claims before production.

## Local setup

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Inspect the database:

```bash
docker exec -it bconomics-postgres \
  psql -U bconomics -d bconomics
```

Stop the local database:

```bash
npm run db:down
```

The named Docker volume preserves data between restarts. Use
`docker compose down --volumes` only when intentionally deleting local data.

## Migrations

Migration files live in `server/db/migrations` and are applied in filename order.
Applied filenames are recorded in `schema_migrations`.

Never modify a migration that has shipped. Add a new numbered SQL migration.

## Production checklist

1. Use a managed PostgreSQL instance with TLS, backups, and point-in-time recovery.
2. Set `DATABASE_SSL=true` where required.
3. Set `SEED_DEMO_DATA=false`.
4. Connect authenticated user and workspace claims on the server.
5. Enforce workspace membership before every read and mutation.
6. Restrict CORS to the production domain.
7. Move AI, payment, Airtable, and OAuth secrets to a secret manager.
8. Add rate limiting and retention policies for audit logs.

## Normalization roadmap

The JSONB compatibility layer prevents a large frontend rewrite and makes every
current page persistent now. High-volume modules can be migrated incrementally to
normalized tables:

1. Companies and company contacts
2. Funding programs and data-source ingestion runs
3. Applications, tasks, and document requirements
4. Generated document packages and file objects
5. Billing subscriptions, invoices, and usage events

The API boundary allows these migrations without changing page URLs or user
workflows.
