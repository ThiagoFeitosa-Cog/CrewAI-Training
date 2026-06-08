from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from customer_support_crew.api import app


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
        response = self.client.post("/api/runs", json=self.payload)
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
        run_record = self.client.post("/api/runs", json=self.payload).json()
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
        self.assertNotIn("secret", str(record).lower())


if __name__ == "__main__":
    unittest.main()
