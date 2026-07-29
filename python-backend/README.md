# OpenBcon Python Business Plan Backend

This service is a focused Python backend for the Quick Generate core workflow:

1. read funding program information from PostgreSQL
2. read company information from PostgreSQL
3. build a normalized generation context
4. run a LangGraph workflow
5. return and persist a generated business plan

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
  "workspace_id": "00000000-0000-4000-8000-000000000002",
  "company_id": "11111111-1111-4111-8111-111111111111",
  "funding_program_id": "22222222-2222-4222-8222-222222222222",
  "requested_by_user_id": "00000000-0000-4000-8000-000000000001",
  "package_name": "Northstar Foods FedDev Package",
  "target_language": "en",
  "section_limit": 7
}
```

Response body:

```json
{
  "package_id": "7de4d4b2-1b9d-4ab0-a31b-6daff0e63630",
  "run_id": "c09ff509-6b5b-4480-81b0-40368ef764f1",
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
OPENBCON_DB_DSN=postgresql://bconomics:bconomics@localhost:5432/bconomics
OPENBCON_OPENAI_MODEL=gpt-5
OPENBCON_OPENAI_API_KEY=your-key
OPENBCON_USE_MOCK_LLM=false
OPENBCON_API_HOST=0.0.0.0
OPENBCON_API_PORT=8010
```

If you want to test without a model key, set:

```bash
OPENBCON_USE_MOCK_LLM=true
```

## Install and run

```bash
cd python-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

## How the LangGraph flow works

```text
load company + program from database
  -> normalize_inputs
  -> analyze_program
  -> analyze_company
  -> build_outline
  -> generate_sections
  -> compile_output
  -> save sections + final document back to PostgreSQL
```

## Notes

- This service is intentionally focused on the generation core.
- Frontend progress states can be simulated or rendered separately.
- The graph is ready for future upgrades such as section regeneration,
  program-document ingestion, usage billing, and export workers.
