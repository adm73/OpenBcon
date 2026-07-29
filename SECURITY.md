# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Email `security@bconomics.ai` with:

- affected route or component
- reproduction steps
- expected impact
- any suggested mitigation

The repository includes a PostgreSQL persistence API, request validation, an
explicit state-key allowlist, and audit logging. Authentication is not implemented
yet, and the development server uses seeded user and workspace IDs. The `/admin`
route and identity headers must not be exposed publicly until server-side
authentication and workspace authorization are connected.

Never put database URLs, payment secrets, AI API keys, OAuth tokens, Airtable
tokens, or customer data in committed files. Use environment variables or a
production secret manager.

`npm audit` currently reports a React Router advisory in RSC mode. This project
uses client-side `BrowserRouter` and does not enable React Server Components,
server actions, or React Router SSR. Continue monitoring upstream releases before
adding any of those execution paths.
