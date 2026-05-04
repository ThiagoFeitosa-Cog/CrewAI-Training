# AAMAD CrewAI Capstone

## Backend Prototype

This repository contains the Multi-Agent Customer Support Crew capstone MVP scaffold.

Run the deterministic local backend prototype:

```bash
PYTHONPATH=src .venv/bin/python -m customer_support_crew.main
```

This assumes a virtual environment exists at `.venv`.

Run the lightweight backend validation tests:

```bash
PYTHONPATH=src .venv/bin/python -m unittest discover tests
```

The prototype loads one sample support ticket, runs the local Flow-style pipeline, searches the local knowledge base, and prints a human review package as JSON.

Current local assets:

- Fixture: `data/fixtures/sample_ticket.json`
- Knowledge base: `knowledge_base/support_kb.md`
- Pydantic models: `src/customer_support_crew/models.py`
- Flow prototype: `src/customer_support_crew/flow.py`
- CrewAI-style config: `src/customer_support_crew/config/agents.yaml`, `src/customer_support_crew/config/tasks.yaml`

Current limitations:

- Local fixture execution only.
- Deterministic keyword-based MVP logic for the runnable prototype.
- No production ticketing or CRM integrations.
- No frontend, authentication, database persistence, deployment, or autonomous customer response.
- CrewAI runtime execution is scaffolded but not required for the local deterministic prototype.
