# AGENTS.md

## Project

Multi-Agent Customer Support Crew

## Current Phase

AAMAD Phase 2: Build. The current focus is publishing and using the Build-stage Solution Architecture Document before implementation begins.

## Primary Source Artifacts

- `project-context/1.define/mrd.md`
- `project-context/1.define/prd.md`
- `project-context/1.define/sad.md`
- `project-context/2.build/sad.md`

## Expected Workflow

Codex and Cursor should use the MRD, PRD, and SAD as primary context before making project decisions. Work should follow the AAMAD sequence: Define, Build, Deliver.

No application code should be generated unless the current task explicitly asks for implementation. Do not scaffold CrewAI app files, agents, tasks, or source folders unless requested.

## AAMAD Personas in Codex

Cursor-style AAMAD personas live in `.cursor/agents/`. In Codex, invoke a persona by asking Codex to read the corresponding file and act according to that persona.

Example:

```text
Read .cursor/agents/system-arch.md and act as the System Architect persona.
```

The System Architect persona is available at `.cursor/agents/system-arch.md`.

## Tooling Note

This repository is maintained with VS Code and Codex CLI, while retaining AAMAD-compatible `.cursor/` folders for course alignment.
