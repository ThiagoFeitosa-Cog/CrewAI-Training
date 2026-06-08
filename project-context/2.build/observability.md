# Observability and Performance Monitoring

## Metadata

- Project: Multi-Agent Customer Support Crew
- Phase: AAMAD Phase 2 Build
- Module: Observability and Performance Monitoring
- Runtime default: deterministic local backend
- Optional runtimes: CrewAI Flow and CrewAI LLM with guarded provider configuration

## Implementation Summary

The Week 4 integrated MVP now records local observability data for every FastAPI run without requiring CrewAI AMP, OpenAI, Microsoft Foundry, or any paid provider. Observability is stored with the same local JSON run record used by the full-stack MVP.

The implementation uses `run_id` as the correlation key across frontend, backend, persistence, events, metrics, and future optional traces. `trace_id` is currently equal to `run_id` until an external tracing backend provides a separate identifier.

## Run / Trace / Step Model

- `run_id`: primary correlation id created by the backend for each support workflow execution.
- `trace_id`: trace-ready id; currently equal to `run_id`.
- `event_id`: unique id for each safe product-facing event.
- `step_name`: deterministic pipeline step such as `classification`, `sentiment`, or `knowledge_retrieval`.
- `requested_runtime_mode`: mode requested by the frontend/API caller.
- `actual_runtime_mode`: mode actually used by the backend.
- `runtime_status`: `success` or `error`.
- `StepMetric`: duration and status for one deterministic task.
- `RunMetrics`: wall time, step metrics, slowest step, optional token usage, optional cost estimate, and error state.

## Event Taxonomy

The backend records safe events only:

- `run_started`
- `runtime_selected`
- `runtime_started`
- `runtime_completed`
- `runtime_error`
- `task_started`
- `task_completed`
- `tool_used`
- `run_completed`
- `review_submitted`
- `error`

Events include safe summaries and metadata only. The system does not store raw prompts, provider secrets, raw LLM messages, API keys, or customer-facing side effects in the observability event stream.

## Backend Endpoints

- `GET /health`: includes local observability status.
- `POST /api/runs`: creates a run for the requested runtime mode, records events and metrics, and stores the ReviewPackage or safe runtime output.
- `GET /api/runs/{run_id}`: returns the run record, ReviewPackage, events, metrics, and review state.
- `GET /api/runs/{run_id}/events`: returns a snapshot-style SSE stream of persisted run events.
- `GET /api/runs/{run_id}/events-json`: returns persisted events as JSON for fallback/testing.
- `GET /api/runs/{run_id}/metrics`: returns `RunMetrics`.
- `GET /api/observability/summary`: returns aggregate local metrics.
- `POST /api/runs/{run_id}/review`: records the human review state and appends a `review_submitted` event.

`POST /api/runs` supports `runtimeMode` values:

- `deterministic`
- `crewai_flow`
- `crewai_llm`

All runtime modes record runtime events and wall time. Deterministic mode records individual local task metrics. CrewAI Flow and CrewAI LLM currently record the selected runtime execution as `runtime_execution`.

## Frontend Panels

The frontend now displays:

- run correlation: `run_id`, `trace_id`, runtime mode, and status
- requested runtime, actual runtime, runtime status, runtime error, and LLM kickoff attempted
- event timeline from backend events
- performance panel with wall time, slowest step, step durations, token usage status, and cost estimate status
- aggregate observability summary
- existing ReviewPackage, Human Review, Run History, and Agent Activity sections

SSE is attempted through `EventSource`. If SSE is unavailable or fails, the frontend falls back to the run detail returned by the API.

## Performance Metrics

The deterministic backend records timing for:

- classification
- sentiment
- knowledge retrieval
- draft response
- routing
- escalation
- review package assembly

The default deterministic mode does not generate token usage or provider cost metrics. The frontend displays these fields as unavailable in deterministic mode.

CrewAI Flow and CrewAI LLM modes record total runtime wall time. Token and cost metrics remain null unless a future provider-specific adapter returns those values safely.

## Optional CrewAI AMP / Ecosystem Tracing Readiness

The project supports:

```bash
OBSERVABILITY_MODE=local
CREWAI_TRACING_ENABLED=false
```

`CREWAI_TRACING_ENABLED=true` is read defensively by CrewAI-ready paths. The default deterministic API does not require CrewAI AMP login, does not authenticate with external tracing providers, and does not fail if tracing is unavailable.

## Persistence

Run records are stored locally under:

```text
data/runs/
```

Generated `data/runs/*.json` files are ignored by Git. `data/runs/.gitkeep` preserves the folder.

## Limitations

- SSE is snapshot-style because the MVP pipeline is synchronous.
- No external observability vendor is integrated.
- No real AMP tracing is active unless the user configures CrewAI/AMP separately and enables tracing.
- Token and cost metrics are unavailable in deterministic mode.
- Live LLM output is stored as a safe result envelope and is not yet parsed into the local `ReviewPackage` schema.
- No authentication, database persistence, deployment, CRM, ticketing, or automatic customer-facing response has been added.
