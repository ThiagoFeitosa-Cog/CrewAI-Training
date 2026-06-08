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

The latest premium redesign uses a responsive drawer/sidebar product shell to make the app feel like a support operations workspace rather than a document-style technical demo:

- Desktop sidebar navigation anchors Dashboard, New Run, and History.
- Desktop sidebar supports expanded and collapsed states. Collapsed mode shows icons, tooltip titles, and compact API status.
- Mobile/tablet uses a top app bar with a hamburger button and left drawer overlay.
- Dashboard acts as an operations cockpit with KPIs, Needs Attention, latest activity, and recent runs.
- New Run is organized as a guided three-step workspace: ticket details, runtime mode, and run analysis.
- Run Details acts as a review console, prioritizing recommendation, escalation risk, draft response review, human decision, and then technical visibility.
- History remains a lightweight support operations board.

The latest UX pass applies progressive disclosure:

- Run metadata is collapsed below the executive summary.
- Agent cards show the main result first and hide rationale/draft detail behind `View details`.
- Observability is secondary and grouped into collapsible panels for agent activity, runtime events, performance, and runtime details.
- The New Support Run view includes a helper card that explains the workflow and recommends the safest demo runtime.

## Visual Design System

The current presentation UI uses a modern B2B SaaS visual system inspired by work-management product patterns without copying any proprietary brand, logo, text, or assets.

Key visual decisions:

- CSS variables define the color system in `frontend/src/styles.css`.
- The app shell uses a `SupportCrew AI` wordmark, dark navy fixed desktop sidebar navigation, responsive mobile topbar/drawer, and subtle API status pill.
- The redundant header-level `New support run` CTA was removed so navigation and contextual page CTAs do not compete.
- Dashboard uses a hero card, metric cards, and a recent-runs board instead of technical logs.
- Runtime selection uses segmented cards instead of a raw select control.
- Runtime cards include plain-language helper text and hover guidance.
- Run Details uses a compact run header, executive summary card, draft response review panel, agent insight grid, prominent Human Review card, and a lower-priority Technical visibility section.
- Technical details use expandable panels rather than a first-level debug wall.
- History uses filter pills, status/runtime pills, and board-style table rows.
- Typography, shadows, border radii, status pills, and table spacing were refined for a more polished SaaS presentation feel.

## UX/UI Persona Collaboration

The presentation redesign was reviewed through three AAMAD/Codex development personas:

- UX Designer (`.cursor/agents/ux-designer.md`): clarified the Dashboard to New Run to Run Details to History journey and reduced cognitive load.
- UI Designer (`.cursor/agents/ui-designer.md`): focused the visual system on restrained B2B SaaS spacing, typography, cards, tables, badges, and buttons.
- Design Reviewer (`.cursor/agents/design-reviewer.md`): checked demo readiness, human review visibility, runtime clarity, and observability balance.

Resulting frontend refinements:

- Runtime modes use friendly labels, helper text, and segmented cards.
- Run Details leads with recommended action, escalation status, and human review required status.
- Observability and performance remain visible but secondary.
- Token and cost metrics explicitly state when they are unavailable in deterministic mode.

## User Journey

1. User opens the app and sees the cinematic landing page.
2. User can click `See how it works` to review the multi-agent orchestration story.
3. User clicks `Launch Demo` or `Launch CrewAI Demo` to enter the operational Dashboard.
4. User clicks `Start New Support Run`.
5. User reviews or edits the seeded support ticket.
6. User selects a runtime mode:
   - Local deterministic.
   - CrewAI Flow.
   - CrewAI LLM.
7. User clicks `Run Analysis`.
8. Frontend calls `POST /api/runs` through `apiCrewService.ts`.
9. The app opens Run Details for the created run.
10. User reviews specialist agent outputs, routing, escalation, warnings, and the draft response.
11. User inspects observability only as needed: timeline, runtime events, metrics, and step durations.
12. User approves, rejects, or requests changes. No customer-facing response is sent.
13. User can open History / Reviews to inspect prior runs and review states.

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

- CrewAI LLM is the primary demo runtime and default UI selection.
- Deterministic and CrewAI Flow modes remain available only as advanced fallback modes.
- CrewAI LLM mode requires provider configuration; if output cannot be parsed, the UI shows a safe parsing message and preserves the runtime output for human review.
- No authentication.
- No database persistence.
- No deployment configuration.
- No CRM/ticketing integration.
- Snapshot-style SSE only; no long-running live tool/token stream.
- Token and cost metrics may be unavailable for local or provider runs depending on runtime support.
- No automatic customer-facing response.

## Minimalist UX Simplification Pass

- Dashboard now focuses on overview, KPIs, recent runs, and the primary Start New Support Run CTA.
- New Run keeps the CrewAI LLM recommended runtime visible and moves fallback modes into Advanced fallback modes.
- Run Details prioritizes decision summary, draft response, and human review before diagnostics.
- Agent rationales, source snippets, warnings, CrewAI agent/task lists, run metadata, timeline, and performance details are hidden behind modal or collapsed disclosure controls.
- The goal is a calmer presentation flow that is scannable before exposing implementation details.

## Cinematic Landing Page Pass

- Added a presentation-first landing page before the operational dashboard.
- The landing page explains the CrewAI customer support workflow through five sections: Hero, Multi-Agent Orchestration, Human Review, Observability, and Final CTA.
- `Launch Demo` and `Launch CrewAI Demo` enter the existing dashboard without changing backend behavior.
- `See how it works` scrolls to the orchestration section.
- Lenis provides smooth scrolling in browsers that do not request reduced motion.
- GSAP and ScrollTrigger provide the hero reveal, scroll indicator fade, and desktop pinned orchestration sequence.
- Mobile uses a non-pinned vertical flow to avoid jumpy scrolling.

## QA Notes

The frontend includes lightweight tests for:

- Dashboard rendering.
- New run form rendering.
- Runtime selector behavior.
- Run creation and Run Details navigation.
- Human review controls and submission.
- History table rendering.
