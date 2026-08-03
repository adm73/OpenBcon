# Database Architecture

## Purpose

The database layer persists every editable state currently exposed by the React
application while preserving the existing frontend behavior. PostgreSQL is the
source of truth for relational domain records, MongoDB stores dynamic JSON
configuration, and `localStorage` remains a cache and offline fallback.

## Schema

### `app_users`

Stores user identity, account role, and status. The included seed creates one
development owner.

### `workspaces`

Stores the tenant boundary. A workspace has a type of `founder`, `partner`, or
`client`.

### `workspace_members`

Maps users to workspaces with `owner`, `admin`, `member`, or `viewer` roles.

### MongoDB `dynamic_state`

Stores editable dynamic configuration as scoped documents:

```text
scope       platform | workspace | user
ownerId     platform sentinel, workspace ID, or user ID
key         allowlisted Bconomics state key
value       JSON document
updatedAt   last mutation time
```

The unique MongoDB index is `(scope, ownerId, key)`.

### `applications`

Stores the canonical application records linked to `companies`,
`funding_programs`, and `app_users`. Quick Build, Saved Programs, My
Applications, and Strategic Review Reports use the numeric `applications.id`.
The `app_id` column is a unique 16-character SHA-256-derived identifier for
external API calls; it is intentionally separate from the numeric primary key.

The `strategic_review_reports` JSONB column stores the single application-facing
Strategic Report snapshot used by the workspace UI; the old `generated_package`
column has been removed.

The `strategic_reports` table stores one LangGraph generation run per application.
Its unique `application_id` relationship ensures that regenerating an application
updates its existing Strategic Report instead of creating a second one. It records
the application and owner, model, request and context snapshots, per-node
`graph_trace`, final `result`, status, and errors. It replaces the legacy
`funding_packages`, `funding_package_runs`, `funding_package_sections`, and
`funding_package_artifacts` tables.

### `audit_logs`

Records each state update or deletion with the actor, workspace, state key, and
scope. Audit entries are append-only through the application API.

## State ownership

Platform state includes branding, landing-page content, feature flags, payment/AI
configuration, data sources, and synchronized catalog records in MongoDB.

Workspace state includes saved-program preferences and Quick Build drafts in
MongoDB. Companies, applications, and report records are relational PostgreSQL
tables.

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

`/api/bootstrap` loads MongoDB dynamic state and relational application records in
one request.
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

`db:setup` copies legacy PostgreSQL `app_state` rows to MongoDB before applying
the migration that removes that table. Running `npm run db:migrate-state-to-mongo`
manually is only needed when upgrading an existing deployment outside the setup
script.

Inspect the database:

```bash
docker exec -it bconomics-postgres \
  psql -U bconomics -d bconomics

docker exec -it bconomics-mongodb \
  mongosh bconomics
```

Stop the local database:

```bash
npm run db:down
```

The named PostgreSQL and MongoDB volumes preserve data between restarts. Use
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
