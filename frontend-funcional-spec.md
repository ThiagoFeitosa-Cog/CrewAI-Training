# Frontend Functional Specification: Customer Support Review Workflow

## Overview

The frontend module provides a simple human review interface for the Multi-Agent Customer Support Crew MVP. It demonstrates the critical workflow: customer support ticket input, run crew, and review package result.

The frontend now calls the local FastAPI backend for Week 4 integration. The default backend runtime remains deterministic and does not require paid LLM usage. Operators can explicitly select CrewAI Flow or CrewAI LLM modes for demos and validation.

## User Journey

1. A support agent opens the app.
2. The app displays a seeded support ticket example.
3. The support agent can edit the ticket fields.
4. The support agent selects a runtime mode.
5. The support agent clicks Run.
6. The status changes from idle to running.
7. The backend creates a local run and returns status, correlation ids, runtime details, observability events, metrics, and a ReviewPackage or runtime output.
8. The status changes to done or error.
9. The app displays a backend-generated ReviewPackage or safe runtime output for human review.
10. The support agent can inspect the draft, routing, escalation, retrieved sources, warnings, runtime details, and timeline.
11. The support agent can approve, reject, or request changes without sending any customer-facing response.
12. The support agent can click Reset to return to the seeded input state.

## Inputs

The user provides:

- Customer ID.
- Company name.
- Plan tier.
- Product area.
- Ticket subject.
- Ticket message.
- Runtime mode:
  - Local deterministic.
  - CrewAI Flow.
  - CrewAI LLM.

## Run

When the user clicks Run:

- The UI validates that subject and message are present.
- The UI transitions to `running`.
- `POST /api/runs` is called with the current ticket input and selected `runtimeMode`.
- `getRunStatus` is called with the returned run ID.
- The UI attempts to consume `GET /api/runs/{runId}/events` as a snapshot-style SSE stream.
- If SSE is unavailable, the UI falls back to the run detail response.
- The UI transitions to `done` and displays the backend ReviewPackage.
- If the selected runtime returns `error`, the UI shows a safe inline runtime error and keeps Retry available.

## Results

The result section displays:

- Classification.
- Sentiment and urgency.
- Retrieved sources.
- Draft response.
- Routing recommendation.
- Escalation recommendation.
- Warnings.
- Human approval required.

The draft response is clearly marked as for human review only and is not sent automatically.

CrewAI LLM output may render as a safe runtime output envelope instead of a parsed ReviewPackage until strict Pydantic parsing is added.

## Observability and Performance

The frontend displays:

- `run_id`
- `trace_id`
- runtime mode
- requested runtime mode
- actual runtime mode
- runtime status
- runtime error, when present
- LLM kickoff attempted
- status
- event timeline
- total wall time
- slowest step
- step durations
- aggregate observability summary

Token usage and cost estimate display as unavailable in deterministic mode.

## History

The MVP shows a lightweight History section with the latest run:

- Run ID.
- Trace ID.
- Ticket subject.
- Final status.
- Review status.
- Last updated timestamp.

Run history is loaded from `GET /api/runs` and backed by local JSON records under `data/runs/`.

## Status Model

The frontend uses a lightweight finite-state machine:

- `idle`: form is ready.
- `running`: crew run is in progress.
- `done`: review package is available.
- `error`: inline error message is shown and Retry is available.

Status labels:

- Crew: idle.
- Crew: running.
- Crew: done.
- Crew: error.

## Contracts

### TicketInput

- `customerId`
- `companyName`
- `planTier`
- `productArea`
- `subject`
- `message`

### RuntimeMode

- `deterministic`
- `crewai_flow`
- `crewai_llm`

### RunStatus

- `runId`
- `traceId`
- `status`
- `lastUpdated`
- `runtimeMode`
- `requestedRuntimeMode`
- `actualRuntimeMode`
- `runtimeStatus`
- `runtimeError`
- `reviewPackageParseStatus`
- `llmKickoffAttempted`
- `runtimeOutput`
- `reviewPackage`
- `observabilitySteps`
- `events`
- `metrics`
- `observabilitySummary`
- `humanReview`
- `errorMessage`

### RunEvent

- `eventId`
- `runId`
- `traceId`
- `eventType`
- `timestamp`
- `safeSummary`
- `stepName`
- `durationMs`
- `metadata`

### RunMetrics

- `runId`
- `traceId`
- `runtimeMode`
- `status`
- `startedAt`
- `finishedAt`
- `wallTimeMs`
- `stepMetrics`
- `slowestStep`
- `error`
- `tokenUsage`
- `costEstimate`

### RuntimeOutput

- `type`
- `reviewPackageParseStatus`
- `outputText`
- `humanApprovalRequired`
- `warnings`
- `configurationWarnings`

### ReviewPackage

- `classification`
- `sentiment`
- `retrievedSources`
- `draftResponse`
- `routingRecommendation`
- `escalationRecommendation`
- `warnings`
- `humanApprovalRequired`
- `readyForHumanReview`

### API Endpoints

- `POST /api/runs`
- `GET /api/runs/{runId}`
- `GET /api/runs/{runId}/events`
- `GET /api/runs/{runId}/events-json`
- `GET /api/runs/{runId}/metrics`
- `GET /api/observability/summary`
- `GET /api/runs`
- `POST /api/runs/{runId}/review`

## Stub Services

`stubCrewService.ts` remains only as a legacy fallback/reference. The active Week 4 integration uses `apiCrewService.ts`.

## Accessibility Notes

- Use semantic headings.
- Use explicit form labels.
- Use keyboard-accessible buttons.
- Use readable default styling and contrast.
- Show inline errors in text.
- Avoid jargon-heavy labels.

Advanced accessibility, focus management, and resilience behavior are deferred to later modules.

## Current Limitations

- Deterministic backend runtime by default.
- CrewAI Flow and CrewAI LLM modes are explicit runtime choices.
- CrewAI LLM mode requires configured provider values and may return safe runtime output instead of parsed ReviewPackage.
- No authentication.
- No database persistence.
- No deployment configuration.
- Snapshot-style SSE event stream only; no long-running live token/tool streaming.
- No raw prompt trace, detailed tool-call trace dashboard, paid cost dashboard, pause, cancel, or retry-diff.
- No automatic customer-facing response.

## Spec Sync Checklist

| Item | Status | Note |
| --- | --- | --- |
| Critical workflow documented | Done | Ticket input to backend ReviewPackage result. |
| Status model documented | Done | Uses only idle, running, done, and error. |
| API service contracts documented | Done | `POST /api/runs`, status, history, and review endpoints. |
| Observability contracts documented | Done | Events, metrics, summary, run_id, and trace_id are documented. |
| Runtime selector documented | Done | Local deterministic, CrewAI Flow, and CrewAI LLM modes are documented. |
| Human review constraint documented | Done | Draft is never sent automatically. |
| Backend integration point implemented | Done | Frontend uses FastAPI service through `apiCrewService.ts`. |
| Out-of-scope items listed | Done | No auth, DB, deployment, raw prompt tracing, or automatic response. |
