from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from customer_support_crew.flow import CustomerSupportFlow
from customer_support_crew.models import CustomerMetadata, ReviewPackage, SupportTicket
from customer_support_crew.run_store import RunStore


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_BASE = PROJECT_ROOT / "knowledge_base" / "support_kb.md"

app = FastAPI(title="Multi-Agent Customer Support Crew API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = RunStore()


class TicketPayload(BaseModel):
    customer_id: str = Field(alias="customerId")
    company_name: str = Field(alias="companyName")
    plan_tier: str = Field(alias="planTier")
    product_area: str = Field(alias="productArea")
    subject: str
    message: str
    ticket_id: str | None = Field(default=None, alias="ticketId")
    channel: Literal["email", "ticket"] = "ticket"
    account_status: str = Field(default="active", alias="accountStatus")
    assigned_csm: str | None = Field(default=None, alias="assignedCsm")
    risk_level: Literal["low", "medium", "high"] = Field(default="high", alias="riskLevel")

    model_config = {"populate_by_name": True}


class AgentStep(BaseModel):
    name: str
    status: Literal["pending", "running", "completed", "error"]
    summary: str
    timestamp: str


class HumanReviewRequest(BaseModel):
    decision: Literal["approved", "rejected", "needs_changes"]
    reviewer_notes: str = Field(default="", alias="reviewerNotes")

    model_config = {"populate_by_name": True}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_ticket(payload: TicketPayload) -> SupportTicket:
    metadata = CustomerMetadata(
        customer_id=payload.customer_id,
        company_name=payload.company_name,
        plan_tier=payload.plan_tier,
        account_status=payload.account_status,
        assigned_csm=payload.assigned_csm,
        risk_level=payload.risk_level,
    )
    return SupportTicket(
        ticket_id=payload.ticket_id or f"TCK-{uuid4().hex[:8].upper()}",
        customer_id=payload.customer_id,
        subject=payload.subject,
        body=payload.message,
        channel=payload.channel,
        product_area=payload.product_area,
        customer_metadata=metadata,
    )


def _step(name: str, summary: str) -> dict:
    return {"name": name, "status": "completed", "summary": summary, "timestamp": _now()}


def _observability(review_package: ReviewPackage) -> list[dict]:
    return [
        _step("classification", f"Classified as {review_package.classification.category}."),
        _step("sentiment", f"Detected {review_package.sentiment.sentiment_label} urgency {review_package.sentiment.urgency}."),
        _step("knowledge_retrieval", f"Retrieved {len(review_package.retrieval.sources)} local source(s)."),
        _step("draft_response", "Draft response generated for human review only."),
        _step("routing", f"Recommended queue: {review_package.routing.queue}."),
        _step("escalation", f"Escalation required: {review_package.escalation.escalate}."),
        _step("review_package", "Review package assembled and awaiting human decision."),
    ]


def _history_item(record: dict) -> dict:
    ticket = record["ticket"]
    return {
        "run_id": record["run_id"],
        "status": record["status"],
        "runtime_mode": record["runtime_mode"],
        "subject": ticket["subject"],
        "review_status": record["human_review"]["status"],
        "created_at": record["created_at"],
        "updated_at": record["updated_at"],
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "runtime_mode": "deterministic", "service": "customer-support-crew-api"}


@app.post("/api/runs")
def create_run(payload: TicketPayload) -> dict:
    now = _now()
    run_id = f"run-{uuid4().hex}"
    ticket = _build_ticket(payload)
    flow = CustomerSupportFlow(DEFAULT_KNOWLEDGE_BASE)
    review_package = flow.run(ticket)
    record = {
        "run_id": run_id,
        "status": "done",
        "runtime_mode": "deterministic",
        "ticket": ticket.model_dump(mode="json"),
        "review_package": review_package.model_dump(mode="json"),
        "observability_steps": _observability(review_package),
        "human_review": {"status": "pending", "reviewer_notes": "", "updated_at": None},
        "created_at": now,
        "updated_at": _now(),
    }
    return store.save(record)


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict:
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return record


@app.get("/api/runs")
def list_runs() -> dict:
    return {"runs": [_history_item(record) for record in store.list()]}


@app.post("/api/runs/{run_id}/review")
def review_run(run_id: str, payload: HumanReviewRequest) -> dict:
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    record["human_review"] = {
        "status": payload.decision,
        "reviewer_notes": payload.reviewer_notes,
        "updated_at": _now(),
    }
    record["updated_at"] = _now()
    return store.save(record)
