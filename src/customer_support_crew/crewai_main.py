from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = PROJECT_ROOT / "data" / "fixtures" / "sample_ticket.json"
LOCAL_ENV_FILE = PROJECT_ROOT / ".env"
CREWAI_RUNTIME_HOME = PROJECT_ROOT / ".crewai-home"
SUPPORTED_PROVIDER_ENV = {"MODEL", "OPENAI_API_BASE", "OPENAI_API_KEY"}


def _provider_guidance() -> str:
    return (
        "This project supports OpenAI-compatible providers, including Microsoft Foundry, through:\n"
        "  MODEL=<provider_or_deployment_model_identifier>\n"
        "  OPENAI_API_BASE=<openai_compatible_endpoint_base_url>\n"
        "  OPENAI_API_KEY=<secret_key>\n"
        "Create these values in a local .env file and do not commit .env.\n"
    )


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


def _load_crew_inputs(fixture_path: Path = DEFAULT_FIXTURE) -> dict[str, Any]:
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    return {
        "ticket_id": payload["ticket_id"],
        "customer_id": payload["customer_id"],
        "subject": payload["subject"],
        "body": payload["body"],
        "channel": payload.get("channel", "ticket"),
        "product_area": payload.get("product_area"),
        "customer_metadata": payload["customer_metadata"],
    }


def main() -> int:
    _load_local_env()
    _configure_provider_environment()

    if not os.getenv("OPENAI_API_KEY"):
        print(
            "LLM CrewAI mode was not started because OPENAI_API_KEY is not set.\n"
            f"{_provider_guidance()}"
            "The free deterministic backend still works with:\n"
            "  PYTHONPATH=src .venv/bin/python -m customer_support_crew.main\n"
            "The deterministic CrewAI Flow runner works with:\n"
            "  PYTHONPATH=src .venv/bin/python -m customer_support_crew.crewai_flow\n"
            "To try LLM CrewAI mode later, install the optional dependency and set:\n"
            "  uv pip install -e '.[crewai]'\n"
            "  export MODEL=<provider_or_deployment_model_identifier>\n"
            "  export OPENAI_API_BASE=<openai_compatible_endpoint_base_url>\n"
            "  export OPENAI_API_KEY=<secret_key>\n"
        )
        return 0

    missing_optional = [name for name in ("MODEL", "OPENAI_API_BASE") if not os.getenv(name)]
    if missing_optional:
        print(
            "Provider configuration warning: "
            f"{', '.join(missing_optional)} is not set. CrewAI or the provider may infer defaults, "
            "but Microsoft Foundry/OpenAI-compatible course endpoints usually require explicit values.\n"
            f"{_provider_guidance()}"
        )

    try:
        from customer_support_crew.crew import CREWAI_AVAILABLE, CustomerSupportCrew
    except ImportError as exc:
        print(f"Unable to import the CrewAI crew module: {exc}")
        return 1

    if not CREWAI_AVAILABLE:
        print(
            "CrewAI is not installed, so LLM CrewAI mode cannot run.\n"
            "Install the optional dependency with:\n"
            "  uv pip install -e '.[crewai]'\n"
        )
        return 1

    inputs = _load_crew_inputs()
    result = CustomerSupportCrew().crew().kickoff(inputs=inputs)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
