# AAMAD CrewAI Capstone

## Backend Prototype

This repository contains the Multi-Agent Customer Support Crew capstone MVP scaffold.

Run the deterministic local backend prototype:

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
```

This assumes a virtual environment exists at `.venv`.

Run the deterministic CrewAI Flow backend path:

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_flow
```

This path uses real CrewAI `Flow.kickoff()` with `@start` and `@listen` when CrewAI is installed. If CrewAI is not installed, it uses the clearly labeled local fallback runner. Neither path requires `OPENAI_API_KEY`.

Prepare the optional LLM-backed CrewAI runtime:

```bash
uv pip install -e '.[crewai]'
export OPENAI_API_KEY=your_key_here
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_main
```

CrewAI CLI can also invoke the same guarded entrypoint:

```bash
crewai run
```

If `OPENAI_API_KEY` is missing, the LLM entrypoint exits with setup guidance instead of pretending to run LLM agents.

### Optional LLM Provider Configuration

For the course/project Microsoft Foundry or another OpenAI-compatible endpoint, create a local `.env` with:

```bash
MODEL=
OPENAI_API_BASE=
OPENAI_API_KEY=
```

`MODEL` is the provider/model identifier, `OPENAI_API_BASE` is the OpenAI-compatible endpoint base URL, and `OPENAI_API_KEY` is the secret key. Do not commit `.env`. No key is required for deterministic mode. `crewai run` uses the guarded LLM entrypoint and can attempt the LLM-backed CrewAI path when the provider variables are configured.

Run the lightweight backend validation tests:

```bash
PYTHONPATH=src .venv/bin/python -m unittest discover tests
```

The prototype loads one sample support ticket, runs the local Flow-style pipeline, searches the local knowledge base, and prints a human review package as JSON.

Run the FastAPI backend for the integrated full-stack MVP:

```bash
PYTHONPATH=src .venv/bin/uvicorn customer_support_crew.api:app --host 127.0.0.1 --port 8000
```

In a normal local terminal you can also use reload:

```bash
PYTHONPATH=src .venv/bin/uvicorn customer_support_crew.api:app --reload --host 127.0.0.1 --port 8000
```

API endpoints:

- `GET /health`
- `POST /api/runs`
- `GET /api/runs/{run_id}`
- `GET /api/runs/{run_id}/events`
- `GET /api/runs/{run_id}/events-json`
- `GET /api/runs/{run_id}/metrics`
- `GET /api/observability/summary`
- `POST /api/runs/{run_id}/review`
- `GET /api/runs`

Local run records are stored as JSON under `data/runs/`. These runtime JSON files are ignored by Git.

### Full-Stack Runtime Modes

`POST /api/runs` accepts an optional runtime selector:

```json
{
  "customerId": "CUST-2048",
  "companyName": "Northstar Analytics",
  "planTier": "Enterprise",
  "productArea": "Integrations",
  "subject": "Urgent: API sync failed again before our renewal review",
  "message": "Support ticket body",
  "runtimeMode": "deterministic"
}
```

Supported values:

- `deterministic`: default safe local runtime. No provider key required. Returns a parsed `ReviewPackage`.
- `crewai_flow`: uses the CrewAI Flow path when installed, or the explicit local fallback when CrewAI Flow is unavailable. No provider key required.
- `crewai_llm`: uses `CustomerSupportCrew().crew().kickoff(inputs={...})`. Requires CrewAI plus `OPENAI_API_KEY`; uses `MODEL` and `OPENAI_API_BASE` when present.

Run records include:

- `requested_runtime_mode`
- `actual_runtime_mode`
- `runtime_status`
- `runtime_error`
- `llm_kickoff_attempted`
- `review_package_parse_status`
- `runtime_output`

The LLM mode currently returns the CrewAI output in a safe `runtime_output` envelope. It does not automatically send anything to the customer. Exact Pydantic `ReviewPackage` parsing for live LLM output remains a follow-up.

### Local Observability and Performance

The integrated MVP records local, safe observability data for every API run. `run_id` is the correlation key across API responses, frontend UI, local JSON persistence, events, and metrics. `trace_id` is currently equal to `run_id`; it is ready to map to a provider trace id later if a real tracing backend is enabled.

Each run stores:

- safe product-facing events such as `run_started`, `task_started`, `task_completed`, `tool_used`, `run_completed`, `review_submitted`, and `error`
- runtime events such as `runtime_selected`, `runtime_started`, `runtime_completed`, and `runtime_error`
- step durations for classification, sentiment, retrieval, draft response, routing, escalation, and review package assembly
- total wall time and slowest step
- null token/cost metrics in deterministic mode

Test event streaming with:

```bash
curl -N http://127.0.0.1:8000/api/runs/<run_id>/events
```

Fetch metrics with:

```bash
curl http://127.0.0.1:8000/api/runs/<run_id>/metrics
curl http://127.0.0.1:8000/api/observability/summary
```

Optional CrewAI ecosystem tracing is prepared but not required. To experiment after local CrewAI/AMP setup, use a local `.env` only:

```bash
OBSERVABILITY_MODE=local
CREWAI_TRACING_ENABLED=true
```

Do not commit `.env`. The deterministic backend, API, and frontend do not require CrewAI AMP login or paid provider access.

Current local assets:

- Fixture: `data/fixtures/sample_ticket.json`
- Knowledge base: `knowledge_base/support_kb.md`
- Pydantic models: `src/customer_support_crew/models.py`
- Flow prototype: `src/customer_support_crew/flow.py`
- CrewAI crew definition: `src/customer_support_crew/crew.py`
- CrewAI Flow runner with explicit fallback: `src/customer_support_crew/crewai_flow.py`
- Future LLM CrewAI entrypoint: `src/customer_support_crew/crewai_main.py`
- CrewAI config: `src/customer_support_crew/config/agents.yaml`, `src/customer_support_crew/config/tasks.yaml`

Current backend limitations:

- Deterministic keyword-based MVP logic for the runnable prototype.
- No production ticketing or CRM integrations.
- No authentication, database persistence, deployment, or autonomous customer response.
- No customer-facing response is sent automatically.
- LLM CrewAI runtime execution is prepared but optional; it requires CrewAI installation and `OPENAI_API_KEY`.

## Frontend Prototype

The frontend module is a React/TypeScript operator console integrated with the local FastAPI backend. It uses a clean multi-view presentation flow:

- Dashboard.
- New Support Run.
- Run Details.
- History / Reviews.

Run locally:

```bash
cd frontend
npm install
npm run dev
```

By default the frontend calls:

```bash
http://127.0.0.1:8000
```

Override with `VITE_API_BASE_URL` if needed.

Validate the frontend:

```bash
cd frontend
npm run build
npm test
```

Frontend artifacts:

- Functional spec: `frontend-funcional-spec.md`
- Build notes: `project-context/2.build/frontend.md`
- API service: `frontend/src/services/apiCrewService.ts`

Full-stack local test:

1. Start the backend API on `http://127.0.0.1:8000`.
2. Start the frontend on `http://127.0.0.1:5173`.
3. Open the frontend and confirm the Dashboard is the initial view.
4. Click `Start New Support Run`.
5. Edit or keep the seeded support ticket.
6. Select a runtime mode. `Local deterministic` is the default demo-safe mode.
7. Click `Run Analysis`.
8. Confirm Run Details opens and displays the ReviewPackage or safe runtime output from the backend.
9. Confirm requested/actual runtime mode, run correlation, event timeline, performance metrics, and observability data are available without dominating the screen.
10. Submit a human review decision.
11. Open History / Reviews and confirm the run appears with review status and escalation state.

Current frontend limitations:

- No authentication, database persistence, deployment, streaming, cost dashboard, or automatic customer-facing response.
- Local event streaming is a snapshot-style SSE stream for the synchronous MVP, not long-running live agent streaming.
- Default integrated runtime is deterministic. Live CrewAI LLM execution remains optional and explicitly selected.
