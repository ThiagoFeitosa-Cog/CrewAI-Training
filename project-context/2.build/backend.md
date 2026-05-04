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

Created the initial backend scaffold for the Multi-Agent Customer Support Crew MVP.

The chosen structure is a `src/customer_support_crew/` Python package because the repository did not already define a package layout in `pyproject.toml`. This keeps backend code isolated from AAMAD documentation while supporting CrewAI conventions, Flow orchestration, local tools, fixture execution, and structured Pydantic models.

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
- `src/customer_support_crew/models.py`
- `src/customer_support_crew/flow.py`
- `src/customer_support_crew/crew.py`
- `src/customer_support_crew/main.py`
- `src/customer_support_crew/config/agents.yaml`
- `src/customer_support_crew/config/tasks.yaml`
- `src/customer_support_crew/tools/local_knowledge_tool.py`
- `data/fixtures/sample_ticket.json`
- `knowledge_base/support_kb.md`
- `logs/.gitkeep`

## How to Run

Run the deterministic local MVP prototype:

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
```

This assumes a virtual environment exists at `.venv`. The command loads `data/fixtures/sample_ticket.json`, searches `knowledge_base/support_kb.md`, runs the deterministic local Flow prototype, and prints a `ReviewPackage` JSON object. CrewAI runtime execution is scaffolded but optional for now; no customer-facing response is sent automatically.

Run lightweight backend validation tests:

```bash
PYTHONPATH=src .venv/bin/python -m unittest discover tests
```

## Known Follow-Up Work

- Install and validate optional CrewAI runtime dependency when the course reaches full Crew execution.
- Add evaluation fixtures for 10 to 20 labeled tickets.
- Expand evaluation fixtures to cover 10 to 20 labeled tickets.
- Add human review UI or endpoint in a later frontend/backend step.
