# Frontend Build Notes

## Audit

- Persona: Frontend Developer (`.cursor/agents/frontend-eng.md`)
- Date: 2026-05-04
- Scope: Build Frontend module deliverable
- Source artifacts:
  - `project-context/1.define/prd.md`
  - `project-context/2.build/sad.md`
  - `project-context/2.build/backend.md`

## Frontend Scope

The frontend implements the Customer Support Review Workflow with stubbed services only. It does not connect to the backend runtime or CrewAI execution yet.

## User Journey

1. User opens the single-page app.
2. User reviews or edits the seeded support ticket.
3. User clicks Run.
4. UI transitions from `idle` to `running`.
5. Stubbed `startRun` and `getRunStatus` services return fixed mock data.
6. UI transitions to `done`.
7. User reviews the mocked ReviewPackage.
8. User can click Reset to return to `idle`.

## Files Created

- `frontend-funcional-spec.md`
- `frontend/package.json`
- `frontend/index.html`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`
- `frontend/src/services/stubCrewService.ts`
- `frontend/src/App.test.tsx`
- `frontend/src/test/setup.ts`

## How to Run Locally

```bash
cd frontend
npm install
npm run dev
```

Then open the local Vite URL printed by the command.

Run frontend validation:

```bash
cd frontend
npm run build
npm test
```

## Stub Service Behavior

- `startRun(ticketInput)` validates required fields and returns a fixed running status.
- `getRunStatus(runId)` returns a fixed done status and mocked ReviewPackage.
- No network requests are made.
- The future integration layer should replace these functions with backend calls.

## Current Limitations

- Stubbed services only.
- No real backend or CrewAI runtime connection.
- No authentication.
- No database persistence.
- No deployment configuration.
- No streaming, detailed tool-call traces, cost dashboard, pause, cancel, or retry-diff.
- No automatic customer-facing response.

## CrewAI / Backend Integration Point

Future integration should connect `frontend/src/services/stubCrewService.ts` to the backend endpoint or runtime adapter that returns a real `ReviewPackage`.

## QA Notes

The frontend includes lightweight component tests for the critical workflow:

- idle to running to done.
- mocked ReviewPackage rendering.
- reset back to idle.

