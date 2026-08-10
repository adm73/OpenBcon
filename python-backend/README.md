# OpenBcon Python Business Plan Backend

This service is a focused Python backend for the Quick Build core workflow:

1. read an application by numeric ID from the PostgreSQL `applications` table
2. resolve its company and funding program records from PostgreSQL
3. build a normalized generation context
4. read the enabled section order and prompts plus the configured agents from the Admin Console Advisory Hub configuration in MongoDB
5. run a LangGraph workflow using exactly those configured sections and agent instructions
6. return and persist a generated business plan and complete strategic review trace

In production, all non-health endpoints require the Node-issued
`bconomics_session` HttpOnly cookie. The Python service validates that session
against PostgreSQL and checks the application's workspace before loading any
generation context. Development and test runs may use the configured demo
identity when `OPENBCON_RUNTIME_ENV` is not `production`; production deployment
sets `OPENBCON_RUNTIME_ENV=production` and never accepts a missing session.

The frontend can keep progress animations, timeline rendering, and AI workspace
UI states. This backend only owns the core data loading and generation logic.

## Directory structure

```text
python-backend/
  app/
    main.py         FastAPI entrypoint
    router.py       HTTP routes
    config.py       Environment settings
    db.py           PostgreSQL connection helpers
    repository.py   Load company/program data and persist outputs
    models.py       Request, response, and domain schemas
    state.py        LangGraph shared state
    prompts.py      Prompt builders
    llm.py          OpenAI + mock model gateways
    nodes.py        LangGraph node implementation
    graph.py        Graph compilation
  requirements.txt
```

## Core API

`POST /api/business-plan/generate`

Request body:

```json
{
  "app_id": "8d3f7a1c2e9b4d60",
  "language": "en-CA"
}
```

The external application ID and optional output language are the only request
inputs. Supported languages are `en-CA`, `fr-CA`, and `zh-CN`. The backend rejects
direct company or program payloads and loads the complete application context from
the relational `applications` table, including its linked company, funding
program, and owner. The selected language is passed through LangGraph prompts and
stored on the related `strategic_reports` row.

Response body:

```json
{
  "strategic_report_id": "7de4d4b2-1b9d-4ab0-a31b-6daff0e63630",
  "status": "completed",
  "document": {
    "title": "Northstar Foods Business Plan",
    "program_name": "FedDev Ontario Growth Program",
    "business_name": "Northstar Foods",
    "executive_summary": "...",
    "sections": [
      {
        "section_key": "executive_summary",
        "title": "Executive Summary",
        "content": "..."
      }
    ]
  }
}
```

## Environment

Create `.env` from your own values:

```bash
OPENBCON_DB_DSN=postgresql://admin:bconomics@localhost:5432/dbob1234567890
OPENBCON_DB_DSN_SHARED=postgresql://admin:bconomics@localhost:5432/dbob1234567890
OPENBCON_DB_DSN_TEST=postgresql://admin:bconomics@localhost:5432/dbob1234567890_test
OPENBCON_DB_DSN_LIVE=postgresql://admin:bconomics@localhost:5432/dbob1234567890_live
OPENBCON_ENVIRONMENT_MODE=test
OPENBCON_OPENAI_MODEL=gpt-5
OPENBCON_OPENAI_API_KEY=your-key
OPENBCON_USE_MOCK_LLM=false
OPENBCON_MONGODB_URL=mongodb://localhost:27017
OPENBCON_MONGODB_DATABASE=dbob1234567890
OPENBCON_MONGODB_DATABASE_SHARED=dbob1234567890
OPENBCON_MONGODB_DATABASE_TEST=dbob1234567890_test
OPENBCON_MONGODB_DATABASE_LIVE=dbob1234567890_live
OPENBCON_API_HOST=0.0.0.0
OPENBCON_API_PORT=8010
OPENBCON_RUNTIME_ENV=production
OPENBCON_ALLOWED_AI_ENDPOINT_HOSTS=api.openai.com,api.anthropic.com,generativelanguage.googleapis.com,openrouter.ai
OPENBCON_ALLOW_PRIVATE_AI_ENDPOINTS=false
OPENBCON_OLLAMA_BASE_URL=http://127.0.0.1:11434
OPENBCON_OLLAMA_MODEL=smollm2:135m
```

If you want to test without a model key, set:

```bash
OPENBCON_USE_MOCK_LLM=true
```

Advisory Hub sections have no Python-side defaults. Every generation reads the
current Admin Console section and agent configuration from the shared MongoDB
database. The server's `OPENBCON_ENVIRONMENT_MODE` environment variable is
authoritative for the Test/Live business database boundary; request headers
cannot switch it. Change that variable and restart the Node and Python
services to apply a mode switch. Generation fails if the selected database
configuration is missing, contains no enabled sections, or a section
references an unavailable agent.

## Install and run

```bash
cd python-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

The admin model connection chat uses `POST /api/ai/test-connection`. The
browser sends the test message to this Python service, and this service sends
the real provider request server-side.

For custom OpenAI-compatible providers, add the provider hostname to
`OPENBCON_ALLOWED_AI_ENDPOINT_HOSTS`. Private or local endpoints remain blocked
unless `OPENBCON_ALLOW_PRIVATE_AI_ENDPOINTS=true` is explicitly enabled for
local development.

## How the LangGraph flow works

```text
load application by ID from database
  -> resolve company + program records
  -> read enabled Advisory Hub sections and agents from MongoDB
  -> normalize_inputs
  -> analyze_program
  -> analyze_company
  -> build_outline from Admin Console section configuration
  -> generate_sections
  -> compile_output
  -> save complete trace + final document to PostgreSQL strategic_reports
  -> save the complete trace and final result to strategic_reports
```

## Notes

- This service is intentionally focused on the generation core.
- Frontend progress states can be simulated or rendered separately.
- The graph is ready for future upgrades such as section regeneration,
  program-document ingestion, usage billing, and export workers.
