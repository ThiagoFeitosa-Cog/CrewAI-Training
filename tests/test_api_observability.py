from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from customer_support_crew.api import app
from customer_support_crew.models import ReviewPackage
from customer_support_crew.runtime import (
    CREW_AGENTS_USED,
    CREW_NAME,
    CREW_PROCESS,
    CREW_TASKS_USED,
    RuntimeResult,
)


class ApiObservabilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.payload = {
            "customerId": "CUST-2048",
            "companyName": "Northstar Analytics",
            "planTier": "Enterprise",
            "productArea": "Integrations",
            "subject": "Urgent: API sync failed again before our renewal review",
            "message": (
                "Our Salesforce sync failed again and leadership is frustrated. "
                "We need this fixed ASAP before renewal."
            ),
        }

    def test_run_includes_events_metrics_and_trace_id(self) -> None:
        response = self.client.post("/api/runs", json={**self.payload, "runtimeMode": "deterministic"})
        self.assertEqual(response.status_code, 200)
        record = response.json()

        self.assertEqual(record["trace_id"], record["run_id"])
        self.assertIn("events", record)
        self.assertIn("metrics", record)
        self.assertGreaterEqual(len(record["events"]), 1)
        self.assertGreaterEqual(len(record["metrics"]["step_metrics"]), 7)
        self.assertIn("run_completed", {event["event_type"] for event in record["events"]})
        self.assertIsNone(record["metrics"]["token_usage"])
        self.assertIsNone(record["metrics"]["cost_estimate"])
        self.assertEqual(record["requested_runtime_mode"], "deterministic")
        self.assertEqual(record["actual_runtime_mode"], "deterministic")
        self.assertEqual(record["runtime_status"], "success")

    def test_metrics_summary_and_review_event_endpoints(self) -> None:
        run_record = self.client.post("/api/runs", json={**self.payload, "runtimeMode": "deterministic"}).json()
        run_id = run_record["run_id"]

        metrics_response = self.client.get(f"/api/runs/{run_id}/metrics")
        self.assertEqual(metrics_response.status_code, 200)
        self.assertEqual(metrics_response.json()["run_id"], run_id)

        events_response = self.client.get(f"/api/runs/{run_id}/events-json")
        self.assertEqual(events_response.status_code, 200)
        self.assertTrue(events_response.json())

        review_response = self.client.post(
            f"/api/runs/{run_id}/review",
            json={"decision": "approved", "reviewerNotes": "QA approved."},
        )
        self.assertEqual(review_response.status_code, 200)
        self.assertIn("review_submitted", {event["event_type"] for event in review_response.json()["events"]})

        summary_response = self.client.get("/api/observability/summary")
        self.assertEqual(summary_response.status_code, 200)
        self.assertGreaterEqual(summary_response.json()["total_runs"], 1)

    def test_crewai_flow_runtime_mode_returns_review_package_or_explicit_fallback(self) -> None:
        response = self.client.post("/api/runs", json={**self.payload, "runtimeMode": "crewai_flow"})
        self.assertEqual(response.status_code, 200)
        record = response.json()

        self.assertEqual(record["requested_runtime_mode"], "crewai_flow")
        self.assertIn(record["actual_runtime_mode"], {"crewai_flow", "crewai_flow_fallback"})
        self.assertEqual(record["runtime_status"], "success")
        self.assertIsNotNone(record["review_package"])
        self.assertIn("runtime_completed", {event["event_type"] for event in record["events"]})

    def test_crewai_llm_missing_provider_config_returns_safe_error(self) -> None:
        with patch.dict("os.environ", {}, clear=True), patch(
            "customer_support_crew.runtime.LOCAL_ENV_FILE", Path("/tmp/nonexistent-aamad-env")
        ):
            response = self.client.post("/api/runs", json={**self.payload, "runtimeMode": "crewai_llm"})

        self.assertEqual(response.status_code, 200)
        record = response.json()

        self.assertEqual(record["status"], "error")
        self.assertEqual(record["requested_runtime_mode"], "crewai_llm")
        self.assertEqual(record["actual_runtime_mode"], "crewai_llm")
        self.assertEqual(record["runtime_status"], "error")
        self.assertIn("OPENAI_API_KEY", record["runtime_error"])
        self.assertFalse(record["llm_kickoff_attempted"])
        self.assertEqual(record["crew_name"], "CustomerSupportCrew")
        self.assertEqual(record["process"], "sequential")
        self.assertFalse(record["crewai_kickoff_attempted"])
        self.assertEqual(record["crewai_kickoff_status"], "not_configured")
        self.assertEqual(record["agents_used"], CREW_AGENTS_USED)
        self.assertEqual(record["tasks_used"], CREW_TASKS_USED)
        self.assertNotIn("secret", str(record).lower())

    def test_crewai_llm_success_can_return_parsed_review_package_metadata(self) -> None:
        deterministic_record = self.client.post("/api/runs", json={**self.payload, "runtimeMode": "deterministic"}).json()
        parsed_package = ReviewPackage.model_validate(deterministic_record["review_package"])

        with patch(
            "customer_support_crew.api.run_support_workflow",
            return_value=RuntimeResult(
                requested_runtime_mode="crewai_llm",
                actual_runtime_mode="crewai_llm",
                runtime_status="success",
                review_package=parsed_package,
                runtime_output={
                    "type": "crewai_llm_result",
                    "review_package_parse_status": "parsed",
                    "output_text": parsed_package.model_dump_json(),
                    "human_approval_required": True,
                    "warnings": ["LLM output is for human review only and has not been sent."],
                },
                review_package_parse_status="parsed",
                llm_kickoff_attempted=True,
                crew_name=CREW_NAME,
                process=CREW_PROCESS,
                crewai_kickoff_attempted=True,
                crewai_kickoff_status="completed",
                agents_used=CREW_AGENTS_USED,
                tasks_used=CREW_TASKS_USED,
            ),
        ):
            response = self.client.post("/api/runs", json={**self.payload, "runtimeMode": "crewai_llm"})

        self.assertEqual(response.status_code, 200)
        record = response.json()
        self.assertEqual(record["status"], "done")
        self.assertEqual(record["crew_name"], CREW_NAME)
        self.assertEqual(record["process"], CREW_PROCESS)
        self.assertTrue(record["crewai_kickoff_attempted"])
        self.assertEqual(record["crewai_kickoff_status"], "completed")
        self.assertEqual(record["agents_used"], CREW_AGENTS_USED)
        self.assertEqual(record["tasks_used"], CREW_TASKS_USED)
        self.assertEqual(record["review_package_parse_status"], "parsed")
        self.assertIsNotNone(record["review_package"])


if __name__ == "__main__":
    unittest.main()
