# Bconomics Open Platform

Bconomics is an open-source funding workspace for discovering programs, organizing applications, and generating funding-ready business documents.

The repository currently includes three product surfaces:

- `/` - public landing page
- `/dashboard` - user workspace
- `/admin` - platform configuration console

Every workspace module uses a flat route such as `/funding-readiness`, `/quick-generate`, and `/grants-loans`.

## Current features

- Responsive landing page and dashboard shell
- Mobile drawer navigation and collapsible sidebar groups
- Configurable branding and public messaging
- Module and Partner Portal feature flags
- Searchable and filterable listing views with record details
- Three-step Quick Generate workflow with validation, draft recovery, company import, and generated previews
- Google Sheets and Airtable funding data-source integrations
- Admin data-source search, create, edit, delete, enable, and manual sync controls
- Dynamic Grants & Loans directory with source attribution and Quick Generate import
- PostgreSQL-backed persistence with local offline fallback and first-run migration
- Database migrations, demo seed data, audit logs, and Docker Compose setup
- Route-specific titles, metadata, and a dedicated 404 page
- Vitest checks and a GitHub Actions verification workflow
- Dual-license foundation for open-source and commercial distribution

## Tech stack

- React 19
- TypeScript
- Vite
- React Router
- Oxlint
- Express
- PostgreSQL 17
- Zod

## Local development

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Copy `.env.example` to `.env` before changing database credentials or ports.
`npm run dev` starts both the API on port `8787` and Vite on port `5173`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run check
npm run preview
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:down
```

## Project structure

```text
src/
  config/       Platform configuration and persistence
  data/         Navigation and demo records
  lib/          Domain and generation helpers
  pages/        Landing, dashboard, and admin surfaces
  persistence/  PostgreSQL synchronization and offline fallback
server/
  db/           PostgreSQL pool, migrations, and seed data
  app.ts        API routes and validation
  stateRepository.ts
```

## Admin configuration

The Admin Console persists platform configuration and data-source settings through
the API. Browser storage remains a local cache and offline fallback. The server
validates a strict state-key allowlist so session tokens and credentials cannot be
stored in the state database.

Before production deployment:

1. Add authentication and role-based authorization.
2. Replace the seeded development identity with the authenticated user context.
3. Add row-level workspace authorization before accepting user-supplied IDs.
4. Keep secrets and API keys in a secret manager, not browser or state storage.
5. Configure TLS and a managed PostgreSQL backup policy.

## PostgreSQL persistence

The API stores the current product state in PostgreSQL using three scopes:

- `platform` for branding, modules, AI/payment configuration, and data sources
- `workspace` for companies, applications, saved programs, and generated documents
- `user` for personal settings, pinned resources, and active workspace selection

On first connection, existing supported browser state is uploaded automatically.
On later visits, PostgreSQL is loaded before the React application mounts. Mutations
are debounced and written in batches, and every database mutation creates an audit
record.

See [docs/DATABASE.md](./docs/DATABASE.md) for the schema, API contract, deployment
guidance, and migration path toward fully normalized domain tables.

## Workspace data sources

Open `/admin#data-sources` to manage the sources that populate Grants & Loans,
Templates, Social Resources, and Tools. Administrators can search and filter by
module, change a source's destination, enable or disable it, and run a manual sync.
Synchronized records are cached locally in the demo and become available in their
selected workspace module.

Supported columns are:

```text
Program Name, Type, Provider, Amount, Deadline, Match, URL, Location
```

Common alternatives such as `Name`, `Agency`, `Maximum Amount`, `Closing Date`,
and `Region` are mapped automatically.

Templates, Social Resources, and Tools use:

```text
Title, Description, Category, Status, URL, Updated
```

Alternatives such as `Name`, `Summary`, `Format`, `Channel`, `Link`, and
`Last Updated` are also recognized.

### Google Sheets

Paste a public or link-readable Google Sheets URL and optionally provide the sheet
tab name. The frontend converts the sharing URL to CSV and imports the rows. The
included funding, template, and tools CSV files can be used to test the sync flow
without an external account.

### Airtable

Airtable synchronization uses a server-side proxy so the personal access token is
never stored in the browser. Configure the base ID, table, view, proxy URL, and
environment-variable name in Admin.

The integration proxy receives:

```json
{
  "provider": "airtable",
  "baseId": "appXXXXXXXXXXXXXX",
  "tableName": "Funding Programs",
  "view": "Published",
  "credentialReference": "AIRTABLE_ACCESS_TOKEN"
}
```

It should return either an array of field objects or the Airtable-style shape:

```json
{
  "records": [
    {
      "fields": {
        "Program Name": "Community Growth Loan",
        "Type": "Loan",
        "Amount": 50000
      }
    }
  ]
}
```

Protect the proxy with administrator authorization, validate the requested base and
table against an allowlist, and read the Airtable token from server-side environment
variables.

## Licensing

The community edition is available under `AGPL-3.0-or-later`. A separate commercial license can be offered to customers that need proprietary use, private modifications, OEM distribution, or different support terms.

See [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md) for the commercial licensing outline. Have final commercial terms reviewed by qualified legal counsel before selling licenses.

## Publishing to GitHub

```bash
git init
git add .
git commit -m "Initial open source release"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

Do not commit production credentials, customer data, generated documents, or third-party assets that you do not have the right to redistribute.
