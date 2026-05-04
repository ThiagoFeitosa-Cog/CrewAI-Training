from __future__ import annotations

import json
from pathlib import Path

from customer_support_crew.flow import CustomerSupportFlow


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = PROJECT_ROOT / "data" / "fixtures" / "sample_ticket.json"
DEFAULT_KNOWLEDGE_BASE = PROJECT_ROOT / "knowledge_base" / "support_kb.md"


def main() -> None:
    flow = CustomerSupportFlow(DEFAULT_KNOWLEDGE_BASE)
    ticket = flow.load_ticket(DEFAULT_FIXTURE)
    review_package = flow.run(ticket)
    print(json.dumps(review_package.model_dump(mode="json"), indent=2))


if __name__ == "__main__":
    main()

