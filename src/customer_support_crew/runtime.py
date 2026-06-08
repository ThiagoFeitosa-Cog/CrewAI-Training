from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from customer_support_crew.flow import CustomerSupportFlow
from customer_support_crew.models import ReviewPackage, SupportTicket


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_BASE = PROJECT_ROOT / "knowledge_base" / "support_kb.md"
LOCAL_ENV_FILE = PROJECT_ROOT / ".env"
CREWAI_RUNTIME_HOME = PROJECT_ROOT / ".crewai-home"
SUPPORTED_PROVIDER_ENV = {"MODEL", "OPENAI_API_BASE", "OPENAI_API_KEY", "CREWAI_TRACING_ENABLED", "OBSERVABILITY_MODE"}
CREW_NAME = "CustomerSupportCrew"
CREW_PROCESS = "sequential"
CREW_AGENTS_USED = [
    "classification_agent",
    "sentiment_analysis_agent",
    "knowledge_retrieval_agent",
    "solution_generation_agent",
    "routing_agent",
    "escalation_agent",
]
CREW_TASKS_USED = [
    "classify_ticket_task",
    "analyze_sentiment_task",
    "retrieve_knowledge_task",
    "generate_draft_response_task",
    "recommend_routing_task",
    "recommend_escalation_task",
    "assemble_review_package_task",
]

RuntimeMode = Literal["deterministic", "crewai_flow", "crewai_llm"]
RuntimeStatus = Literal["success", "error"]


@dataclass
class RuntimeResult:
    requested_runtime_mode: RuntimeMode
    actual_runtime_mode: str
    runtime_status: RuntimeStatus
    review_package: ReviewPackage | None = None
    runtime_output: dict[str, Any] | None = None
    runtime_error: str | None = None
    review_package_parse_status: str = "not_applicable"
    llm_kickoff_attempted: bool = False
    crew_name: str | None = None
    process: str | None = None
    crewai_kickoff_attempted: bool = False
    crewai_kickoff_status: Literal["completed", "error", "not_configured", "not_applicable"] = "not_applicable"
    agents_used: list[str] | None = None
    tasks_used: list[str] | None = None


def run_support_workflow(ticket: SupportTicket, runtime_mode: RuntimeMode) -> RuntimeResult:
    if runtime_mode == "deterministic":
        review_package = CustomerSupportFlow(DEFAULT_KNOWLEDGE_BASE).run(ticket)
        return RuntimeResult(
            requested_runtime_mode=runtime_mode,
            actual_runtime_mode="deterministic",
            runtime_status="success",
            review_package=review_package,
            review_package_parse_status="parsed",
        )

    if runtime_mode == "crewai_flow":
        return _run_crewai_flow(ticket, runtime_mode)

    if runtime_mode == "crewai_llm":
        return _run_crewai_llm(ticket, runtime_mode)

    return RuntimeResult(
        requested_runtime_mode=runtime_mode,
        actual_runtime_mode="unknown",
        runtime_status="error",
        runtime_error="Unsupported runtime mode.",
    )


def _run_crewai_flow(ticket: SupportTicket, requested_runtime_mode: RuntimeMode) -> RuntimeResult:
    from customer_support_crew.crewai_flow import (
        CREWAI_FLOW_AVAILABLE,
        CustomerSupportCrewFlow,
        CustomerSupportCrewFlowFallback,
    )

    fixture_path = _write_temp_ticket_fixture(ticket)
    try:
        if CREWAI_FLOW_AVAILABLE and CustomerSupportCrewFlow is not None:
            review_package = CustomerSupportCrewFlow(fixture_path=fixture_path).kickoff()
            actual_runtime_mode = "crewai_flow"
        else:
            review_package = CustomerSupportCrewFlowFallback(fixture_path=fixture_path).kickoff_fallback()
            actual_runtime_mode = "crewai_flow_fallback"

        return RuntimeResult(
            requested_runtime_mode=requested_runtime_mode,
            actual_runtime_mode=actual_runtime_mode,
            runtime_status="success",
            review_package=review_package,
            review_package_parse_status="parsed",
        )
    except Exception as exc:
        return RuntimeResult(
            requested_runtime_mode=requested_runtime_mode,
            actual_runtime_mode="crewai_flow",
            runtime_status="error",
            runtime_error=f"CrewAI Flow runtime failed safely: {exc.__class__.__name__}.",
        )
    finally:
        fixture_path.unlink(missing_ok=True)


def _run_crewai_llm(ticket: SupportTicket, requested_runtime_mode: RuntimeMode) -> RuntimeResult:
    _load_local_env()
    _configure_provider_environment()

    missing_required = [name for name in ("OPENAI_API_KEY",) if not os.getenv(name)]
    if missing_required:
        return RuntimeResult(
            requested_runtime_mode=requested_runtime_mode,
            actual_runtime_mode="crewai_llm",
            runtime_status="error",
            runtime_error=(
                "CrewAI LLM mode requires provider configuration. Missing: "
                f"{', '.join(missing_required)}. Deterministic mode remains available."
            ),
            llm_kickoff_attempted=False,
            crew_name=CREW_NAME,
            process=CREW_PROCESS,
            crewai_kickoff_attempted=False,
            crewai_kickoff_status="not_configured",
            agents_used=CREW_AGENTS_USED,
            tasks_used=CREW_TASKS_USED,
        )

    missing_advisory = [name for name in ("MODEL", "OPENAI_API_BASE") if not os.getenv(name)]

    try:
        from customer_support_crew.crew import CREWAI_AVAILABLE, CustomerSupportCrew
    except ImportError:
        return RuntimeResult(
            requested_runtime_mode=requested_runtime_mode,
            actual_runtime_mode="crewai_llm",
            runtime_status="error",
            runtime_error="CrewAI LLM mode could not import the CrewAI crew module.",
            llm_kickoff_attempted=False,
            crew_name=CREW_NAME,
            process=CREW_PROCESS,
            crewai_kickoff_attempted=False,
            crewai_kickoff_status="error",
            agents_used=CREW_AGENTS_USED,
            tasks_used=CREW_TASKS_USED,
        )

    if not CREWAI_AVAILABLE:
        return RuntimeResult(
            requested_runtime_mode=requested_runtime_mode,
            actual_runtime_mode="crewai_llm",
            runtime_status="error",
            runtime_error="CrewAI LLM mode requires CrewAI to be installed.",
            llm_kickoff_attempted=False,
            crew_name=CREW_NAME,
            process=CREW_PROCESS,
            crewai_kickoff_attempted=False,
            crewai_kickoff_status="not_configured",
            agents_used=CREW_AGENTS_USED,
            tasks_used=CREW_TASKS_USED,
        )

    inputs = _ticket_to_crew_inputs(ticket)
    try:
        result = CustomerSupportCrew().crew().kickoff(inputs=inputs)
    except Exception as exc:
        return RuntimeResult(
            requested_runtime_mode=requested_runtime_mode,
            actual_runtime_mode="crewai_llm",
            runtime_status="error",
            runtime_error=f"CrewAI LLM provider call failed safely: {exc.__class__.__name__}.",
            llm_kickoff_attempted=True,
            crew_name=CREW_NAME,
            process=CREW_PROCESS,
            crewai_kickoff_attempted=True,
            crewai_kickoff_status="error",
            agents_used=CREW_AGENTS_USED,
            tasks_used=CREW_TASKS_USED,
        )

    output_text = _crew_result_to_text(result)
    parsed_review_package, parse_error = parse_review_package_from_crewai_output(output_text)
    parse_status = "parsed" if parsed_review_package else "not_parsed"
    runtime_output = {
        "type": "crewai_llm_result",
        "review_package_parse_status": parse_status,
        "output_text": output_text,
        "human_approval_required": True,
        "warnings": [
            "LLM output is for human review only and has not been sent.",
        ],
    }
    if parse_error:
        runtime_output["parse_error"] = parse_error
        runtime_output["warnings"].append("CrewAI output could not be parsed into ReviewPackage JSON.")
    if missing_advisory:
        runtime_output["configuration_warnings"] = [
            f"{name} is not set; provider defaults may have been used." for name in missing_advisory
        ]

    return RuntimeResult(
        requested_runtime_mode=requested_runtime_mode,
        actual_runtime_mode="crewai_llm",
        runtime_status="success",
        review_package=parsed_review_package,
        runtime_output=runtime_output,
        review_package_parse_status=parse_status,
        llm_kickoff_attempted=True,
        crew_name=CREW_NAME,
        process=CREW_PROCESS,
        crewai_kickoff_attempted=True,
        crewai_kickoff_status="completed",
        agents_used=CREW_AGENTS_USED,
        tasks_used=CREW_TASKS_USED,
    )


def _crew_result_to_text(result: Any) -> str:
    raw = getattr(result, "raw", None)
    if raw:
        return str(raw)
    json_dict = getattr(result, "json_dict", None)
    if json_dict:
        return json.dumps(json_dict)
    return str(result)


def parse_review_package_from_crewai_output(output_text: str) -> tuple[ReviewPackage | None, str | None]:
    try:
        payload = _extract_json_payload(output_text)
        return ReviewPackage.model_validate(payload), None
    except Exception as exc:
        return None, f"{exc.__class__.__name__}: CrewAI output did not match ReviewPackage schema."


def _extract_json_payload(output_text: str) -> Any:
    stripped = output_text.strip()
    if not stripped:
        raise ValueError("Empty CrewAI output.")

    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()

    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    start_positions = [index for index in (stripped.find("{"), stripped.find("[")) if index >= 0]
    if not start_positions:
        raise ValueError("No JSON object found in CrewAI output.")
    start = min(start_positions)
    opener = stripped[start]
    closer = "}" if opener == "{" else "]"
    end = stripped.rfind(closer)
    if end <= start:
        raise ValueError("Incomplete JSON payload in CrewAI output.")
    return json.loads(stripped[start : end + 1])


def _load_local_env(env_path: Path | None = None) -> None:
    env_path = env_path or LOCAL_ENV_FILE
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key in SUPPORTED_PROVIDER_ENV and key not in os.environ:
            os.environ[key] = value


def _configure_provider_environment() -> None:
    os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
    os.environ.setdefault("CREWAI_DISABLE_TRACKING", "true")
    os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
    os.environ.setdefault("OTEL_SDK_DISABLED", "true")
    os.environ["HOME"] = str(CREWAI_RUNTIME_HOME)

    openai_api_base = os.getenv("OPENAI_API_BASE")
    if openai_api_base and not os.getenv("OPENAI_BASE_URL"):
        os.environ["OPENAI_BASE_URL"] = openai_api_base


def _ticket_to_crew_inputs(ticket: SupportTicket) -> dict[str, Any]:
    return {
        "ticket_id": ticket.ticket_id,
        "customer_id": ticket.customer_id,
        "subject": ticket.subject,
        "body": ticket.body,
        "channel": ticket.channel,
        "product_area": ticket.product_area,
        "customer_metadata": ticket.customer_metadata.model_dump(mode="json"),
    }


def _write_temp_ticket_fixture(ticket: SupportTicket) -> Path:
    payload = {
        "ticket_id": ticket.ticket_id,
        "customer_id": ticket.customer_id,
        "subject": ticket.subject,
        "body": ticket.body,
        "channel": ticket.channel,
        "product_area": ticket.product_area,
        "customer_metadata": ticket.customer_metadata.model_dump(mode="json"),
    }
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as file:
        json.dump(payload, file)
        return Path(file.name)
