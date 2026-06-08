# Backend Build Notes

## Audit

- Persona: Backend Developer (`.cursor/agents/backend-eng.md`)
- Runtime: CrewAI adapter, Flow + Crew hybrid architecture
- Date: 2026-05-04
- Source artifacts:
  - `project-context/1.define/mrd.md`
  - `project-context/1.define/prd.md`
  - `project-context/2.build/sad.md`

## Implementation Summary

Created the initial backend scaffold and expanded it for the Build Backend with CrewAI Crew module.

The chosen structure is a `src/customer_support_crew/` Python package because the repository did not already define a package layout in `pyproject.toml`. This keeps backend code isolated from AAMAD documentation while supporting CrewAI conventions, Flow orchestration, local tools, fixture execution, and structured Pydantic models.

The backend now supports two explicit paths:

1. Local deterministic mode: default, free, no `OPENAI_API_KEY`, no CrewAI runtime dependency required.
2. LLM-ready CrewAI mode: prepared for a future `OPENAI_API_KEY` run, with clear failure messaging when the key or optional CrewAI dependency is missing.

## MVP Scope Kept

- One support ticket at a time.
- English-only local fixture.
- Mock customer metadata.
- Local markdown knowledge base.
- Human review package as final output.
- No autonomous customer-facing response.
- No CRM or ticketing integration.
- No authentication, database persistence, deployment, or frontend implementation.
- No hierarchical or consensual CrewAI process.

## Files

- `pyproject.toml`
- `.env.example`
- `src/customer_support_crew/models.py`
- `src/customer_support_crew/flow.py`
- `src/customer_support_crew/crew.py`
- `src/customer_support_crew/crewai_flow.py`
- `src/customer_support_crew/crewai_main.py`
- `src/customer_support_crew/main.py`
- `src/customer_support_crew/config/agents.yaml`
- `src/customer_support_crew/config/tasks.yaml`
- `src/customer_support_crew/tools/local_knowledge_tool.py`
- `src/customer_support_crew/tools/crewai_local_knowledge_tool.py`
- `data/fixtures/sample_ticket.json`
- `knowledge_base/support_kb.md`
- `logs/.gitkeep`
- `tests/test_flow.py`
- `tests/test_crewai_paths.py`

## How to Run

Run the deterministic local MVP prototype:

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
```

This assumes a virtual environment exists at `.venv`. The command loads `data/fixtures/sample_ticket.json`, searches `knowledge_base/support_kb.md`, runs the deterministic local Flow prototype, and prints a `ReviewPackage` JSON object. CrewAI runtime execution is scaffolded but optional for now; no customer-facing response is sent automatically.

Run the deterministic CrewAI Flow path:

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_flow
```

This command uses real CrewAI `Flow.kickoff()` with `@start`, `@listen`, and `self.state` when CrewAI is installed. If CrewAI is not installed, it uses `CustomerSupportCrewFlowFallback.kickoff_fallback()` and prints that fallback status clearly. Both modes reuse deterministic local business logic and do not require `OPENAI_API_KEY`.

Run the future LLM-ready CrewAI entrypoint:

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_main
```

The CrewAI CLI uses the same guarded entrypoint through the `run_crew` project script:

```bash
crewai run
```

Without `OPENAI_API_KEY`, this entrypoint exits with setup guidance. It does not silently fall back to deterministic logic or pretend to run LLM-backed agents.

## Optional LLM Provider Configuration

For the course/project Microsoft Foundry or another OpenAI-compatible endpoint, create a local `.env` with:

```bash
MODEL=
OPENAI_API_BASE=
OPENAI_API_KEY=
```

- `MODEL` is the provider/model identifier.
- `OPENAI_API_BASE` is the OpenAI-compatible endpoint base URL.
- `OPENAI_API_KEY` is the secret provider key.
- Do not commit `.env`.
- No key is required for deterministic mode.
- `crewai run` uses the guarded LLM entrypoint and can attempt the LLM-backed CrewAI path when provider variables are configured.

To prepare for a later LLM-backed run:

```bash
uv pip install -e '.[crewai]'
export MODEL=<provider_or_deployment_model_identifier>
export OPENAI_API_BASE=<openai_compatible_endpoint_base_url>
export OPENAI_API_KEY=<secret_key>
PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_main
```

Run lightweight backend validation tests:

```bash
PYTHONPATH=src .venv/bin/python -m unittest discover tests
```

## CrewAI Backend Notes

- Runtime agents are defined in `src/customer_support_crew/config/agents.yaml`.
- Sequential runtime tasks are defined in `src/customer_support_crew/config/tasks.yaml`.
- `src/customer_support_crew/crew.py` demonstrates `CrewBase`, `@agent`, `@task`, `@crew`, `Agent`, `Task`, `Crew`, and `Process.sequential`.
- The knowledge retrieval agent is prepared with a CrewAI-compatible local knowledge tool wrapper.
- The LLM-ready entrypoint calls `crew.kickoff(inputs={...})` only when `OPENAI_API_KEY` is configured and CrewAI is installed.
- Live LLM execution has been validated against the configured OpenAI-compatible Microsoft Foundry provider.
- The live path maps `OPENAI_API_BASE` to `OPENAI_BASE_URL` at runtime, passes `MODEL` explicitly to CrewAI agents, and writes CrewAI runtime storage under ignored local `.crewai-home/`.
- The expected LLM path output is ReviewPackage-like and JSON-compatible by task contract, but exact Pydantic output validation remains a future integration hardening step.

## Flow Notes

- `src/customer_support_crew/crewai_flow.py` models the Build-stage Flow + Crew hybrid decision without requiring a paid API key.
- When CrewAI is installed, `CustomerSupportCrewFlow` relies on inherited `Flow.kickoff()` and does not override it.
- When CrewAI is not installed, `CustomerSupportCrewFlowFallback` provides an explicit local fallback and does not claim to be the real CrewAI runtime.
- `@start()` loads the local support ticket fixture.
- `@listen(...)` executes the deterministic local workflow and assembles the `ReviewPackage`.
- The final `ReviewPackage` remains the human-in-the-loop checkpoint.

## Live LLM Validation Notes

- `PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_main` reached the configured provider and completed all sequential CrewAI tasks.
- `crewai run` reached the `run_crew` entrypoint and completed the same live LLM-backed path.
- The local knowledge tool was invoked by the knowledge retrieval agent and returned approved local source references.
- The final output preserved the human-in-the-loop checkpoint with `human_approval_required: true` and `ready_for_human_review: true`.
- No customer-facing response is sent automatically.
- `.env` was not modified or printed.

## Known Follow-Up Work

- Expand evaluation fixtures to cover 10 to 20 labeled tickets.
- Add stricter LLM output normalization so live outputs match the Pydantic enum/value shapes exactly.
- Add human review UI or endpoint in a later frontend/backend step.
