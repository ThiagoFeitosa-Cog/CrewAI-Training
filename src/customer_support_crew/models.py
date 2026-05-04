from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


SupportCategory = Literal[
    "billing",
    "technical_support",
    "onboarding",
    "account_management",
    "product_question",
    "bug_report",
    "feature_request",
    "cancellation_or_churn_risk",
    "general_support",
]

RoutingQueue = Literal[
    "billing",
    "technical_support",
    "onboarding",
    "customer_success",
    "general_support",
]

Severity = Literal["P0", "P1", "P2", "P3", "manual_review"]


class CustomerMetadata(BaseModel):
    customer_id: str
    company_name: str
    plan_tier: str
    account_status: str
    assigned_csm: str | None = None
    risk_level: Literal["low", "medium", "high"] = "low"


class SupportTicket(BaseModel):
    ticket_id: str
    customer_id: str
    subject: str
    body: str
    channel: Literal["email", "ticket"] = "ticket"
    product_area: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    customer_metadata: CustomerMetadata


class ClassificationResult(BaseModel):
    category: SupportCategory
    intent: str
    product_area: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str
    needs_manual_review: bool = False


class SentimentResult(BaseModel):
    sentiment_label: Literal["positive", "neutral", "frustrated", "urgent", "high_risk"]
    urgency: Literal["low", "medium", "high", "critical"]
    risk_flags: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str


class RetrievedSource(BaseModel):
    source_id: str
    title: str
    snippet: str
    relevance_score: float = Field(ge=0.0, le=1.0)


class RetrievalResult(BaseModel):
    sources: list[RetrievedSource] = Field(default_factory=list)
    retrieval_confidence: float = Field(ge=0.0, le=1.0)
    missing_knowledge: bool = False
    rationale: str


class DraftResponse(BaseModel):
    draft_text: str
    source_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    safety_notes: list[str] = Field(default_factory=list)
    sendable_after_human_review: bool = False


class RoutingRecommendation(BaseModel):
    queue: RoutingQueue
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str
    manual_review_required: bool = False


class EscalationRecommendation(BaseModel):
    escalate: bool
    severity: Severity
    target: str | None = None
    reason: str
    confidence: float = Field(ge=0.0, le=1.0)


class ReviewPackage(BaseModel):
    ticket: SupportTicket
    classification: ClassificationResult
    sentiment: SentimentResult
    retrieval: RetrievalResult
    draft_response: DraftResponse
    routing: RoutingRecommendation
    escalation: EscalationRecommendation
    warnings: list[str] = Field(default_factory=list)
    human_approval_required: bool = True
    ready_for_human_review: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
