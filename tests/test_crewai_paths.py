from __future__ import annotations

import io
import os
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

from customer_support_crew.crewai_flow import (
    CREWAI_FLOW_AVAILABLE,
    CustomerSupportCrewFlow,
    CustomerSupportCrewFlowFallback,
    run_customer_support_flow,
)
from customer_support_crew.crewai_main import main as crewai_main
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
        with patch.dict(os.environ, {}, clear=True), redirect_stdout(output):
            exit_code = crewai_main()

        self.assertEqual(exit_code, 0)
        text = output.getvalue()
        self.assertIn("OPENAI_API_KEY is not set", text)
        self.assertIn("customer_support_crew.main", text)
        self.assertIn("customer_support_crew.crewai_flow", text)

    def test_crewai_local_knowledge_tool_uses_local_search(self) -> None:
        result = CrewAILocalKnowledgeTool()._run("Salesforce API sync failed")

        self.assertIn("api-sync-troubleshooting", result)
        self.assertIn("retrieval_confidence", result)


if __name__ == "__main__":
    unittest.main()
