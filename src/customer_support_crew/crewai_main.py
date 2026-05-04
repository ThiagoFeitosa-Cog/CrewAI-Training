from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = PROJECT_ROOT / "data" / "fixtures" / "sample_ticket.json"


def _load_crew_inputs(fixture_path: Path = DEFAULT_FIXTURE) -> dict[str, Any]:
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    return {
        "ticket_id": payload["ticket_id"],
        "customer_id": payload["customer_id"],
        "subject": payload["subject"],
        "body": payload["body"],
        "channel": payload.get("channel", "ticket"),
        "product_area": payload.get("product_area"),
        "customer_metadata": payload["customer_metadata"],
    }


def main() -> int:
    if not os.getenv("OPENAI_API_KEY"):
        print(
            "LLM CrewAI mode was not started because OPENAI_API_KEY is not set.\n"
            "The free deterministic backend still works with:\n"
            "  PYTHONPATH=src .venv/bin/python -m customer_support_crew.main\n"
            "The deterministic CrewAI Flow runner works with:\n"
            "  PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_flow\n"
            "To try LLM CrewAI mode later, install the optional dependency and set:\n"
            "  uv pip install -e '.[crewai]'\n"
            "  export OPENAI_API_KEY=your_key_here\n"
        )
        return 0

    try:
        from customer_support_crew.crew import CREWAI_AVAILABLE, CustomerSupportCrew
    except ImportError as exc:
        print(f"Unable to import the CrewAI crew module: {exc}")
        return 1

    if not CREWAI_AVAILABLE:
        print(
            "CrewAI is not installed, so LLM CrewAI mode cannot run.\n"
            "Install the optional dependency with:\n"
            "  uv pip install -e '.[crewai]'\n"
        )
        return 1

    inputs = _load_crew_inputs()
    result = CustomerSupportCrew().crew().kickoff(inputs=inputs)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
