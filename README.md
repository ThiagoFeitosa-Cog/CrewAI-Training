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
- `POST /api/runs/{run_id}/review`
- `GET /api/runs`

Local run records are stored as JSON under `data/runs/`. These runtime JSON files are ignored by Git.

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

The frontend module is a React/TypeScript review workflow integrated with the local FastAPI backend.

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
3. Open the frontend.
4. Click `Run`.
5. Confirm the ReviewPackage renders from the backend.
6. Submit a human review decision.
7. Confirm Run History updates.

Current frontend limitations:

- No authentication, database persistence, deployment, streaming, cost dashboard, or automatic customer-facing response.
- Default integrated runtime is deterministic. Live CrewAI LLM execution remains optional and guarded.
