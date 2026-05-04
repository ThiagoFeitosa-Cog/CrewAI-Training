from __future__ import annotations

from pathlib import Path


try:
    from crewai import Agent, Crew, Process, Task
    from crewai.project import CrewBase, agent, crew, task
except ImportError:  # pragma: no cover - CrewAI is optional for the local deterministic MVP.
    Agent = Crew = Process = Task = None

    def CrewBase(cls):  # type: ignore[no-redef]
        return cls

    def agent(func):  # type: ignore[no-redef]
        return func

    def task(func):  # type: ignore[no-redef]
        return func

    def crew(func):  # type: ignore[no-redef]
        return func


CONFIG_DIR = Path(__file__).parent / "config"


@CrewBase
class CustomerSupportCrew:
    """CrewAI crew definition for the MVP specialist agents."""

    agents_config = str(CONFIG_DIR / "agents.yaml")
    tasks_config = str(CONFIG_DIR / "tasks.yaml")

    @agent
    def classification_agent(self):
        return Agent(config=self.agents_config["classification_agent"], verbose=True)

    @agent
    def sentiment_analysis_agent(self):
        return Agent(config=self.agents_config["sentiment_analysis_agent"], verbose=True)

    @agent
    def knowledge_retrieval_agent(self):
        return Agent(config=self.agents_config["knowledge_retrieval_agent"], verbose=True)

    @agent
    def solution_generation_agent(self):
        return Agent(config=self.agents_config["solution_generation_agent"], verbose=True)

    @agent
    def routing_agent(self):
        return Agent(config=self.agents_config["routing_agent"], verbose=True)

    @agent
    def escalation_agent(self):
        return Agent(config=self.agents_config["escalation_agent"], verbose=True)

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
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            memory=False,
            output_log_file="logs/crew.log",
        )

