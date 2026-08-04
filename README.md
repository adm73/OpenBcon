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
- **Configurable Advisory Hub**: run section-by-section generation with admin-managed sections, document types, agents, roles, prompts, and ordering
- **Funding readiness workflows**: assess strengths, risks, and missing inputs before submission
- **Client and company management**: organize founder profiles, business details, and working records
- **Funding program database**: manage grants, loans, and opportunity sources in one directory
- **Partner and admin workspace**: configure modules, branding, landing-page content, legal links, data sources, models, payment settings, and workspace behavior
- **Resource and template libraries**: centralize templates, social resources, tools, and reusable content
- **Google Sheets and Airtable integrations**: connect external resource sources with admin-managed sync
- **Open-source customization**: self-host, extend, rebrand, or commercialize under the project's dual-license model
- **Multilingual workspace UI**: English (Canada), French (Canada), and Simplified Chinese locale support

## Product Surfaces

The repository currently includes three product surfaces:

- `/` - public landing page
- `/dashboard` - user workspace
- `/admin` - platform configuration console, including Advisory Hub setup

Every workspace module uses a flat route such as `/funding-readiness`, `/quick-build`, `/advisory-hub`, `/my-applications`, and `/grants-loans`.

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
      <img src="./public/images/openbcon-screenshot-03.png" alt="OpenBcon Quick Build workflow" width="100%" /><br />
      <sub>Dashboard Overview</sub>
    </td>
  </tr>
</table>

## Screenshot Gallery

The current repository snapshot includes the landing experience, dashboard workspace, directories, and Quick Build flow.

<table>
  <tr>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-04.png" alt="Funding Readiness page" width="100%" /><br />
      <sub>Funding Readiness</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-05.png" alt="My Company page" width="100%" /><br />
      <sub>Quick Build</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-06.png" alt="Saved Programs page" width="100%" /><br />
      <sub>Quick Build - Result Preview</sub>
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
      <img src="./public/images/openbcon-screenshot-13.png" alt="Quick Build step 1" width="100%" /><br />
      <sub>Tools</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-14.png" alt="Quick Build step 2" width="100%" /><br />
      <sub>Settings</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-15.png" alt="Quick Build step 3 review" width="100%" /><br />
      <sub>Admin Console</sub>
    </td>
  </tr>
</table>

## Current features

- Responsive landing page and dashboard shell
- Mobile drawer navigation and collapsible sidebar groups
- Configurable branding, logo, and public messaging
- Admin-managed landing page header, content, footer navigation, and legal-link configuration
- Admin-managed pricing catalog with free, monthly, annual, and one-time offers
- Billing settings surface with current subscription, pricing options, and transaction history
- Module and Partner Portal feature flags
- Searchable and filterable listing views with record details
- Three-step Quick Build workflow with validation, company import, application restore, and generated previews
- Dedicated Advisory Hub route (`/advisory-hub`) for reopening the latest generated package outside the form flow
- Advisory Hub generation driven by configurable sections, document types, agents, roles, prompts, and workflow ordering
- Saved Programs materialized as applications with funding-program step data prefilled
- My Applications and Quick Build use the unique external `app_id` in links and API requests
- Google Sheets and Airtable funding data-source integrations
- Admin data-source search, create, edit, delete, enable, and manual sync controls
- Dynamic Grants & Loans directory with source attribution and Quick Build import
- PostgreSQL domain data plus MongoDB-backed dynamic configuration and workspace state
- One Strategic Report per application, persisted in `strategic_reports` with LangGraph trace and final result data
- Three-year, 36-month financial forecasts with monthly revenue and expense rows, annual summaries, and Advisory Hub visualizations
- Database migrations, demo seed data, audit logs, and Docker Compose setup
- Admin Console update checks compare the stamped build commit with the latest GitHub `main` commit
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
- MongoDB 8
- i18next and react-i18next
- Zod

## Local development

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Copy `.env.example` to `.env` before changing database credentials or ports.
Start both database services before migrating state:

```bash
docker compose up -d postgres mongodb
npm run db:migrate-state-to-mongo
npm run db:migrate
npm run db:seed
```

`npm run db:setup` runs the same migration and seed steps after the database
services are available. `npm run dev` starts the API on port `8787` and Vite on
port `5173`.
For the Python AI backend used by the model connection chat, create the
Python environment described in `python-backend/README.md`, then run
`npm run dev:python` in a second terminal. It listens on port `8010`.

If the browser shows a blank page immediately after renaming or moving a source
module, stop and restart `npm run dev` so Vite rebuilds its module graph. Then
reload the page. A successful `npm run build` confirms that the source imports
resolve correctly.

The workspace UI supports English (Canada), French (Canada), and Simplified
Chinese. Change the language from Settings; the preference is persisted for the
current browser profile and is used for workspace labels, dates, numbers,
currency formatting, and generated forecast language.

## One-click production deployment

The repository includes a Docker deployment with these services:

- `api`: the built React application and Express API on the private Docker network
- `python`: the FastAPI/LangGraph generation service on the private Docker network
- `postgres` and `mongodb`: persistent application data services
- `caddy`: same-origin routing for `/api` and `/ai-api`

The default Compose file lets Caddy own public ports 80 and 443. If a VPS
already uses Hostinger Traefik on those ports, Caddy can instead listen on
`127.0.0.1:8080` while Traefik owns public HTTPS. The complete setup and
troubleshooting steps are documented here:

- [Hostinger VPS deployment](./docs/deployment/hostinger-vps.md)
- [Deployment troubleshooting FAQ](./docs/troubleshooting/deployment-faq.md)

The AGPL community build keeps the Commercial licensing section visible and
read-only in Admin Console. A paid commercial deployment can hide that section
by setting the build-time variable `VITE_COMMERCIAL_LICENSED=true` and
rebuilding the API image. This flag controls the compiled UI only; licensing
rights remain governed by the applicable commercial agreement.

For a VPS where Caddy can use ports 80 and 443 directly:

```bash
cp deploy/.env.production.example deploy/.env.production
openssl rand -hex 32
# Edit deploy/.env.production with the database passwords, generated encryption
# key, public DOMAIN, and server-side OPENBCON_OPENAI_API_KEY.
./deploy/deploy.sh
```

The first deployment runs PostgreSQL migrations and does not seed demo data.
After the first setup, register the first account, then promote it to a
platform administrator before changing platform settings:

```bash
docker compose --env-file deploy/.env.production -f deploy/docker-compose.production.yml \
  exec postgres psql -U bconomics -d bconomics \
  -c "UPDATE app_users SET role = 'admin' WHERE lower(email) = lower('admin@example.com');"
```

For updates:

```bash
git pull --ff-only
./deploy/deploy.sh
```

`deploy/deploy.sh` stamps the frontend image with the current Git commit. In
Admin Console, open **Updates** and select **Check updates** to compare that
build with the latest public OpenBcon commit. The check reports availability
only; it never installs code automatically.

### Update checks

The Admin Console update check is intentionally read-only:

- the authenticated Node API queries the fixed OpenBcon GitHub `main` commit
- the frontend compares that commit with the build's `VITE_APP_COMMIT` value
- `deploy/deploy.sh` sets `VITE_APP_COMMIT` automatically from `git rev-parse`
- local builds without a commit stamp show the latest commit but cannot report
  whether the current build is behind
- GitHub failures and timeouts are shown as a check error; they do not affect
  the running application

The endpoint is `GET /api/updates?currentCommit=<commit>` and requires an
authenticated session. It does not accept a user-provided upstream URL and it
does not pull, install, or restart application code.

Always supply `--env-file deploy/.env.production` when running Compose commands
directly, including `logs` and `ps`. Never run `docker compose down --volumes`
unless production data is intentionally being deleted.

### Stripe setup

The billing flow now supports Stripe Checkout and the Stripe customer portal.

1. Copy `.env.example` to `.env`.
2. Add your Stripe server credentials:
   - `STRIPE_TEST_SECRET_KEY`
   - `STRIPE_LIVE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `APP_STATE_ENCRYPTION_KEY`
3. Start the app with `npm run dev`.
4. Open `/admin#payments` and confirm these Stripe references:
   - `testSecretKeyReference` -> `STRIPE_TEST_SECRET_KEY`
   - `liveSecretKeyReference` -> `STRIPE_LIVE_SECRET_KEY`
   - `webhookSecretReference` -> `STRIPE_WEBHOOK_SECRET`
5. Save the Admin Console configuration in the browser. Platform configuration is
   stored in MongoDB. Raw payment secrets are encrypted by the Node API before
   persistence; browsers receive placeholders instead of plaintext secrets. Keep
   `APP_STATE_ENCRYPTION_KEY` stable so existing secrets remain decryptable after
   restarts.
6. In the Stripe Dashboard, register your webhook endpoint, for example:
   - `http://localhost:8787/api/webhooks/stripe`

If the checkout success, cancel, or billing-portal return URLs are left blank in
the Admin Console, the server automatically falls back to the current app origin
and routes users back to `/settings#billing`.

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

## Strategic Reports

Quick Build accepts the public application identifier and launches one Strategic
Report for that application:

```text
/quick-build?app_id=3a819e8f5ce9f1d8
```

The public generation API uses the same identifier:

```http
POST http://localhost:8010/api/business-plan/generate
Content-Type: application/json

{"app_id":"3a819e8f5ce9f1d8","language":"en-CA"}
```

The forecast-only endpoint is:

```http
POST http://localhost:8010/api/business-plan/forecast
Content-Type: application/json

{"app_id":"3a819e8f5ce9f1d8","language":"en-CA"}
```

The backend loads the application, company, and funding-program records from
PostgreSQL, then reads the current enabled Advisory Hub sections and assigned
agents from MongoDB. Sections are generated in the configured order using each
agent's current name, role, and prompt; there are no Python-side default section
values. The LangGraph run trace and final result are stored in the application's
single `strategic_reports` row.

The supported output languages are `en-CA`, `fr-CA`, and `zh-CN`. The selected
language is passed to LangGraph prompts and stored with the Strategic Report.
Users can change the workspace language from Settings. The choice is persisted
locally and also controls locale-aware number, date, currency, and forecast formatting.

The report page resolves that row from the application relationship, so the
navigation URL can be `/advisory-hub?applicationId=<applications.id>`; the
stored Strategic Report ID is displayed by the page and does not need to be
passed as a second query parameter.

Financial forecasting is part of the Strategic Report. By default it produces
three years of monthly periods (36 columns), with revenue rows first, expense
rows second, and calculated total revenue, total expenses, and net cash flow.
Advisory Hub renders the forecast with trend charts, net-cash-flow bars, annual
summaries, and the detailed monthly table.

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

The Admin Console reads and writes platform settings through the authenticated
API and MongoDB-backed dynamic state. Sensitive payment and AI model fields are
redacted in bootstrap responses and encrypted by the server before persistence.
The browser may keep an encrypted local copy for editing continuity, but it is
not the security boundary. The server validates a strict state-key allowlist and
requires the database `admin` role for platform writes.

Workspace settings such as the profile, billing selections, default company,
and Quick Build preferences are persisted for the active workspace. Payment
gateway secrets are never written back to the remote state store in plaintext.

Advisory Hub settings are also managed from the Admin Console and persisted with
the platform configuration. Administrators can:

- enable, rename, and reorder the sections shown during package generation
- define the document types available to those sections
- add, remove, and edit Advisory Hub agents, including their names, roles, and prompts
- assign a document type and agent to each section

At least one section, one document type, and one agent remain available so the
generation workflow always has a valid configuration.

The landing page can be managed directly from `/admin#landing-page`, including:

- header navigation items and signed-in or signed-out CTA labels
- grouped content sections for hero, CTA copy, features, workflow, and open-source messaging
- dynamic proof points shown on the public homepage
- footer sitemap links, platform links, and legal link destinations

## Application flow

Saved opportunities now bridge directly into the application workflow:

- saving a program can materialize a corresponding application record
- each application stores the Quick Build step-one funding context
- `/quick-build?app_id=...` restores an existing application instead of starting a new one
- the Step 2 business profile can automatically import the configured default company
- generated packages can be reopened later from the dedicated `/advisory-hub` route
- each application maps to one Strategic Report through `strategic_reports.application_id`

Payment settings under `/admin#payments` now focus on gateway configuration:

- Stripe and Waffo Pancake can each store separate test and live secret references
- environment-variable names remain visible as references
- raw payment keys are redacted in localStorage and stored in encrypted browser storage
- checkout success and cancel URLs can be overridden per deployment
- customer self-serve subscription changes use the Stripe billing portal
- webhook signature verification uses server environment variables rather than synced admin state

Stripe checkout remains the only live billing flow wired to the server today.
Waffo Pancake is available in the Admin Console as a configurable gateway option
for secret and mode management.

Before production deployment:

1. Set `NODE_ENV=production`, `SEED_DEMO_DATA=false`, and `CORS_ORIGIN` to the exact public origin.
2. Run migrations `025_auth_sessions.sql` and `026_billing_resource_bindings.sql` through `npm run db:migrate` or with `AUTO_MIGRATE=true` during the release.
3. Put the Node API behind the same origin as the frontend at `/api`, and proxy `/ai-api` to the private Python service at `http://127.0.0.1:8010`.
4. Keep production secrets in a secret manager and use Admin only for references or encrypted-at-rest secure storage.
5. Configure TLS and a managed PostgreSQL backup policy.

## Persistence

PostgreSQL stores relational domain data, especially users, companies, funding
programs, applications, and strategic reports. Internal application relations
use the numeric `applications.id`, while external generation calls use the
unique 16-character `applications.app_id`.

MongoDB stores editable dynamic JSON configuration and lightweight workspace state
in the `dynamic_state` collection using three scopes:

- `platform` for branding, landing-page content, modules, AI/payment configuration, and data sources
- `workspace` for saved-program preferences and Quick Build drafts
- `user` for personal settings, pinned resources, and active workspace selection

Sensitive payment keys and AI model API keys inside
`bconomics-platform-config-v1` are not returned to the browser in plaintext. The
API redacts them in bootstrap payloads, encrypts raw values before saving them to
MongoDB, and decrypts payment references only for server-side payment
operations. Stripe checkout sessions and customer IDs are also bound to the
authenticated workspace and user in `billing_resource_bindings`.

On first migration, existing `app_state` JSON documents are copied to MongoDB.
The PostgreSQL `app_state` table is no longer used. On later visits, MongoDB and
the relational `applications` table are loaded before the React application mounts.
Mutations are debounced and written in batches, and every mutation creates an audit
record in PostgreSQL.

See [docs/DATABASE.md](./docs/DATABASE.md) for the schema, API contract, deployment
guidance, and migration path toward fully normalized domain tables.

## Security and Deployment Notes

Browser authentication uses a server-side `auth_sessions` table and an
HttpOnly `bconomics_session` cookie. In production, missing or expired sessions
are rejected by the Node API and Python generation API. The generation, forecast,
and AI connection-test endpoints resolve the session workspace and filter the
requested application by that workspace, so a user-supplied `app_id` cannot
cross workspace boundaries.

Platform state writes are server-authorized: only a database user with the
`admin` role can update or delete platform configuration. Login failures are
rate-limited per IP and email, and payment resources are checked against the
current workspace/user before Stripe portal access or session lookup.

Local Node persistence routes may still use the configured demo context when no
cookie is present. That fallback is disabled whenever `NODE_ENV=production`;
production must use the login or registration API to establish a session. The
Python generation and AI-test routes require a valid session in every
environment. The browser-only demo password reset flow is disabled in
production; connect `/forgot-password` to a real email/reset-token service
before advertising password recovery. Do not expose the Node API, Python AI API,
PostgreSQL, MongoDB, payment routes, or model endpoints publicly without TLS,
secret management, and
database network controls.

The frontend calls the Python service through the same-origin `/ai-api` path.
Vite proxies that path to port `8010` during development; a production reverse
proxy must provide the equivalent route and must not expose port `8010` directly.

Keep `.env` and provider keys out of Git. Use a secret manager in production and
never place raw AI or payment credentials in frontend configuration. Review and
back up the database before applying destructive historical migrations, including
the migration that removes the legacy funding-package tables.

The production dependency audit currently reports only React Router's RSC-mode
CSRF advisory. This application uses `BrowserRouter` only and does not enable
React Server Components, server actions, or SSR action endpoints. Keep React
Router pinned to the current tested version and re-audit before enabling any RSC
features; do not apply `npm audit fix --force`, which selects an older release
with additional advisories.

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
