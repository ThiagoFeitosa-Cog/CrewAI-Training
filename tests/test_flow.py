from pathlib import Path
import unittest

from pydantic import ValidationError

from customer_support_crew.flow import CustomerSupportFlow
from customer_support_crew.models import ClassificationResult


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FIXTURE = PROJECT_ROOT / "data" / "fixtures" / "sample_ticket.json"
KNOWLEDGE_BASE = PROJECT_ROOT / "knowledge_base" / "support_kb.md"


class CustomerSupportFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.flow = CustomerSupportFlow(KNOWLEDGE_BASE)
        self.ticket = self.flow.load_ticket(FIXTURE)

    def test_fixture_validates_as_support_ticket(self) -> None:
        self.assertEqual(self.ticket.ticket_id, "TCK-1001")
        self.assertEqual(self.ticket.customer_metadata.company_name, "Northstar Analytics")
        self.assertEqual(self.ticket.customer_metadata.risk_level, "high")

    def test_review_package_contains_human_review_checkpoint(self) -> None:
        review = self.flow.run(self.ticket)

        self.assertTrue(review.human_approval_required)
        self.assertTrue(review.ready_for_human_review)
        self.assertEqual(review.classification.category, "technical_support")
        self.assertEqual(review.routing.queue, "technical_support")
        self.assertTrue(review.escalation.escalate)
        self.assertEqual(review.escalation.severity, "P1")
        self.assertTrue(review.retrieval.sources)
        self.assertIn("Human approval is required before sending any response.", review.warnings)

    def test_confidence_values_are_constrained(self) -> None:
        with self.assertRaises(ValidationError):
            ClassificationResult(
                category="technical_support",
                intent="Invalid confidence test",
                confidence=1.5,
                rationale="Confidence must be between 0 and 1.",
            )

    def test_local_knowledge_search_returns_expected_source(self) -> None:
        result = self.flow.knowledge_tool.search("Salesforce API sync failed")
        source_ids = [source.source_id for source in result.sources]

        self.assertFalse(result.missing_knowledge)
        self.assertIn("api-sync-troubleshooting", source_ids)


if __name__ == "__main__":
    unittest.main()

