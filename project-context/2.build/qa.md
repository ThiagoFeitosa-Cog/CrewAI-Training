# QA Validation Notes

## Audit

- Persona: QA Engineer (`.cursor/agents/qa-eng.md`)
- Date: 2026-05-04
- Scope: Backend deterministic MVP prototype validation
- Source artifacts:
  - `project-context/1.define/prd.md`
  - `project-context/2.build/sad.md`
  - `project-context/2.build/backend.md`

## Commands Executed

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
PYTHONPATH=src .venv/bin/python -m unittest discover tests
PYTHONPATH=src .venv/bin/python -m compileall src/customer_support_crew tests
```

## Results

- Prototype runs successfully with `data/fixtures/sample_ticket.json`.
- Output contains a complete `ReviewPackage`.
- `human_approval_required` is `true`.
- `ready_for_human_review` is `true`.
- Sample ticket classification: `technical_support`.
- Sample ticket routing: `technical_support`.
- Sample ticket escalation: `true`, severity `P1`.
- Unit tests: 4 passed.
- Compile check: passed.

## Scope Validation

No out-of-scope behavior was found:

- No CRM or ticketing integration.
- No database persistence.
- No authentication.
- No frontend implementation.
- No deployment implementation.
- No automatic customer-facing response.
- No `Process.hierarchical`.
- No `Process.consensual`.

## Verdict

PASS

## Non-Blocking Follow-Up

- Add 10 to 20 labeled evaluation tickets in a later QA/evaluation step.
- Add tests for additional categories such as billing, onboarding, general support, and missing-knowledge paths.

---

## Build Backend with CrewAI Crew Validation

### Scope

- Persona: QA Engineer (`.cursor/agents/qa-eng.md`)
- Date: 2026-05-04
- Scope: CrewAI-aligned backend deliverable validation
- Source artifacts:
  - `project-context/2.build/sad.md`
  - `project-context/2.build/backend.md`

### Commands Executed

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
PYTHONPATH=src .venv/bin/python -m unittest discover tests
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_flow
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_main
```

### Results

- Deterministic backend command ran successfully and returned a complete `ReviewPackage`.
- Unit tests passed: 8 tests.
- CrewAI Flow deterministic command ran successfully without `OPENAI_API_KEY`.
- Current environment does not have CrewAI installed, so the command used the clearly labeled `CustomerSupportCrewFlowFallback.kickoff_fallback()` path.
- Future LLM CrewAI entrypoint exited cleanly without `OPENAI_API_KEY` and printed setup guidance.
- CrewAI runtime is optional for the default path.
- `.env.example` documents `OPENAI_API_KEY=`; `.env` was not modified.

### CrewAI Concept Validation

- YAML runtime agents are present in `src/customer_support_crew/config/agents.yaml`.
- YAML runtime tasks are present in `src/customer_support_crew/config/tasks.yaml`.
- `src/customer_support_crew/crew.py` demonstrates `CrewBase`, `@agent`, `@task`, `@crew`, `Agent`, `Task`, `Crew`, and `Process.sequential`.
- `src/customer_support_crew/crewai_flow.py` demonstrates real `Flow`, `@start`, `@listen`, `self.state`, and inherited `Flow.kickoff()` when CrewAI is installed.
- Without CrewAI installed, `src/customer_support_crew/crewai_flow.py` uses the explicit fallback runner and identifies the fallback in CLI output.
- `src/customer_support_crew/crewai_main.py` prepares a future `crew.kickoff(inputs={...})` path.

### Scope Validation

No out-of-scope behavior was found:

- No frontend/backend integration.
- No CRM or ticketing integration.
- No database persistence.
- No authentication.
- No deployment implementation.
- No automatic customer-facing response.
- No `Process.hierarchical`.
- No `Process.consensual`.
- No modification to `.cursor/agents/`.

### Verdict

PASS

### Non-Blocking Follow-Up

- Install optional CrewAI dependency and validate the LLM-backed path after an API key is intentionally configured.
- Add LLM output parsing/validation hardening before relying on live CrewAI responses.

---

## Live LLM CrewAI Runtime Validation

### Scope

- Persona: QA Engineer (`.cursor/agents/qa-eng.md`)
- Date: 2026-06-07
- Scope: Live LLM-backed CrewAI runtime validation with configured OpenAI-compatible Microsoft Foundry provider

### Environment Safety

- `.env` exists and is ignored by Git.
- `MODEL`, `OPENAI_API_BASE`, and `OPENAI_API_KEY` are present.
- `OPENAI_API_KEY` was not printed.
- `.env` was not modified.

### Commands Executed

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_flow
PYTHONPATH=src .venv/bin/python -m unittest discover tests
PYTHONPATH=src .venv/bin/python -m compileall src/customer_support_crew tests
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_main
crewai run
```

### Results

- Deterministic backend command returned a complete `ReviewPackage`.
- CrewAI Flow command ran through real inherited `Flow.kickoff()` with deterministic local logic.
- Unit tests passed: 11 tests.
- Compile check passed.
- Live `customer_support_crew.crewai_main` completed all sequential CrewAI tasks through the configured provider.
- `crewai run` reached `run_crew` and completed all sequential CrewAI tasks.
- Live output was ReviewPackage-like and preserved `human_approval_required: true` and `ready_for_human_review: true`.
- No automatic customer-facing response was sent.

### Fixes Validated

- CrewAI runtime storage is redirected to ignored local `.crewai-home/`.
- `OPENAI_API_BASE` is mapped to `OPENAI_BASE_URL` at runtime.
- `MODEL` is passed explicitly to runtime CrewAI agents.
- Runtime task descriptions now include the actual fixture fields.
- Local knowledge tool accepts flexible query input and returned approved local source references.

### Scope Validation

No out-of-scope behavior was found:

- No frontend/backend integration.
- No CRM or ticketing integration.
- No database persistence.
- No authentication.
- No deployment implementation.
- No automatic customer-facing response.
- No `Process.hierarchical`.
- No `Process.consensual`.
- No modification to `.cursor/agents/`.

### Verdict

PASS WITH NON-BLOCKING CONCERNS

### Non-Blocking Follow-Up

- Live LLM outputs are JSON-compatible but not yet normalized into exact Pydantic enum/value shapes; add output normalization before treating live results as strict application data.

---

## Frontend Module Validation

### Scope

- Persona: QA Engineer (`.cursor/agents/qa-eng.md`)
- Date: 2026-05-04
- Scope: Build Frontend module validation
- Source artifacts:
  - `frontend-funcional-spec.md`
  - `project-context/2.build/frontend.md`
  - `project-context/1.define/prd.md`
  - `project-context/2.build/sad.md`

### Commands Executed

```bash
cd frontend
npm install
npm run build
npm test
```

### Results

- Frontend dependencies installed successfully.
- Production build passed.
- Frontend workflow tests passed: 2 tests.
- Stubbed workflow transitions from `idle` to `running` to `done`.
- Reset returns the workflow to `idle`.
- Review package renders classification, sentiment, retrieved sources, draft response, routing, escalation, warnings, and human approval requirement.

### Scope Validation

No out-of-scope behavior was found:

- No real backend or API integration.
- No authentication.
- No database persistence.
- No deployment implementation.
- No streaming, tool-call trace, cost dashboard, pause, cancel, or retry-diff.
- No automatic customer-facing response.

### Verdict

PASS

### Non-Blocking Follow-Up

- Connect `frontend/src/services/stubCrewService.ts` to the backend during the Integration epic.
- Add broader browser/device accessibility checks in a later QA pass.

---

## Week 4 Full-Stack Integration Validation

### Scope

- Persona: QA Engineer (`.cursor/agents/qa-eng.md`)
- Date: 2026-06-08
- Scope: FastAPI + React local full-stack integration

### Commands Executed

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_flow
PYTHONPATH=src .venv/bin/python -m unittest discover tests
PYTHONPATH=src .venv/bin/python -m compileall src/customer_support_crew tests
npm run build
npm test
PYTHONPATH=src .venv/bin/uvicorn customer_support_crew.api:app --host 127.0.0.1 --port 8000
curl -s http://127.0.0.1:8000/health
curl -s -X POST http://127.0.0.1:8000/api/runs ...
curl -s http://127.0.0.1:8000/api/runs/{run_id}
curl -s -X POST http://127.0.0.1:8000/api/runs/{run_id}/review ...
curl -s http://127.0.0.1:8000/api/runs
```

### Backend Results

- Deterministic CLI backend returned a complete `ReviewPackage`.
- FastAPI server started on `http://127.0.0.1:8000`.
- `GET /health` returned status `ok` and runtime mode `deterministic`.
- `POST /api/runs` created a run, processed the ticket, returned a ReviewPackage, and stored local JSON.
- `GET /api/runs/{run_id}` returned the persisted run record.
- `POST /api/runs/{run_id}/review` persisted human review state.
- `GET /api/runs` returned run history.

### Frontend Results

- Production build passed.
- Frontend tests passed: 3 tests.
- Frontend service now calls the FastAPI backend through `apiCrewService.ts`.
- UI renders ReviewPackage, Agent Activity, Human Review controls, and Run History.
- Human review decision is submitted through the backend API.

### Full-Stack Results

- Backend API and Vite frontend were started locally.
- Frontend dev server responded at `http://127.0.0.1:5173/`.
- Backend API responded at `http://127.0.0.1:8000/`.
- Payload shapes were validated by frontend tests and backend `curl` checks.

### Scope Validation

No out-of-scope behavior was found:

- No CRM or ticketing integration.
- No database persistence.
- No authentication.
- No deployment implementation.
- No real notification integration.
- No automatic customer-facing response.
- No `Process.hierarchical`.
- No `Process.consensual`.
- No `.env` changes.
- No `.cursor/agents/` changes.

### Verdict

PASS

### Non-Blocking Follow-Up

- Add browser automation when available for visual click-through validation.
- Add exact Pydantic normalization for optional live LLM output before using live mode as the default API runtime.
