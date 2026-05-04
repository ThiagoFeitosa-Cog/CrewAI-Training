from __future__ import annotations

from pathlib import Path

from customer_support_crew.models import RetrievedSource, RetrievalResult


class LocalKnowledgeBaseTool:
    """Deterministic keyword search over a local markdown or text knowledge base."""

    def __init__(self, knowledge_base_path: str | Path) -> None:
        self.knowledge_base_path = Path(knowledge_base_path)

    def search(self, query: str, limit: int = 3) -> RetrievalResult:
        if not self.knowledge_base_path.exists():
            return RetrievalResult(
                sources=[],
                retrieval_confidence=0.0,
                missing_knowledge=True,
                rationale=f"Knowledge base not found: {self.knowledge_base_path}",
            )

        text = self.knowledge_base_path.read_text(encoding="utf-8")
        sections = self._split_sections(text)
        query_terms = self._terms(query)

        ranked: list[tuple[float, str, str]] = []
        for title, body in sections:
            section_terms = self._terms(f"{title} {body}")
            if not section_terms:
                continue
            matches = query_terms.intersection(section_terms)
            score = min(1.0, len(matches) / 5)
            if score > 0:
                ranked.append((score, title, body))

        ranked.sort(key=lambda item: item[0], reverse=True)
        sources = [
            RetrievedSource(
                source_id=self._source_id(title),
                title=title,
                snippet=self._snippet(body),
                relevance_score=score,
            )
            for score, title, body in ranked[:limit]
        ]

        confidence = sources[0].relevance_score if sources else 0.0
        return RetrievalResult(
            sources=sources,
            retrieval_confidence=confidence,
            missing_knowledge=not sources,
            rationale="Matched local knowledge base sections by keyword overlap."
            if sources
            else "No local knowledge base section matched the ticket context.",
        )

    def _split_sections(self, text: str) -> list[tuple[str, str]]:
        sections: list[tuple[str, str]] = []
        current_title = "General Knowledge"
        current_lines: list[str] = []

        for line in text.splitlines():
            if line.startswith("#"):
                if current_lines:
                    sections.append((current_title, "\n".join(current_lines).strip()))
                current_title = line.lstrip("#").strip() or "Untitled"
                current_lines = []
            else:
                current_lines.append(line)

        if current_lines:
            sections.append((current_title, "\n".join(current_lines).strip()))
        return sections

    def _terms(self, text: str) -> set[str]:
        normalized = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
        stopwords = {"the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "is", "we", "it"}
        return {term for term in normalized.split() if len(term) > 2 and term not in stopwords}

    def _source_id(self, title: str) -> str:
        normalized = "".join(ch.lower() if ch.isalnum() else " " for ch in title)
        slug = "-".join(term for term in normalized.split() if len(term) > 1)
        return slug or "general-knowledge"

    def _snippet(self, text: str, max_length: int = 320) -> str:
        compact = " ".join(text.split())
        return compact[:max_length].rstrip()
