from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from customer_support_crew.models import (
    ClassificationResult,
    CustomerMetadata,
    DraftResponse,
    EscalationRecommendation,
    ReviewPackage,
    RoutingRecommendation,
    SentimentResult,
    SupportTicket,
)
from customer_support_crew.tools.local_knowledge_tool import LocalKnowledgeBaseTool


class CustomerSupportFlow:
    def __init__(self, knowledge_base_path: str | Path) -> None:
        self.knowledge_tool = LocalKnowledgeBaseTool(knowledge_base_path)

    def run(self, ticket: SupportTicket) -> ReviewPackage:
        classification = self._classify(ticket)
        sentiment = self._analyze_sentiment(ticket)
        retrieval = self.knowledge_tool.search(
            f"{ticket.subject} {ticket.body} {classification.category} {classification.intent}"
        )
        draft = self._draft_response(ticket, retrieval)
        routing = self._recommend_routing(classification, sentiment)
        escalation = self._recommend_escalation(ticket, classification, sentiment, retrieval)
        warnings = self._warnings(classification, sentiment, retrieval, draft, routing, escalation)

        return ReviewPackage(
            ticket=ticket,
            classification=classification,
            sentiment=sentiment,
            retrieval=retrieval,
            draft_response=draft,
            routing=routing,
            escalation=escalation,
            warnings=warnings,
        )

    def load_ticket(self, fixture_path: str | Path) -> SupportTicket:
        payload = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
        metadata = CustomerMetadata(**payload["customer_metadata"])
        return SupportTicket(
            ticket_id=payload["ticket_id"],
            customer_id=payload["customer_id"],
            subject=payload["subject"],
            body=payload["body"],
            channel=payload.get("channel", "ticket"),
            product_area=payload.get("product_area"),
            customer_metadata=metadata,
        )

    def _classify(self, ticket: SupportTicket) -> ClassificationResult:
        text = f"{ticket.subject} {ticket.body}".lower()
        if any(term in text for term in ["login", "error", "bug", "api", "sync", "broken", "failed"]):
            category = "technical_support"
            intent = "Resolve a technical product issue."
        elif any(term in text for term in ["invoice", "billing", "payment", "charge"]):
            category = "billing"
            intent = "Resolve a billing or subscription issue."
        elif any(term in text for term in ["onboarding", "setup", "implementation", "migration"]):
            category = "onboarding"
            intent = "Get help completing onboarding or setup."
        elif any(term in text for term in ["cancel", "churn", "switching", "leave"]):
            category = "cancellation_or_churn_risk"
            intent = "Address possible cancellation or churn risk."
        else:
            category = "general_support"
            intent = "Answer a general support request."

        confidence = 0.82 if category != "general_support" else 0.65
        return ClassificationResult(
            category=category,
            intent=intent,
            product_area=ticket.product_area,
            confidence=confidence,
            rationale="Keyword-based MVP classification using ticket subject and body.",
            needs_manual_review=confidence < 0.70,
        )

    def _analyze_sentiment(self, ticket: SupportTicket) -> SentimentResult:
        text = f"{ticket.subject} {ticket.body}".lower()
        risk_flags: list[str] = []
        sentiment_label = "neutral"
        urgency = "medium"
        confidence = 0.74

        if any(term in text for term in ["urgent", "asap", "blocked", "down", "cannot work"]):
            sentiment_label = "urgent"
            urgency = "high"
            risk_flags.append("urgent_language")
            confidence = 0.82
        if any(term in text for term in ["frustrated", "angry", "unacceptable", "again"]):
            sentiment_label = "frustrated"
            urgency = "high"
            risk_flags.append("frustration")
            confidence = max(confidence, 0.80)
        if any(term in text for term in ["cancel", "churn", "switching", "legal", "renewal"]):
            sentiment_label = "high_risk"
            urgency = "critical"
            risk_flags.append("churn_or_escalation_risk")
            confidence = 0.88

        return SentimentResult(
            sentiment_label=sentiment_label,
            urgency=urgency,
            risk_flags=risk_flags,
            confidence=confidence,
            rationale="Rule-based MVP sentiment assessment from urgency and risk keywords.",
        )

    def _draft_response(self, ticket: SupportTicket, retrieval: Any) -> DraftResponse:
        if retrieval.missing_knowledge:
            return DraftResponse(
                draft_text=(
                    f"Hi, thanks for contacting support. I reviewed your request about "
                    f"'{ticket.subject}', but I could not find a reliable approved knowledge source. "
                    "A support agent should review this manually before responding."
                ),
                source_ids=[],
                confidence=0.35,
                safety_notes=["No approved knowledge source found. Manual review required."],
                sendable_after_human_review=False,
            )

        source_ids = [source.source_id for source in retrieval.sources]
        source_titles = ", ".join(source.title for source in retrieval.sources)
        sendable = retrieval.retrieval_confidence >= 0.70
        safety_notes = ["Draft is for human review only. Do not send automatically."]
        if not sendable:
            safety_notes.append("Retrieval confidence is below the MVP threshold; verify sources manually.")
        return DraftResponse(
            draft_text=(
                f"Hi, thanks for reaching out. Based on our support guidance ({source_titles}), "
                "the next step is to review the relevant account or product details and follow the "
                "documented support path. A support agent should verify the context and personalize "
                "this response before sending it."
            ),
            source_ids=source_ids,
            confidence=min(0.85, retrieval.retrieval_confidence + 0.15),
            safety_notes=safety_notes,
            sendable_after_human_review=sendable,
        )

    def _recommend_routing(
        self, classification: ClassificationResult, sentiment: SentimentResult
    ) -> RoutingRecommendation:
        mapping = {
            "billing": "billing",
            "technical_support": "technical_support",
            "bug_report": "technical_support",
            "onboarding": "onboarding",
            "account_management": "customer_success",
            "cancellation_or_churn_risk": "customer_success",
            "feature_request": "general_support",
            "product_question": "general_support",
            "general_support": "general_support",
        }
        queue = mapping[classification.category]
        manual_review = classification.needs_manual_review or sentiment.sentiment_label == "high_risk"
        return RoutingRecommendation(
            queue=queue,
            confidence=min(classification.confidence, 0.86),
            rationale="Mapped classification category to MVP routing queues.",
            manual_review_required=manual_review,
        )

    def _recommend_escalation(
        self, ticket: SupportTicket, classification: ClassificationResult, sentiment: SentimentResult, retrieval: Any
    ) -> EscalationRecommendation:
        if (
            sentiment.urgency == "critical"
            or classification.category == "cancellation_or_churn_risk"
            or ticket.customer_metadata.risk_level == "high"
        ):
            return EscalationRecommendation(
                escalate=True,
                severity="P1",
                target="customer_success_manager",
                reason="High-risk sentiment or churn-related classification requires customer success review.",
                confidence=0.86,
            )
        if retrieval.missing_knowledge or classification.needs_manual_review:
            return EscalationRecommendation(
                escalate=True,
                severity="manual_review",
                target="support_team_lead",
                reason="Low confidence or missing approved knowledge requires manual review.",
                confidence=0.78,
            )
        return EscalationRecommendation(
            escalate=False,
            severity="P3",
            target=None,
            reason="No high-risk sentiment, missing knowledge, or low-confidence signal detected.",
            confidence=0.75,
        )

    def _warnings(
        self,
        classification: ClassificationResult,
        sentiment: SentimentResult,
        retrieval: Any,
        draft: DraftResponse,
        routing: RoutingRecommendation,
        escalation: EscalationRecommendation,
    ) -> list[str]:
        warnings: list[str] = ["Human approval is required before sending any response."]
        if classification.needs_manual_review:
            warnings.append("Classification confidence is below the MVP threshold.")
        if retrieval.missing_knowledge:
            warnings.append("No approved knowledge source was found.")
        elif retrieval.retrieval_confidence < 0.70:
            warnings.append("Retrieval confidence is below the MVP threshold.")
        if not draft.sendable_after_human_review:
            warnings.append("Draft is not ready for customer response.")
        if routing.manual_review_required:
            warnings.append("Routing recommendation requires human review.")
        if escalation.escalate:
            warnings.append(f"Escalation recommended: {escalation.severity}.")
        if sentiment.risk_flags:
            warnings.append(f"Risk flags detected: {', '.join(sentiment.risk_flags)}.")
        return warnings
