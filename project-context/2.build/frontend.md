# Frontend Build Notes

## Audit

- Persona: Frontend Developer (`.cursor/agents/frontend-eng.md`)
- Project: Multi-Agent Customer Support Crew
- Scope: Build Frontend module, Week 4 integration, and presentation UX refinement
- Source artifacts:
  - `project-context/1.define/prd.md`
  - `project-context/2.build/sad.md`
  - `project-context/2.build/backend.md`
  - `project-context/2.build/integration.md`
  - `project-context/2.build/observability.md`

## Frontend Scope

The frontend is a React/TypeScript operator console integrated with the local FastAPI backend. It supports the customer support review workflow from ticket input to ReviewPackage inspection, observability review, and human approval or rejection.

The default runtime is local deterministic mode. CrewAI Flow and CrewAI LLM remain selectable runtime modes for demos, but the UI does not require paid API access for the default flow.

## Presentation UX Structure

The app now uses a simple internal multi-view structure:

- Dashboard: high-level operational summary, recent runs, and the primary `Start New Support Run` CTA.
- New Support Run: focused form for customer metadata, ticket content, and runtime mode selection.
- Run Details: run metadata, executive summary, agent results, human review controls, and observability/performance panels.
- History / Reviews: filterable table for all runs, pending reviews, approved, rejected, and escalated cases.

This keeps the demo flow clear while preserving the technical evidence needed for the course deliverable.

## User Journey

1. User opens the app and lands on the Dashboard.
2. User clicks `Start New Support Run`.
3. User reviews or edits the seeded support ticket.
4. User selects a runtime mode:
   - Local deterministic.
   - CrewAI Flow.
   - CrewAI LLM.
5. User clicks `Run Analysis`.
6. Frontend calls `POST /api/runs` through `apiCrewService.ts`.
7. The app opens Run Details for the created run.
8. User reviews specialist agent outputs, routing, escalation, warnings, and the draft response.
9. User inspects observability only as needed: timeline, runtime events, metrics, and step durations.
10. User approves, rejects, or requests changes. No customer-facing response is sent.
11. User can open History / Reviews to inspect prior runs and review states.

## Files Created

- `frontend-funcional-spec.md`
- `frontend/package.json`
- `frontend/index.html`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/src/main.tsx`
- `frontend/src/services/stubCrewService.ts`
- `frontend/src/test/setup.ts`

## Files Updated

- `frontend/src/App.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`
- `frontend/src/services/apiCrewService.ts`
- `README.md`
- `project-context/2.build/frontend.md`
- `project-context/2.build/qa.md`

## How to Run Locally

Start the backend API:

```bash
PYTHONPATH=src .venv/bin/uvicorn customer_support_crew.api:app --host 127.0.0.1 --port 8000
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Then open the local Vite URL, normally:

```text
http://127.0.0.1:5173
```

Run frontend validation:

```bash
cd frontend
npm run build
npm test
```

## API Service Behavior

- `apiCrewService.ts` is the active frontend service.
- `startRun(ticketInput, runtimeMode)` calls `POST /api/runs`.
- `getRunStatus(runId)` calls `GET /api/runs/{runId}`.
- `getRunHistory()` calls `GET /api/runs`.
- `submitReview(runId, decision, notes)` calls `POST /api/runs/{runId}/review`.
- `getObservabilitySummary()` calls `GET /api/observability/summary`.
- `subscribeRunEvents(runId)` consumes the snapshot-style SSE endpoint when available.

`stubCrewService.ts` remains only as a legacy reference and is not the active integrated path.

## Current Limitations

- Default runtime is deterministic and local.
- CrewAI LLM mode requires provider configuration and may return safe runtime output instead of a parsed ReviewPackage.
- No authentication.
- No database persistence.
- No deployment configuration.
- No CRM/ticketing integration.
- Snapshot-style SSE only; no long-running live tool/token stream.
- Token and cost metrics are unavailable in deterministic mode.
- No automatic customer-facing response.

## QA Notes

The frontend includes lightweight tests for:

- Dashboard rendering.
- New run form rendering.
- Runtime selector behavior.
- Run creation and Run Details navigation.
- Human review controls and submission.
- History table rendering.

