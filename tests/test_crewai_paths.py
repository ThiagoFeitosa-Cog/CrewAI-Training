from __future__ import annotations

import io
import os
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from customer_support_crew.crewai_flow import (
    CREWAI_FLOW_AVAILABLE,
    CustomerSupportCrewFlow,
    CustomerSupportCrewFlowFallback,
    run_customer_support_flow,
)
from customer_support_crew.crewai_main import _configure_provider_environment, _load_local_env, main as crewai_main
from customer_support_crew.models import ReviewPackage
from customer_support_crew.tools.crewai_local_knowledge_tool import CrewAILocalKnowledgeTool


class CrewAIPathTests(unittest.TestCase):
    def test_crewai_flow_module_runs_without_openai_key(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            review_package = run_customer_support_flow()

        self.assertIsInstance(review_package, ReviewPackage)
        self.assertTrue(review_package.human_approval_required)
        self.assertTrue(review_package.ready_for_human_review)

    def test_crewai_flow_runtime_or_fallback_path_is_explicit(self) -> None:
        if CREWAI_FLOW_AVAILABLE:
            self.assertIsNotNone(CustomerSupportCrewFlow)
            with patch.dict(os.environ, {}, clear=True):
                review_package = CustomerSupportCrewFlow().kickoff()
        else:
            fallback = CustomerSupportCrewFlowFallback()
            self.assertEqual(fallback.runtime_mode, "fallback")
            with patch.dict(os.environ, {}, clear=True):
                review_package = fallback.kickoff_fallback()

        self.assertIsInstance(review_package, ReviewPackage)
        self.assertTrue(review_package.human_approval_required)

    def test_llm_crewai_entrypoint_explains_missing_key(self) -> None:
        output = io.StringIO()
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("customer_support_crew.crewai_main.LOCAL_ENV_FILE", Path("missing-test.env")),
            redirect_stdout(output),
        ):
            exit_code = crewai_main()

        self.assertEqual(exit_code, 0)
        text = output.getvalue()
        self.assertIn("OPENAI_API_KEY is not set", text)
        self.assertIn("MODEL", text)
        self.assertIn("OPENAI_API_BASE", text)
        self.assertIn("customer_support_crew.main", text)
        self.assertIn("customer_support_crew.crewai_flow", text)
        self.assertNotIn("test-secret-value", text)

    def test_llm_crewai_entrypoint_does_not_print_configured_secret(self) -> None:
        output = io.StringIO()
        fake_crew_module = types.SimpleNamespace(CREWAI_AVAILABLE=False, CustomerSupportCrew=object)
        with (
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-secret-value"}, clear=True),
            patch("customer_support_crew.crewai_main.LOCAL_ENV_FILE", Path("missing-test.env")),
            patch.dict(sys.modules, {"customer_support_crew.crew": fake_crew_module}),
            redirect_stdout(output),
        ):
            exit_code = crewai_main()

        self.assertEqual(exit_code, 1)
        text = output.getvalue()
        self.assertIn("MODEL", text)
        self.assertIn("OPENAI_API_BASE", text)
        self.assertNotIn("test-secret-value", text)

    def test_local_env_loader_supports_provider_variables_without_printing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            env_path.write_text(
                "MODEL=test-model\n"
                "OPENAI_API_BASE=https://example.invalid/openai\n"
                "OPENAI_API_KEY=test-secret-value\n",
                encoding="utf-8",
            )

            with patch.dict(os.environ, {}, clear=True):
                _load_local_env(env_path)
                self.assertEqual(os.environ["MODEL"], "test-model")
                self.assertEqual(os.environ["OPENAI_API_BASE"], "https://example.invalid/openai")
                self.assertEqual(os.environ["OPENAI_API_KEY"], "test-secret-value")

    def test_provider_environment_maps_openai_api_base_alias(self) -> None:
        with patch.dict(os.environ, {"OPENAI_API_BASE": "https://example.invalid/openai"}, clear=True):
            _configure_provider_environment()
            self.assertEqual(os.environ["OPENAI_BASE_URL"], "https://example.invalid/openai")

    def test_crewai_local_knowledge_tool_uses_local_search(self) -> None:
        result = CrewAILocalKnowledgeTool()._run("Salesforce API sync failed")

        self.assertIn("api-sync-troubleshooting", result)
        self.assertIn("retrieval_confidence", result)


if __name__ == "__main__":
    unittest.main()
