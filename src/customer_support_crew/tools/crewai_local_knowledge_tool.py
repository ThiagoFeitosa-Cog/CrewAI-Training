from __future__ import annotations

from pathlib import Path
from typing import Type

from pydantic import BaseModel, Field

from customer_support_crew.tools.local_knowledge_tool import LocalKnowledgeBaseTool


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_KNOWLEDGE_BASE = PROJECT_ROOT / "knowledge_base" / "support_kb.md"


class LocalKnowledgeSearchInput(BaseModel):
    query: str = Field(description="Ticket context or search terms for the local support knowledge base.")


try:
    from crewai.tools import BaseTool
except ImportError:  # pragma: no cover - CrewAI is optional for the deterministic MVP.

    class BaseTool:  # type: ignore[no-redef]
        name: str
        description: str
        args_schema: Type[BaseModel]

        def run(self, query: str) -> str:
            return self._run(query=query)


class CrewAILocalKnowledgeTool(BaseTool):
    name: str = "local_knowledge_search"
    description: str = "Search the approved local support knowledge base using deterministic keyword matching."
    args_schema: Type[BaseModel] = LocalKnowledgeSearchInput
    knowledge_base_path: str = str(DEFAULT_KNOWLEDGE_BASE)

    def _run(self, query: str) -> str:
        result = LocalKnowledgeBaseTool(self.knowledge_base_path).search(query)
        return result.model_dump_json()
