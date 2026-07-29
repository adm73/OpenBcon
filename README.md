# OpenBcon

**The Open Source AI Platform for Funding & Business Consultants**

OpenBcon helps consultants, advisors, incubators, and funding teams run the full workflow in one place:

- discover funding programs
- assess business readiness
- manage company and client records
- generate funding-ready business plans
- organize applications, templates, resources, and reports

> Community edition: `AGPL-3.0-or-later`
>
> Commercial licensing available for private deployments, closed-source modifications, white-label/OEM distribution, implementation services, and ongoing support.
>
> See [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md) and [CLA.md](./CLA.md).

## Why OpenBcon

Funding consultants and business advisors still spend too much time on repetitive work:

- searching and comparing grant or loan programs
- collecting company information from clients
- rewriting business plans and funding narratives
- tracking applications, deadlines, and next actions
- building reports and export packages manually

OpenBcon turns that fragmented process into one AI-assisted workspace.

## Who It's For

OpenBcon is designed for teams that help businesses secure funding:

- funding consultants and grant writers
- business advisors and coaches
- incubators and accelerators
- economic development organizations
- partner networks, internal advisory teams, and multi-client workspaces

## Core Capabilities

- **AI business plan generation**: turn company and funding-program context into a structured funding-ready package
- **Funding readiness workflows**: assess strengths, risks, and missing inputs before submission
- **Client and company management**: organize founder profiles, business details, and working records
- **Funding program database**: manage grants, loans, and opportunity sources in one directory
- **Partner and admin workspace**: configure modules, data sources, models, payment settings, and workspace behavior
- **Resource and template libraries**: centralize templates, social resources, tools, and reusable content
- **Google Sheets and Airtable integrations**: connect external resource sources with admin-managed sync
- **Open-source customization**: self-host, extend, rebrand, or commercialize under the project's dual-license model

## Product Surfaces

The repository currently includes three product surfaces:

- `/` - public landing page
- `/dashboard` - user workspace
- `/admin` - platform configuration console

Every workspace module uses a flat route such as `/funding-readiness`, `/quick-generate`, and `/grants-loans`.

Built-in auth entry flows are also included for `/login`, `/signup`, `/forgot-password`, and `/reset-password`.

## Demo Preview

Live demo and short product walkthroughs are planned. Until then, the repository includes a visual snapshot of the current product experience.

<table>
  <tr>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-01.png" alt="OpenBcon landing page" width="100%" /><br />
      <sub>Landing Page</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-02.png" alt="OpenBcon dashboard workspace" width="100%" /><br />
      <sub>Landing Page 2</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-03.png" alt="OpenBcon quick generate workflow" width="100%" /><br />
      <sub>Dashboard Overview</sub>
    </td>
  </tr>
</table>

## Screenshot Gallery

The current repository snapshot includes the landing experience, dashboard workspace, directories, and Quick Generate flow.

<table>
  <tr>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-04.png" alt="Funding Readiness page" width="100%" /><br />
      <sub>Funding Readiness</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-05.png" alt="My Company page" width="100%" /><br />
      <sub>Quick Generate</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-06.png" alt="Saved Programs page" width="100%" /><br />
      <sub>Quick Generate 2</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-07.png" alt="My Applications page" width="100%" /><br />
      <sub>My Company</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-08.png" alt="Grants and Loans page" width="100%" /><br />
      <sub>Saved Programs</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-09.png" alt="Templates page" width="100%" /><br />
      <sub>My Applications</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-10.png" alt="Social Resources page" width="100%" /><br />
      <sub>Grants &amp; Loans</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-11.png" alt="Tools page" width="100%" /><br />
      <sub>Templates</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-12.png" alt="Admin Console page" width="100%" /><br />
      <sub>Social Resources</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-13.png" alt="Quick Generate step 1" width="100%" /><br />
      <sub>Tools</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-14.png" alt="Quick Generate step 2" width="100%" /><br />
      <sub>Settings</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-15.png" alt="Quick Generate step 3 review" width="100%" /><br />
      <sub>Admin Console</sub>
    </td>
  </tr>
</table>

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

1. Replace the demo auth flow and seeded development identity with production authentication and user provisioning.
2. Add role-based authorization for founder, advisor, admin, and partner workflows.
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

OpenBcon uses a dual-license structure:

- Community edition: `AGPL-3.0-or-later`
- Commercial edition: available by separate paid agreement

The commercial edition is intended for customers that need:

- proprietary or closed-source deployment rights
- private modifications without AGPL disclosure obligations
- white-label, OEM, or embedded distribution rights
- paid implementation, customization, or ongoing support

In the community edition, OpenBcon attribution in the landing page and dashboard footer is required. Commercial license holders can negotiate white-label controls, including whether that attribution is visible.

See [COMMERCIAL-LICENSE.md](./COMMERCIAL-LICENSE.md) for the commercial
licensing model and [CLA.md](./CLA.md) for the contributor agreement required
for external contributions.

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
