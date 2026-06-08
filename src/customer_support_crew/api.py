from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from customer_support_crew.flow import CustomerSupportFlow
from customer_support_crew.models import (
    CustomerMetadata,
    ReviewPackage,
    RunEvent,
    RunEventType,
    RunMetrics,
    StepMetric,
    SupportTicket,
)
from customer_support_crew.run_store import RunStore
from customer_support_crew.runtime import RuntimeMode, run_support_workflow


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
    runtime_mode: RuntimeMode = Field(default="deterministic", alias="runtimeMode")

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


def _dt_now() -> datetime:
    return datetime.now(timezone.utc)


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


def _safe_event(
    run_id: str,
    trace_id: str,
    event_type: RunEventType,
    safe_summary: str,
    step_name: str | None = None,
    duration_ms: float | None = None,
    metadata: dict[str, Any] | None = None,
) -> RunEvent:
    return RunEvent(
        event_id=f"evt-{uuid4().hex}",
        run_id=run_id,
        trace_id=trace_id,
        event_type=event_type,
        safe_summary=safe_summary,
        step_name=step_name,
        duration_ms=duration_ms,
        metadata=metadata or {},
    )


def _timed_step(
    run_id: str,
    trace_id: str,
    name: str,
    started_summary: str,
    completed_summary: Callable[[Any], str],
    func: Callable[[], Any],
    events: list[RunEvent],
    step_metrics: list[StepMetric],
    tool_summary: str | None = None,
) -> Any:
    started_at = _dt_now()
    started_perf = time.perf_counter()
    events.append(_safe_event(run_id, trace_id, "task_started", started_summary, step_name=name))
    if tool_summary:
        events.append(_safe_event(run_id, trace_id, "tool_used", tool_summary, step_name=name))
    try:
        result = func()
    except Exception as exc:
        finished_at = _dt_now()
        duration_ms = round((time.perf_counter() - started_perf) * 1000, 2)
        step_metrics.append(
            StepMetric(
                step_name=name,
                status="error",
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=duration_ms,
            )
        )
        events.append(
            _safe_event(
                run_id,
                trace_id,
                "error",
                f"{name.replace('_', ' ')} failed.",
                step_name=name,
                duration_ms=duration_ms,
                metadata={"error_type": exc.__class__.__name__},
            )
        )
        raise

    finished_at = _dt_now()
    duration_ms = round((time.perf_counter() - started_perf) * 1000, 2)
    step_metrics.append(
        StepMetric(
            step_name=name,
            status="completed",
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=duration_ms,
        )
    )
    events.append(
        _safe_event(
            run_id,
            trace_id,
            "task_completed",
            completed_summary(result),
            step_name=name,
            duration_ms=duration_ms,
        )
    )
    return result


def _instrumented_review_package(
    flow: CustomerSupportFlow,
    ticket: SupportTicket,
    run_id: str,
    trace_id: str,
    events: list[RunEvent],
    step_metrics: list[StepMetric],
) -> ReviewPackage:
    classification = _timed_step(
        run_id,
        trace_id,
        "classification",
        "Classification started.",
        lambda result: f"Classified as {result.category}.",
        lambda: flow._classify(ticket),
        events,
        step_metrics,
    )
    sentiment = _timed_step(
        run_id,
        trace_id,
        "sentiment",
        "Sentiment analysis started.",
        lambda result: f"Detected {result.sentiment_label} urgency {result.urgency}.",
        lambda: flow._analyze_sentiment(ticket),
        events,
        step_metrics,
    )
    retrieval = _timed_step(
        run_id,
        trace_id,
        "knowledge_retrieval",
        "Local knowledge retrieval started.",
        lambda result: f"Retrieved {len(result.sources)} local source(s).",
        lambda: flow.knowledge_tool.search(
            f"{ticket.subject} {ticket.body} {classification.category} {classification.intent}"
        ),
        events,
        step_metrics,
        tool_summary="Used local markdown knowledge base search.",
    )
    draft = _timed_step(
        run_id,
        trace_id,
        "draft_response",
        "Draft response generation started.",
        lambda _result: "Draft response generated for human review only.",
        lambda: flow._draft_response(ticket, retrieval),
        events,
        step_metrics,
    )
    routing = _timed_step(
        run_id,
        trace_id,
        "routing",
        "Routing recommendation started.",
        lambda result: f"Recommended queue: {result.queue}.",
        lambda: flow._recommend_routing(classification, sentiment),
        events,
        step_metrics,
    )
    escalation = _timed_step(
        run_id,
        trace_id,
        "escalation",
        "Escalation assessment started.",
        lambda result: f"Escalation required: {result.escalate}.",
        lambda: flow._recommend_escalation(ticket, classification, sentiment, retrieval),
        events,
        step_metrics,
    )
    warnings = _timed_step(
        run_id,
        trace_id,
        "review_package",
        "Review package assembly started.",
        lambda result: f"Review package assembled with {len(result)} warning(s).",
        lambda: flow._warnings(classification, sentiment, retrieval, draft, routing, escalation),
        events,
        step_metrics,
    )
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


def _metrics(
    run_id: str,
    trace_id: str,
    runtime_mode: str,
    status: Literal["running", "done", "error"],
    started_at: datetime,
    finished_at: datetime | None,
    step_metrics: list[StepMetric],
    error: str | None = None,
) -> RunMetrics:
    slowest = max(step_metrics, key=lambda item: item.duration_ms, default=None)
    wall_time_ms = round((finished_at - started_at).total_seconds() * 1000, 2) if finished_at else None
    return RunMetrics(
        run_id=run_id,
        trace_id=trace_id,
        runtime_mode=runtime_mode,
        status=status,
        started_at=started_at,
        finished_at=finished_at,
        wall_time_ms=wall_time_ms,
        step_metrics=step_metrics,
        slowest_step=slowest.step_name if slowest else None,
        error=error,
        token_usage=None,
        cost_estimate=None,
    )


def _summary_from_record(record: dict) -> dict:
    metrics = record.get("metrics") or {}
    return {
        "run_id": record["run_id"],
        "trace_id": record.get("trace_id", record["run_id"]),
        "runtime_mode": record["runtime_mode"],
        "status": record["status"],
        "started_at": metrics.get("started_at") or record.get("created_at"),
        "finished_at": metrics.get("finished_at") or record.get("updated_at"),
        "wall_time_ms": metrics.get("wall_time_ms"),
        "slowest_step": metrics.get("slowest_step"),
        "event_count": len(record.get("events", [])),
        "error": metrics.get("error"),
    }


def _history_item(record: dict) -> dict:
    ticket = record["ticket"]
    review_package = record.get("review_package") or {}
    escalation = review_package.get("escalation") or {}
    customer_metadata = ticket.get("customer_metadata") or {}
    return {
        "run_id": record["run_id"],
        "trace_id": record.get("trace_id", record["run_id"]),
        "status": record["status"],
        "runtime_mode": record["runtime_mode"],
        "requested_runtime_mode": record.get("requested_runtime_mode", record["runtime_mode"]),
        "actual_runtime_mode": record.get("actual_runtime_mode", record["runtime_mode"]),
        "runtime_status": record.get("runtime_status", "success" if record.get("status") == "done" else "error"),
        "runtime_error": record.get("runtime_error"),
        "subject": ticket["subject"],
        "company_name": customer_metadata.get("company_name", "Unknown"),
        "escalated": bool(escalation.get("escalate", False)),
        "review_status": record["human_review"]["status"],
        "created_at": record["created_at"],
        "updated_at": record["updated_at"],
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "runtime_mode": "deterministic",
        "service": "customer-support-crew-api",
        "observability": {"mode": "local", "events": "enabled", "metrics": "enabled"},
    }


@app.post("/api/runs")
def create_run(payload: TicketPayload) -> dict:
    run_id = f"run-{uuid4().hex}"
    trace_id = run_id
    started_at = _dt_now()
    requested_runtime_mode = payload.runtime_mode
    actual_runtime_mode = requested_runtime_mode
    events: list[RunEvent] = [
        _safe_event(
            run_id,
            trace_id,
            "runtime_selected",
            f"Runtime mode selected: {requested_runtime_mode}.",
            metadata={"requested_runtime_mode": requested_runtime_mode},
        ),
        _safe_event(run_id, trace_id, "run_started", f"Run started with requested runtime {requested_runtime_mode}."),
    ]
    step_metrics: list[StepMetric] = []
    ticket = _build_ticket(payload)
    runtime_output = None
    review_package_parse_status = "not_applicable"
    llm_kickoff_attempted = False

    if requested_runtime_mode == "deterministic":
        flow = CustomerSupportFlow(DEFAULT_KNOWLEDGE_BASE)
        events.append(_safe_event(run_id, trace_id, "runtime_started", "Deterministic runtime started."))
        try:
            review_package = _instrumented_review_package(flow, ticket, run_id, trace_id, events, step_metrics)
            status: Literal["done", "error"] = "done"
            runtime_status = "success"
            runtime_error = None
            review_package_parse_status = "parsed"
            events.append(_safe_event(run_id, trace_id, "runtime_completed", "Deterministic runtime completed."))
        except Exception as exc:
            review_package = None
            status = "error"
            runtime_status = "error"
            runtime_error = f"{exc.__class__.__name__}: deterministic run failed"
            events.append(_safe_event(run_id, trace_id, "runtime_error", "Deterministic runtime failed safely."))
    else:
        events.append(
            _safe_event(
                run_id,
                trace_id,
                "runtime_started",
                f"{requested_runtime_mode} runtime started.",
                metadata={"requested_runtime_mode": requested_runtime_mode},
            )
        )
        runtime_started_at = _dt_now()
        runtime_perf = time.perf_counter()
        runtime_result = run_support_workflow(ticket, requested_runtime_mode)
        runtime_finished_at = _dt_now()
        runtime_duration_ms = round((time.perf_counter() - runtime_perf) * 1000, 2)
        step_metrics.append(
            StepMetric(
                step_name="runtime_execution",
                status="completed" if runtime_result.runtime_status == "success" else "error",
                started_at=runtime_started_at,
                finished_at=runtime_finished_at,
                duration_ms=runtime_duration_ms,
            )
        )
        actual_runtime_mode = runtime_result.actual_runtime_mode
        review_package = runtime_result.review_package
        runtime_output = runtime_result.runtime_output
        runtime_status = runtime_result.runtime_status
        runtime_error = runtime_result.runtime_error
        review_package_parse_status = runtime_result.review_package_parse_status
        llm_kickoff_attempted = runtime_result.llm_kickoff_attempted
        status = "done" if runtime_result.runtime_status == "success" else "error"
        events.append(
            _safe_event(
                run_id,
                trace_id,
                "runtime_completed" if status == "done" else "runtime_error",
                f"{actual_runtime_mode} runtime completed." if status == "done" else f"{actual_runtime_mode} runtime failed safely.",
                duration_ms=runtime_duration_ms,
                metadata={
                    "requested_runtime_mode": requested_runtime_mode,
                    "actual_runtime_mode": actual_runtime_mode,
                    "runtime_status": runtime_status,
                    "llm_kickoff_attempted": llm_kickoff_attempted,
                },
            )
        )

    finished_at = _dt_now()
    metrics = _metrics(run_id, trace_id, actual_runtime_mode, status, started_at, finished_at, step_metrics, runtime_error)
    events.append(
        _safe_event(
            run_id,
            trace_id,
            "run_completed" if status == "done" else "error",
            "Run completed and output is ready for human review." if status == "done" else "Run failed safely.",
            duration_ms=metrics.wall_time_ms,
            metadata={"status": status},
        )
    )
    record = {
        "run_id": run_id,
        "trace_id": trace_id,
        "status": status,
        "runtime_mode": actual_runtime_mode,
        "requested_runtime_mode": requested_runtime_mode,
        "actual_runtime_mode": actual_runtime_mode,
        "runtime_status": runtime_status,
        "runtime_error": runtime_error,
        "review_package_parse_status": review_package_parse_status,
        "llm_kickoff_attempted": llm_kickoff_attempted,
        "ticket": ticket.model_dump(mode="json"),
        "review_package": review_package.model_dump(mode="json") if review_package else None,
        "runtime_output": runtime_output,
        "observability_steps": _observability(review_package) if review_package else [],
        "events": [event.model_dump(mode="json") for event in events],
        "metrics": metrics.model_dump(mode="json"),
        "observability_summary": _summary_from_record(
            {
                "run_id": run_id,
                "trace_id": trace_id,
                "runtime_mode": actual_runtime_mode,
                "status": status,
                "events": [event.model_dump(mode="json") for event in events],
                "metrics": metrics.model_dump(mode="json"),
                "created_at": started_at.isoformat(),
                "updated_at": finished_at.isoformat(),
            }
        ),
        "human_review": {"status": "pending", "reviewer_notes": "", "updated_at": None},
        "created_at": started_at.isoformat(),
        "updated_at": finished_at.isoformat(),
    }
    if status == "error":
        record["error"] = runtime_error
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


@app.get("/api/runs/{run_id}/events-json")
def get_run_events_json(run_id: str) -> list[dict]:
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return record.get("events", [])


@app.get("/api/runs/{run_id}/events")
def stream_run_events(run_id: str) -> StreamingResponse:
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")

    def event_stream():
        for event in record.get("events", []):
            yield f"event: {event['event_type']}\n"
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/runs/{run_id}/metrics")
def get_run_metrics(run_id: str) -> dict:
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return record.get("metrics") or _metrics(
        run_id=record["run_id"],
        trace_id=record.get("trace_id", record["run_id"]),
        runtime_mode=record["runtime_mode"],
        status=record["status"],
        started_at=datetime.fromisoformat(record["created_at"]),
        finished_at=datetime.fromisoformat(record["updated_at"]),
        step_metrics=[],
    ).model_dump(mode="json")


@app.get("/api/observability/summary")
def get_observability_summary() -> dict:
    records = store.list()
    completed = [record for record in records if record.get("status") == "done"]
    error_runs = [record for record in records if record.get("status") == "error"]
    wall_times = [
        record["metrics"]["wall_time_ms"]
        for record in records
        if record.get("metrics", {}).get("wall_time_ms") is not None
    ]
    latest = records[0] if records else None
    return {
        "total_runs": len(records),
        "completed_runs": len(completed),
        "error_runs": len(error_runs),
        "average_wall_time_ms": round(sum(wall_times) / len(wall_times), 2) if wall_times else None,
        "latest_run_id": latest["run_id"] if latest else None,
        "deterministic_mode_runs": len([record for record in records if record.get("runtime_mode") == "deterministic"]),
        "crewai_flow_mode_runs": len([record for record in records if str(record.get("runtime_mode", "")).startswith("crewai_flow")]),
        "llm_mode_runs": len([record for record in records if record.get("runtime_mode") == "crewai_llm"]),
    }


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
    trace_id = record.get("trace_id", run_id)
    review_event = _safe_event(
        run_id,
        trace_id,
        "review_submitted",
        f"Human review submitted with decision: {payload.decision}.",
        metadata={"decision": payload.decision, "notes_present": bool(payload.reviewer_notes.strip())},
    )
    record.setdefault("events", []).append(review_event.model_dump(mode="json"))
    record["observability_summary"] = _summary_from_record(record)
    record["updated_at"] = _now()
    return store.save(record)
