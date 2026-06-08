# Week 4 Integration Notes

## Audit

- Persona: Integration Engineer (`.cursor/agents/integration-eng.md`)
- Date: 2026-06-08
- Scope: Full-stack local MVP integration
- Runtime: Deterministic backend by default, optional CrewAI Flow and CrewAI LLM modes are explicit

## Implementation Summary

Week 4 connects the React frontend to a local FastAPI backend. The integrated workflow is:

1. Operator edits or uses the seeded support ticket.
2. Frontend calls `POST /api/runs` with `runtimeMode`.
3. Backend dispatches to deterministic, CrewAI Flow, or CrewAI LLM runtime.
4. Backend stores a JSON run record under `data/runs/`.
5. Frontend renders the returned ReviewPackage or safe runtime output, agent activity, runtime observability, and human review controls.
6. Operator submits a review decision through `POST /api/runs/{run_id}/review`.
7. Frontend refreshes run history through `GET /api/runs`.

## Backend Endpoints

- `GET /health`: service status and runtime mode.
- `POST /api/runs`: creates and processes a run with `runtimeMode`.
- `GET /api/runs/{run_id}`: returns run status, ReviewPackage, observability, and review state.
- `POST /api/runs/{run_id}/review`: stores `approved`, `rejected`, or `needs_changes`.
- `GET /api/runs`: returns lightweight run history.

## Frontend Contract

- Active service: `frontend/src/services/apiCrewService.ts`.
- Default API base URL: `http://127.0.0.1:8000`.
- Optional override: `VITE_API_BASE_URL`.
- Frontend never calls CrewAI directly and never receives provider secrets.
- Runtime mode options: `deterministic`, `crewai_flow`, `crewai_llm`.

## Runtime Dispatch

- `deterministic`: default local path, no API key, parsed ReviewPackage.
- `crewai_flow`: uses CrewAI Flow when installed or clearly labeled fallback when unavailable, no API key.
- `crewai_llm`: validates provider configuration and attempts `CustomerSupportCrew().crew().kickoff(inputs={...})` only when explicitly selected.

The API stores `requested_runtime_mode`, `actual_runtime_mode`, `runtime_status`, `runtime_error`, `review_package_parse_status`, and `llm_kickoff_attempted`. Live LLM output is returned in `runtime_output` when it cannot yet be reliably parsed into the local Pydantic `ReviewPackage`.

## Human-In-The-Loop Flow

- The ReviewPackage is rendered for operator review.
- Human decision is persisted locally as run state.
- Customer-facing draft responses are not sent automatically.

## Observability

Each run includes simple step activity:

- classification
- sentiment
- knowledge retrieval
- draft response
- routing
- escalation
- review package assembly
- runtime selected
- runtime started
- runtime completed or runtime error

Each step includes name, status, summary, and timestamp.

## Persistence

- Local JSON run records live under `data/runs/`.
- Runtime JSON files are ignored by Git.
- This is local MVP persistence, not database persistence.

## Validation

- Backend endpoint smoke tests passed with `curl`.
- Frontend build passed.
- Frontend tests passed.
- Backend deterministic tests passed.
- Frontend dev server and backend API server were started locally.

## Limitations

- No authentication.
- No database persistence.
- No deployment configuration.
- No real CRM or ticketing integration.
- No notification integration.
- No streaming/tool trace dashboard.
- Default full-stack flow is deterministic.
- Live LLM/CrewAI path remains optional, explicitly selected, and guarded.
- Live LLM output is not yet normalized into the local Pydantic ReviewPackage contract.
