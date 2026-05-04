from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field

from customer_support_crew.flow import CustomerSupportFlow
from customer_support_crew.models import ReviewPackage, SupportTicket


try:
    from crewai.flow.flow import Flow, listen, start
    CREWAI_FLOW_AVAILABLE = True
except ImportError:  # pragma: no cover - CrewAI is optional for the local deterministic MVP.
    Flow = object  # type: ignore[assignment]
    listen = start = None  # type: ignore[assignment]
    CREWAI_FLOW_AVAILABLE = False


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = PROJECT_ROOT / "data" / "fixtures" / "sample_ticket.json"
DEFAULT_KNOWLEDGE_BASE = PROJECT_ROOT / "knowledge_base" / "support_kb.md"


class CustomerSupportFlowState(BaseModel):
    ticket: SupportTicket | None = None
    review_package: ReviewPackage | None = None
    status: str = "idle"
    current_step: str = "not_started"
    warnings: list[str] = Field(default_factory=list)


class _DeterministicFlowSteps:
    def _init_local_state(
        self,
        fixture_path: str | Path = DEFAULT_FIXTURE,
        knowledge_base_path: str | Path = DEFAULT_KNOWLEDGE_BASE,
    ) -> None:
        self.fixture_path = Path(fixture_path)
        self.local_flow = CustomerSupportFlow(knowledge_base_path)
        self.state = CustomerSupportFlowState()

    def load_ticket(self) -> SupportTicket:
        self.state.status = "running"
        self.state.current_step = "load_ticket"
        self.state.ticket = self.local_flow.load_ticket(self.fixture_path)
        return self.state.ticket

    def run_deterministic_pipeline(self, ticket: SupportTicket) -> ReviewPackage:
        self.state.current_step = "assemble_review_package"
        self.state.review_package = self.local_flow.run(ticket)
        self.state.status = "done"
        return self.state.review_package


if CREWAI_FLOW_AVAILABLE:

    class CustomerSupportCrewFlow(Flow):  # type: ignore[misc]
        """Real CrewAI Flow using inherited Flow.kickoff()."""

        def __init__(
            self,
            fixture_path: str | Path = DEFAULT_FIXTURE,
            knowledge_base_path: str | Path = DEFAULT_KNOWLEDGE_BASE,
        ) -> None:
            super().__init__()
            self.fixture_path = Path(fixture_path)
            self.local_flow = CustomerSupportFlow(knowledge_base_path)
            self.state = CustomerSupportFlowState()

        @start()
        def load_ticket(self) -> SupportTicket:
            self.state.status = "running"
            self.state.current_step = "load_ticket"
            self.state.ticket = self.local_flow.load_ticket(self.fixture_path)
            return self.state.ticket

        @listen(load_ticket)
        def run_deterministic_pipeline(self, ticket: SupportTicket) -> ReviewPackage:
            self.state.current_step = "assemble_review_package"
            self.state.review_package = self.local_flow.run(ticket)
            self.state.status = "done"
            return self.state.review_package

else:
    CustomerSupportCrewFlow = None  # type: ignore[assignment]


class CustomerSupportCrewFlowFallback(_DeterministicFlowSteps):
    """Explicit fallback runner used only when CrewAI Flow is not installed."""

    runtime_mode = "fallback"

    def __init__(
        self,
        fixture_path: str | Path = DEFAULT_FIXTURE,
        knowledge_base_path: str | Path = DEFAULT_KNOWLEDGE_BASE,
    ) -> None:
        self._init_local_state(fixture_path, knowledge_base_path)

    def kickoff_fallback(self) -> ReviewPackage:
        ticket = self.load_ticket()
        return self.run_deterministic_pipeline(ticket)


def run_customer_support_flow() -> ReviewPackage:
    if CREWAI_FLOW_AVAILABLE and CustomerSupportCrewFlow is not None:
        return CustomerSupportCrewFlow().kickoff()

    return CustomerSupportCrewFlowFallback().kickoff_fallback()


def main() -> None:
    review_package = run_customer_support_flow()
    if CREWAI_FLOW_AVAILABLE:
        print("CrewAI Flow runtime detected; executed inherited Flow.kickoff().")
    else:
        print("CrewAI is not installed; executed CustomerSupportCrewFlowFallback.kickoff_fallback().")
    print(json.dumps(review_package.model_dump(mode="json"), indent=2))


if __name__ == "__main__":
    main()
