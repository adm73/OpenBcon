# OpenBcon

<p align="center">
  <img src="./public/brand/openbcon-ob.png" alt="OpenBcon monochrome oB logo" width="180" />
</p>

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

## Version 2.5.1

Version 2.5.1 makes release status easier to understand:

- Admin Console Updates displays the current and latest release tags, such as
  `2.5.1`, instead of exposing an internal commit hash as the primary build
  label.
- Tagged deployments receive their release version automatically during the
  Docker build; untagged development builds are labeled `Unreleased`.
- Commit hashes remain available to the update service for safe comparison and
  fast-forward installation.

## Version 2.5

Version 2.5 improves production operations and large catalog synchronization:

- Admin Console can check for and install fast-forward updates through a private,
  administrator-only update agent.
- JSON funding catalogs sync in bounded batches, so large U.S. Grants and similar
  sources do not exceed the API request limit; old records are archived only after
  the final batch completes successfully.
- Deployment health checks now report actionable service and HTTPS failures, while
  the bootstrap wizard shows generated database credentials and next steps.

After updating a deployment, rebuild the API service so the new synchronization
logic is active:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build api
```

## Version 2.0.0

OpenBcon 2.0.0 adds a guided deployment experience for arbitrary customer
domains. It includes the Admin Console Deployment Setup wizard and the secure
Bootstrap Setup flow that runs before the application is configured. Operators
can choose the public domain, HTTPS/proxy plan, and initial Test or Live Mode;
the VPS generates database credentials and the application encryption key, then
continues into the normal Docker deployment.

The release also includes account registration, login, password reset,
multilingual workspace support, real funding-program discovery, company
records, Quick Build, and configurable Strategic Report generation with
business, technology, and financial sections.

The release has been verified locally with an end-to-end Test Mode walkthrough:
register a user, sign in, reset the password, select a real funding program,
create a company, launch Quick Build, and open the generated Strategic Report.
Test Mode uses the deterministic mock gateway and test data stores; it does not
send requests to an external LLM or payment provider. Configure Live Mode and
server-side provider credentials before using real generation or payments.

Release validation commands:

```bash
npm run check
npm audit --omit=dev --audit-level=moderate
git diff --check
```

Latest local smoke validation also starts the Node API and checks the workspace
routes with real catalog data. The API health check returned `200`, Grants &
Loans loaded 2,545 active programs (2,326 grants and 219 loans), Programs
loaded the same catalog, the Dashboard showed a dynamic date and greeting, and
the Guide and Templates Preview dialogs opened and closed successfully.

The shared catalog migration safely consolidates older workspace-scoped
duplicates before enforcing the global `(source_id, source_record_id)` unique
index. Existing application and package references are retargeted to the
canonical program record during the migration.

The final local check passed with 14 test files and 76 tests, followed by a
successful TypeScript and Vite production build. Lint reports only the existing
React Fast Refresh and hook-dependency warnings.

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
- **Configurable Strategic Report**: run section-by-section generation with admin-managed sections, document types, agents, roles, prompts, and ordering
- **Reusable report layouts**: configure cover-page and main-content CSS declarations in Admin Console with a live preview, then assign those layouts to Strategic Report sections
- **Funding readiness workflows**: assess strengths, risks, and missing inputs before submission
- **Discovery scouting reports**: compare each funding program against a selected company with fit scoring, positive signals, reviewer concerns, and a recommended next move
- **Client and company management**: organize founder profiles, business details, and working records
- **Funding program database**: manage grants, loans, and opportunity sources in one directory
- **Partner and admin workspace**: configure modules, branding, landing-page content, legal links, data sources, models, payment settings, and workspace behavior
- **Resource and template libraries**: centralize templates, social resources, tools, and reusable content
- **Google Sheets and Airtable integrations**: connect external resource sources with admin-managed sync
- **Open-source customization**: self-host, extend, rebrand, or commercialize under the project's dual-license model
- **Multilingual workspace UI**: English (Canada), French (Canada), and Simplified Chinese locale support

### Grants and Loans Catalog Languages

The original English catalogs remain unchanged in `public/funding_programs_complete.json` and
`public/loan_programs_complete.json`. Simplified Chinese catalogs are provided separately as
`public/funding_programs_complete.zh-CN.json` and `public/loan_programs_complete.zh-CN.json`.

Enable and sync the two Chinese JSON data sources in Admin Console > Data Sources. The records
are stored in `funding_programs` with `language = 'zh-CN'`, and the Grants & Loans and Funding
Shortlist pages request only the catalog matching the active workspace language. Test and Live
mode continue to use their respective databases.

## Product Surfaces

The repository currently includes three product surfaces:

- `/` - public landing page
- `/dashboard` - user workspace
- `/admin` - platform configuration console, including Strategic Report setup

Every workspace module uses a flat route such as `/discovery`, `/quick-build`, `/strategic-reports`, `/my-applications`, and `/grants-loans`.

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
      <img src="./public/images/openbcon-screenshot-04.png" alt="Discovery page" width="100%" /><br />
      <sub>Discovery</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-05.png" alt="My Companies page" width="100%" /><br />
      <sub>Quick Build</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-06.png" alt="Funding Shortlist page" width="100%" /><br />
      <sub>Quick Build - Result Preview</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-07.png" alt="My Applications page" width="100%" /><br />
      <sub>My Companies</sub>
    </td>
    <td align="center">
      <img src="./public/images/openbcon-screenshot-08.png" alt="Grants and Loans page" width="100%" /><br />
      <sub>Funding Shortlist</sub>
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
- Consistent Dashboard-style topbars across workspace pages, with clear page names and supporting descriptions
- Configurable branding, logo, and public messaging
- Admin-managed landing page header, content, footer navigation, and legal-link configuration
- Admin-managed pricing catalog with free, monthly, annual, and one-time offers
- Billing settings surface with current subscription, pricing options, and transaction history
- Module and Partner Portal feature flags
- Searchable and filterable listing views with record details
- Three-step Quick Build workflow with validation, company import, application restore, and generated previews
- Discovery presents one program-matching scouting report card at a time, with company switching, program profiles, match indicators, and non-circular Previous/Next navigation
- Discovery displays the match score as a dynamic progress ring with the score rendered inside the circle
- Discovery cards expose the company profile used for matching, including legal structure, sector, industry, stage, products or services, funding usage, seasonal periods, mission, vision, values, and team information
- Dedicated Strategic Reports route (`/strategic-reports`) for reopening the latest generated package outside the form flow
- Funding Shortlist route (`/funding-shortlist`) for reviewing shortlisted grants, loans, and other funding opportunities
- Strategic Report generation driven by configurable sections, document types, agents, roles, prompts, and workflow ordering
- Admin-managed Strategic Report layouts with editable names, descriptions, CSS declarations, and live previews
- Funding Shortlist opportunities materialized as applications with funding-program step data prefilled
- My Applications and Quick Build use the unique external `app_id` in links and API requests
- Google Sheets and Airtable funding data-source integrations
- Admin data-source search, create, edit, delete, enable, and manual sync controls
- Dynamic Grants & Loans directory with source attribution and Quick Build import
- PostgreSQL domain data plus MongoDB-backed dynamic configuration and workspace state
- One Strategic Report per application, persisted in `strategic_reports` with LangGraph trace and final result data
- Three-year, 36-month financial forecasts with monthly revenue and expense rows, annual summaries, and Strategic Report visualizations
- Financial forecast line-item tables open on Year 1 and switch between Year 1, Year 2, and Year 3 twelve-month views from the annual summary cards
- Database migrations, demo seed data, audit logs, and Docker Compose setup
- Admin Console update checks compare the stamped build commit with the latest GitHub `main` commit
- Route-specific titles, metadata, and a dedicated 404 page
- Vitest checks and a GitHub Actions verification workflow
- Dual-license foundation for open-source and commercial distribution

## Roadmap

This is a directional roadmap rather than a release commitment. Priorities may
change as contributors, advisors, and self-hosting teams provide feedback.

### Near term

- [ ] Add release metadata and changelog links to the Admin Console update check
- [ ] Improve production operations with backup verification, migration checks,
  and expanded health monitoring
- [ ] Add Strategic Report version history, retry controls, and clearer generation
  diagnostics
- [ ] Improve collaborative workspace permissions, invitations, and activity history
- [ ] Expand automated tests for generation, persistence, authentication, and
  responsive layouts

### Later

- [ ] Add more funding-catalog connectors and scheduled sync observability
- [ ] Extend financial planning with editable assumptions, scenario comparisons,
  and export-ready forecast formats
- [x] Add structured Strategic Report cover-page rendering with report metadata,
  centered layout, and brand accent
- [ ] Add richer document editing, review comments, and package export workflows
- [x] Render matching cover pages and page breaks in the web preview, DOCX, and
  PDF exports
- [ ] Add administrator controls for cover logos, backgrounds, themes, and
  alignment options
- [ ] Expand localization beyond English (Canada), French (Canada), and Simplified
  Chinese
- [ ] Publish stable integration APIs and webhooks for partner workflows

### Consulting Templates

- [ ] Create a database-backed Consulting Templates catalog with template keys,
  descriptions, categories, enablement, required company fields, and report type
- [ ] Connect each template to the existing Admin Console configuration for
  document types, sections, prompts, agents, priorities, and layouts
- [ ] Add template versioning so new reports always use the latest configuration,
  while generated reports retain the configuration snapshot used for audit and
  reproducibility
- [ ] Generalize `strategic_reports` for consulting reports with `report_type`,
  `template_id`, `template_version`, and `company_id`; allow `application_id` to
  be optional when a report is not funding-specific
- [ ] Add a Consulting Templates page where users choose a template, select a
  company, review missing information, and start a report
- [ ] Add a generic consulting-report API and LangGraph workflow for loading the
  latest template, validating company data, analyzing the company, generating
  sections by priority, running review, compiling the report, and saving token
  usage
- [ ] Add Admin Console controls to create, edit, delete, enable, disable, and
  preview consulting templates without hardcoding report structures in the UI
- [ ] Reuse Strategic Report editing, regeneration, layout preview, PDF/DOCX/XLSX
  export, report history, and report navigation for consulting reports
- [ ] Add the first consulting template set: Digital Transformation, AI
  Readiness, Market Entry, Manufacturing Assessment, Retail Growth, Restaurant
  Expansion, Healthcare Clinic Review, SaaS Go-to-Market, ESG Assessment, and
  Due Diligence
- [ ] Add template validation and clear errors for deleted or missing agents,
  sections, document types, prompts, and layouts; do not silently fall back to
  stale configuration

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

## Security and production safety

OpenBcon keeps provider keys and application encryption secrets on the server.
Admin configuration is redacted before it is returned to the browser, and
production session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
Production startup rejects placeholder encryption keys, wildcard or local CORS
origins, and demo-data seeding. The Python service also fails closed if its
production CORS configuration is missing or is not an explicit HTTPS origin.

Configured AI endpoints are restricted to the allowlisted provider hosts by
default, and private AI endpoints are disabled in production. PostgreSQL,
MongoDB, Ollama, and the internal API services are kept on the private Docker
network; only the reverse proxy is exposed publicly.

Before deploying, run the checks locally:

```bash
npm audit --omit=dev --audit-level=moderate
python-backend/.venv/bin/python -m pip install pip-audit  # one-time audit tool
python-backend/.venv/bin/pip-audit -r python-backend/requirements.txt
npm run check
```

The current audit baseline is zero reported vulnerabilities for both production
and development dependencies. Re-run the dependency audits after dependency
updates or before a release; do not use `npm audit fix --force` without reviewing
the resulting major-version changes.

## One-click production deployment

The repository includes a Docker deployment with these services:

- `api`: the built React application and Express API on the private Docker network
- `python`: the FastAPI/LangGraph generation service on the private Docker network
- `ollama`: optional private local LLM runtime, enabled only with `ENABLE_OLLAMA=true`
- `postgres` and `mongodb`: persistent application data services
- `caddy`: same-origin routing for `/api` and `/ai-api`
- `updater`: private, token-protected update agent used by Admin Console

The default Compose file lets Caddy own public ports 80 and 443. If a VPS
already uses Hostinger Traefik on those ports, Caddy can instead listen on
`127.0.0.1:8080` while Traefik owns public HTTPS. The complete setup and
troubleshooting steps are documented here:

- [Hostinger VPS deployment](./docs/deployment/hostinger-vps.md)
- [Deployment troubleshooting FAQ](./docs/troubleshooting/deployment-faq.md)

### Deployment Setup Wizard

Admin Console includes a `Deployment Setup` wizard for deployments that use a
custom domain. It validates the hostname, lets you choose whether Caddy or an
existing Traefik instance owns HTTPS ports 80/443, selects the initial Test or
Live Mode, and generates a server-side environment template plus deployment
commands. The wizard keeps only non-secret draft values in the current browser;
the database administrator username is fixed as `admin`; passwords are generated inside the VPS and shown once
on the result page. API keys, SMTP credentials, and OAuth secrets must still be
entered in `deploy/.env.production` on the VPS. The wizard prepares the
configuration but does not remotely execute Docker commands.

For a fresh VPS, the same setup is also available before the application is
running. Execute:

```bash
./deploy/deploy.sh
```

When `deploy/.env.production` is missing, the script starts a one-time
Bootstrap Setup page on the VPS temporary port `8090` and waits for the form to
be saved. Open the one-time public URL printed by the script, enter the domain,
admin email, admin password, proxy plan, and initial mode, then save. The admin
email becomes the first OpenBcon administrator account, and the setup page
requires a 12-character minimum password. The setup URL is
protected by a one-time token and expires after 24 hours. If the VPS firewall
blocks it, temporarily allow inbound TCP `8090` while configuring, then close
that port after setup completes. The script sets the database administrator
usernames to `admin`, generates the passwords and encryption key on the VPS,
and displays the database credentials
once so they can be stored securely, writes `deploy/.env.production`, creates
the initial administrator account in both isolated Test and Live databases, and
continues with the normal database migration and Docker startup. To reconfigure an existing
deployment, run `./deploy/deploy.sh --setup`; the previous environment file is
backed up before it is replaced. The domain must have an A record pointing to
the VPS first. If an external Traefik owns ports 80/443, it must route the
selected domain to `127.0.0.1:8080`; the bootstrap step creates the OpenBcon
Caddy override but cannot modify a separately managed Traefik installation.
After saving, the setup page shows configuration-write status, DNS resolution,
service startup, HTTPS, and `/api/health` checks. It also shows the final public
URL or the next troubleshooting step. The temporary setup service is stopped
automatically after deployment succeeds or fails. The deployment wizard creates
one shared database prefix using the format `dbob` plus 10 random digits, for
example `dbob4829137056`. PostgreSQL and MongoDB use that prefix for the
shared catalog, then add `_test` and `_live` for the isolated runtime
databases. The prefix is stored in `DBOB_DATABASE_PREFIX` and reused on later
restarts of the same deployment.

#### Rotate database credentials

The Bootstrap Setup page displays the generated PostgreSQL and MongoDB
credentials once. Store them in a secure password manager, then rotate them as
soon as the deployment has been verified. A password rotation must update both
the database account and the matching application configuration; changing only
`.env.production` will break authentication.

Use alphanumeric passwords generated with `openssl rand -hex 32`, update the
database roles, and then update these PostgreSQL values with the same password:
`POSTGRES_PASSWORD`, `DATABASE_URL_SHARED`, `DATABASE_URL_TEST`,
`DATABASE_URL_LIVE`, `OPENBCON_DB_DSN_SHARED`, `OPENBCON_DB_DSN_TEST`, and
`OPENBCON_DB_DSN_LIVE`. Update `MONGODB_ROOT_PASSWORD` after changing the
MongoDB root password. Back up `deploy/.env.production` first, validate the
Compose configuration, and recreate only `api`, `python`, and `caddy`; never
delete the PostgreSQL or MongoDB volumes. The full command sequence is in the
[Hostinger VPS deployment guide](./docs/deployment/hostinger-vps.md#rotate-database-credentials).

The AGPL community build keeps the Commercial licensing section visible and
read-only in Admin Console. A paid commercial deployment can hide that section
by setting the build-time variable `VITE_COMMERCIAL_LICENSED=true` and
rebuilding the API image. This flag controls the compiled UI only; licensing
rights remain governed by the applicable commercial agreement.

For a VPS where Caddy can use ports 80 and 443 directly:

```bash
cp deploy/.env.production.example deploy/.env.production
openssl rand -hex 32
# Edit deploy/.env.production with the public DOMAIN and any server-side
# API/SMTP/OAuth credentials. The setup wizard generates database credentials.
./deploy/deploy.sh
```

The first deployment runs PostgreSQL migrations and does not seed demo data.
Sign in with the admin email and password created by Bootstrap Setup. The
bootstrap administrator is created as an independent account in both Test and
Live Mode so the operator can switch modes without losing administrative
access; regular users remain isolated to the mode in which they were created.

### Optional Local Ollama model

Both Compose files include Ollama behind an optional `ollama` profile. The
default deployment does not start or download Ollama. Enable it only when a
local model is required:

```bash
docker compose --profile ollama up -d ollama ollama-model
```

For production, set `ENABLE_OLLAMA=true` in `deploy/.env.production` and run
the deployment command again. Leave it as `false` when using OpenAI,
OpenRouter, Anthropic, Google, or another external provider.

The default local model is `smollm2:135m`; model data survives container
restarts in the `bconomics-ollama-data` volume.

In Admin Console, add or import the Ollama preset at
`public/ai-model-presets/ollama.json`, then select `Ollama` and
`smollm2:135m` as the default enabled model. For the host-run development API,
use `http://127.0.0.1:11434/api/chat`; for the production Docker network, use
`http://ollama:11434/api/chat`. The Ollama endpoint is
kept private and does not require an API key.

### Test and Live Mode data isolation

Admin Console's **Mode Switch** is also a database boundary. Test Mode is a
fully independent demonstration environment, including its own `app_users`
table and authentication sessions:

- **Test Mode** uses `DATABASE_URL_TEST` and `MONGODB_DATABASE_TEST`; generation
  uses the deterministic mock gateway and writes test users, sessions,
  companies, applications, reports, usage, billing bindings, and audit data.
- **Live Mode** uses `DATABASE_URL_LIVE` and `MONGODB_DATABASE_LIVE`; generation
  uses the configured real model gateway and writes only to the live tenant
  stores.
- **Shared platform data** uses `DATABASE_URL_SHARED` and
  `MONGODB_DATABASE_SHARED`. This contains platform configuration, Admin
  Console settings, AI model configuration, Advisory Hub sections and agents,
  authentication/provider settings, data-source settings, and the shared
  funding-program catalog. It never stores user sessions or tenant business
  records.

The server-authoritative active mode is `OPENBCON_ENVIRONMENT_MODE` and
defaults to `test`. Changing it requires updating the deployment environment
and restarting the Node and Python services. Admin Console saves a requested
mode in the shared configuration and keeps the browser cache aligned with the
currently active server mode until that restart completes. Client localStorage,
query parameters, and request headers cannot switch the server across database
boundaries. The frontend does not send the platform mode in API requests;
every request is resolved from the server's `OPENBCON_ENVIRONMENT_MODE`.
The public `GET /api/runtime/environment` endpoint exposes only the active mode
and whether a restart is pending; it never returns secrets.

Live connection variables are intentionally required before Live Mode can be
used. Test and Live PostgreSQL databases must both be separate from the
shared catalog database. Do not point either mode at the shared stores. The
bundled `deploy/deploy.sh` creates the mode databases before API migrations.
To do this manually, run the two database creation commands separately:

```bash
docker compose --env-file deploy/.env.production -f deploy/docker-compose.production.yml \
  exec postgres psql -U admin -d postgres \
  -c "CREATE DATABASE dbob1234567890_test OWNER admin;"
docker compose --env-file deploy/.env.production -f deploy/docker-compose.production.yml \
  exec postgres psql -U admin -d postgres \
  -c "CREATE DATABASE dbob1234567890_live OWNER admin;"
```

The browser cache is hydrated from the server-reported active mode's database
and missing keys are not copied into the other mode. This prevents deleted
Admin sections, applications, and old local snapshots from reappearing after a
mode switch.

Verify the active mode after deployment with:

```bash
curl -sS https://your-domain.example/api/runtime/environment
```

The response reports `activeEnvironmentMode`, the requested mode saved by
Admin Console, and whether a restart is required. It does not expose database
URLs, credentials, API keys, or other secrets. After changing
`OPENBCON_ENVIRONMENT_MODE`, recreate the API and Python services so both
processes load the same mode from their environment:

```bash
docker compose --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --force-recreate api python
```

For updates:

```bash
git pull --ff-only
./deploy/deploy.sh
```

`deploy/deploy.sh` stamps the frontend image with the current Git commit and
the exact Git release tag when the checkout is tagged. In Admin Console, open
**Updates**, select **Check updates**, review the release tag, and select
**Install update** when one is available. The update agent fast-forwards only a
clean `main` checkout to the latest `origin/main`, then runs the normal
deployment script. Database volumes are preserved.

### Update checks and installation

- the authenticated Node API queries the fixed OpenBcon GitHub `main` commit
- the authenticated Node API reads GitHub release tags and matches the current
  commit to its tag when available
- the frontend compares that commit with the build's `VITE_APP_COMMIT` value
- `deploy/deploy.sh` sets `VITE_APP_COMMIT` automatically from `git rev-parse`
- `deploy/deploy.sh` sets `VITE_APP_VERSION` from the exact Git tag, or
  `unreleased` for an untagged checkout
- local builds without a commit stamp show `Unreleased` and cannot report
  whether the current build is behind
- production deployments include a private update agent on the Docker network;
  the agent is enabled automatically by `deploy/deploy.sh` and receives a
  random token stored in the ignored `deploy/.env.production`
- **Install update** refuses dirty tracked files, non-`main` checkouts, and
  divergent histories; it never deletes database volumes
- the API may briefly restart while the update is installed; Admin Console
  waits for the status endpoint to return and reports the final result
- GitHub failures and timeouts are shown as a check error; they do not affect
  the running application

The endpoint is `GET /api/updates?currentCommit=<commit>` and requires an
authenticated administrator session. Installation uses
`POST /api/updates/apply` and status is read from `GET /api/updates/status`.
Neither endpoint accepts a user-provided upstream URL or shell command. If
**Install update** is unavailable, run `./deploy/deploy.sh` once on the VPS to
create the private updater service and token. The updater requires access to
the Docker socket; keep it on the private Compose network and never expose
port `8788` publicly.

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

Clicking `Start` creates the application first, then immediately navigates to
`/strategic-reports?app_id=...`. Strategic Reports owns the generation step: it
loads the application by its public `app_id`, runs the configured LangGraph
workflow, persists the single report, and renders the completed business
analysis and financial model. Quick Build does not run generation itself.

In development and test mode, the Python service may use the configured demo
identity when no session cookie is present. Production must set
`OPENBCON_RUNTIME_ENV=production`; then the same-origin session cookie is
required for generation and the application workspace is checked server-side.
If generation fails or exceeds the two-minute client timeout, Strategic Reports
shows the backend error and offers `Retry generation` instead of leaving an
indefinite loading state.

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
PostgreSQL, then reads the current enabled Strategic Report sections and assigned
agents from MongoDB. Sections are generated in the configured order using each
agent's current name, role, and prompt; there are no Python-side default section
values. The LangGraph run trace and final result are stored in the application's
single `strategic_reports` row.

The supported output languages are `en-CA`, `fr-CA`, and `zh-CN`. The selected
language is passed to LangGraph prompts and stored with the Strategic Report.
Users can change the workspace language from Settings. The choice is persisted
locally and also controls locale-aware number, date, currency, and forecast formatting.

The report page resolves that row from the application relationship, so the
navigation URL can be `/strategic-reports?app_id=<applications.app_id>`; the
stored Strategic Report ID is displayed by the page and does not need to be
passed as a second query parameter.

Financial forecasting is part of the Strategic Report. By default it produces
three years of monthly periods (36 months), with revenue rows first, expense
rows second, and calculated total revenue, total expenses, and net cash flow.
Strategic Report renders the forecast with trend charts, net-cash-flow bars, and
annual summary cards. The detailed line-item table opens on Year 1 and the cards
switch it to the selected year's twelve monthly periods, so users can review
each year without scanning all 36 columns at once.

### Structured cover pages

Strategic Report cover pages are structured document sections rather than
free-form LLM HTML. Business Analysis and Technology Analysis each recognize
their configured Cover Page section and render a consistent cover with the
report title, business name, funding program, structured subtitle, date, bold
typography, centered alignment, and a brand-colored accent.

Clicking an analysis download action or a Table of Contents item opens a
scrollable document preview that mirrors the downloaded document: the cover is
shown first, followed by the configured sections in order. DOCX and PDF exports
use the same cover data and insert a page break before the first analysis
section. Generated prompts are not rendered as cover-page copy, so the cover
remains suitable for a client-facing business plan.

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

Strategic Report settings are also managed from the Admin Console and persisted with
the platform configuration. Administrators can:

- enable, rename, and reorder the sections shown during package generation
- define the document types available to those sections
- add, remove, and edit Strategic Report agents, including their names, roles, and prompts
- assign a document type and agent to each section
- configure reusable `cover-page` and `main-content` layouts, including their names, descriptions, and CSS declarations
- preview layout changes immediately before saving them

Layouts are intentionally edited as CSS declarations rather than arbitrary selector
rules. For example:

```text
padding: 36px 42px; background: #ffffff; gap: 18px;
```

Each Strategic Report section references one layout by ID. The report document
preview applies the saved declarations to the corresponding page, while the
`cover-page` layout also controls structured cover-page rendering. Layout
definitions are normalized to the current platform configuration, so the selected
Test or Live environment remains the source of truth and removed or stale local
section snapshots are not reintroduced.

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
- generated packages can be reopened later from the dedicated `/strategic-reports` route
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
- `workspace` for Funding Shortlist preferences and Quick Build drafts
- `user` for personal settings, pinned resources, and active workspace selection

The selected environment mode chooses the MongoDB database before these scopes
are read or written. Strategic Report section configuration therefore comes
from the current mode's `platform` document only; it never falls back to the
other mode's configuration.

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
are rejected by the Node API and Python generation API. The generation and
forecast endpoints resolve the session workspace and filter the requested
application by that workspace, so a user-supplied `app_id` cannot cross
workspace boundaries. AI connection tests are restricted to administrators and
workspace owners because they can consume configured provider credentials and
model quota. The test response is capped at 64 KB.

New password registrations create an account, establish a session immediately,
and send a one-time verification link. Email verification can be completed
later from the link or by requesting a resend. Development defaults to
`EMAIL_PROVIDER=console`, which logs the preview link instead of sending an
email. This is also the default for a production deployment in Test Mode, so
SMTP is optional while the platform is being evaluated. Before switching to
Live Mode, configure SMTP by setting `EMAIL_PROVIDER=smtp`, `SMTP_HOST`,
`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, and
`PUBLIC_APP_URL`. Existing users from before email verification was introduced
are treated as verified by the database migration.

Google registration and login are available when
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and
`GOOGLE_OAUTH_REDIRECT_URI` are configured. Register the exact callback URL in
Google Cloud Console: `https://YOUR_HOST/api/auth/google/callback` (or the
equivalent local URL). OAuth state is stored in short-lived HttpOnly cookies,
Google email verification is required, and the app never receives the Google
client secret.

Platform state writes are server-authorized: only a database user with the
`admin` role can update or delete platform configuration. Login failures are
rate-limited per IP and email, and payment resources are checked against the
current workspace/user before Stripe portal access or session lookup.

Local Node persistence routes and the Python generation service may use the
configured demo context when no cookie is present during development and test
runs. Set `OPENBCON_RUNTIME_ENV=production` for the Python service in production;
then both APIs require the login or registration API to establish a session and
the Python service validates the session workspace before generation. The
authentication endpoints also apply short-window rate limits to registration,
password-reset requests, and verification-email resends. Production password
reset and verification delivery require SMTP in Live Mode. Test Mode may use
the console provider and logs email previews instead of sending messages. Do
not expose the Node API, Python AI API,
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

The security review also checks for committed credential patterns, production
CORS settings, session-cookie flags, workspace authorization, AI endpoint
allowlisting, and Python dependency advisories. Keep
`OPENBCON_ALLOW_PRIVATE_AI_ENDPOINTS=false` in production unless a private
endpoint is explicitly required and network access is independently restricted.

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
