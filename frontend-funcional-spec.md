# Frontend Functional Specification: Customer Support Review Workflow

## Overview

The frontend module provides a simple human review interface for the Multi-Agent Customer Support Crew MVP. It demonstrates the critical workflow: customer support ticket input, run crew, and review package result.

The frontend now calls the local FastAPI backend for Week 4 integration. The default backend runtime remains deterministic and does not require paid LLM usage.

## User Journey

1. A support agent opens the app.
2. The app displays a seeded support ticket example.
3. The support agent can edit the ticket fields.
4. The support agent clicks Run.
5. The status changes from idle to running.
6. The backend creates a local run and returns status, observability steps, and a ReviewPackage.
7. The status changes to done.
8. The app displays a backend-generated ReviewPackage for human review.
9. The support agent can inspect the draft, routing, escalation, retrieved sources, and warnings.
10. The support agent can approve, reject, or request changes without sending any customer-facing response.
11. The support agent can click Reset to return to the seeded input state.

## Inputs

The user provides:

- Customer ID.
- Company name.
- Plan tier.
- Product area.
- Ticket subject.
- Ticket message.

## Run

When the user clicks Run:

- The UI validates that subject and message are present.
- The UI transitions to `running`.
- `POST /api/runs` is called with the current ticket input.
- `getRunStatus` is called with the returned run ID.
- The UI transitions to `done` and displays the backend ReviewPackage.

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

## History

The MVP shows a lightweight History section with the latest run:

- Run ID.
- Ticket subject.
- Final status.
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

### RunStatus

- `runId`
- `status`
- `lastUpdated`
- `runtimeMode`
- `reviewPackage`
- `observabilitySteps`
- `humanReview`
- `errorMessage`

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
- Live CrewAI LLM path remains optional and guarded.
- No authentication.
- No database persistence.
- No deployment configuration.
- No streaming, tool-call traces, cost dashboard, pause, cancel, or retry-diff.
- No automatic customer-facing response.

## Spec Sync Checklist

| Item | Status | Note |
| --- | --- | --- |
| Critical workflow documented | Done | Ticket input to backend ReviewPackage result. |
| Status model documented | Done | Uses only idle, running, done, and error. |
| API service contracts documented | Done | `POST /api/runs`, status, history, and review endpoints. |
| Human review constraint documented | Done | Draft is never sent automatically. |
| Backend integration point implemented | Done | Frontend uses FastAPI service through `apiCrewService.ts`. |
| Out-of-scope items listed | Done | No auth, DB, deployment, streaming, or real API integration. |
