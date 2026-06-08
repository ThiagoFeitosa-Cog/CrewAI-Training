from __future__ import annotations

import os
import inspect
from pathlib import Path

from customer_support_crew.tools.crewai_local_knowledge_tool import CrewAILocalKnowledgeTool


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CREWAI_RUNTIME_HOME = PROJECT_ROOT / ".crewai-home"

os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("CREWAI_DISABLE_TRACKING", "true")
os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ["HOME"] = str(CREWAI_RUNTIME_HOME)

try:
    from crewai import Agent, Crew, Process, Task
    from crewai.project import CrewBase, agent, crew, task
    CREWAI_AVAILABLE = True
except ImportError:  # pragma: no cover - CrewAI is optional for the local deterministic MVP.
    Agent = Crew = Process = Task = None
    CREWAI_AVAILABLE = False

    def CrewBase(cls):  # type: ignore[no-redef]
        return cls

    def agent(func):  # type: ignore[no-redef]
        return func

    def task(func):  # type: ignore[no-redef]
        return func

    def crew(func):  # type: ignore[no-redef]
        return func


CONFIG_DIR = Path(__file__).parent / "config"


def _tracing_enabled() -> bool:
    return os.getenv("CREWAI_TRACING_ENABLED", "false").lower() == "true"


def _supports_kwarg(callable_obj, kwarg: str) -> bool:
    try:
        signature = inspect.signature(callable_obj)
    except (TypeError, ValueError):
        return False
    return kwarg in signature.parameters or any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD for parameter in signature.parameters.values()
    )


@CrewBase
class CustomerSupportCrew:
    """CrewAI crew definition for the MVP specialist agents."""

    agents_config = str(CONFIG_DIR / "agents.yaml")
    tasks_config = str(CONFIG_DIR / "tasks.yaml")

    def _agent_kwargs(self, agent_name: str) -> dict:
        kwargs = {"config": self.agents_config[agent_name], "verbose": True}
        model = os.getenv("MODEL")
        if model:
            kwargs["llm"] = model
        return kwargs

    @agent
    def classification_agent(self):
        return Agent(**self._agent_kwargs("classification_agent"))

    @agent
    def sentiment_analysis_agent(self):
        return Agent(**self._agent_kwargs("sentiment_analysis_agent"))

    @agent
    def knowledge_retrieval_agent(self):
        kwargs = self._agent_kwargs("knowledge_retrieval_agent")
        return Agent(
            **kwargs,
            tools=[CrewAILocalKnowledgeTool()],
        )

    @agent
    def solution_generation_agent(self):
        return Agent(**self._agent_kwargs("solution_generation_agent"))

    @agent
    def routing_agent(self):
        return Agent(**self._agent_kwargs("routing_agent"))

    @agent
    def escalation_agent(self):
        return Agent(**self._agent_kwargs("escalation_agent"))

    @task
    def classify_ticket_task(self):
        return Task(config=self.tasks_config["classify_ticket_task"])

    @task
    def analyze_sentiment_task(self):
        return Task(config=self.tasks_config["analyze_sentiment_task"])

    @task
    def retrieve_knowledge_task(self):
        return Task(config=self.tasks_config["retrieve_knowledge_task"])

    @task
    def generate_draft_response_task(self):
        return Task(config=self.tasks_config["generate_draft_response_task"])

    @task
    def recommend_routing_task(self):
        return Task(config=self.tasks_config["recommend_routing_task"])

    @task
    def recommend_escalation_task(self):
        return Task(config=self.tasks_config["recommend_escalation_task"])

    @task
    def assemble_review_package_task(self):
        return Task(config=self.tasks_config["assemble_review_package_task"])

    @crew
    def crew(self):
        if Crew is None:
            raise RuntimeError("CrewAI is not installed. Install the optional 'crewai' dependency to run this crew.")
        crew_kwargs = {
            "agents": self.agents,
            "tasks": self.tasks,
            "process": Process.sequential,
            "verbose": True,
            "memory": False,
            "output_log_file": "logs/crew.log",
        }
        if _tracing_enabled() and _supports_kwarg(Crew, "tracing"):
            crew_kwargs["tracing"] = True
        return Crew(**crew_kwargs)
