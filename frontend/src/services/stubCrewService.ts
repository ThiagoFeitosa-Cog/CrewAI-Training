import type { ReviewPackage, RunStatus, TicketInput } from "../types";

const MOCK_RUN_ID = "mock-run-001";

const mockReviewPackage: ReviewPackage = {
  classification: {
    category: "technical_support",
    confidence: 0.82,
    rationale: "The ticket mentions API sync failure and blocked revenue workflow.",
  },
  sentiment: {
    label: "high_risk",
    urgency: "critical",
    riskFlags: ["urgent_language", "frustration", "renewal_risk"],
  },
  retrievedSources: [
    {
      sourceId: "api-sync-troubleshooting",
      title: "API Sync Troubleshooting",
      snippet: "Confirm affected integration, latest sync timestamp, auth status, and recent error messages.",
      relevance: 1,
    },
    {
      sourceId: "renewal-risk-escalation",
      title: "Renewal Risk Escalation",
      snippet: "Renewal risk or repeated unresolved issues should be reviewed by Customer Success.",
      relevance: 0.84,
    },
  ],
  draftResponse: {
    text:
      "Hi, thanks for reaching out. We understand the Salesforce sync issue is blocking your revenue team. " +
      "A support agent will verify the integration status, latest sync timestamp, and recent error details before responding.",
    sourceIds: ["api-sync-troubleshooting", "renewal-risk-escalation"],
    humanReviewOnly: true,
  },
  routingRecommendation: {
    queue: "technical_support",
    rationale: "API sync failures should be reviewed by Technical Support.",
  },
  escalationRecommendation: {
    escalate: true,
    severity: "P1",
    target: "customer_success_manager",
    reason: "Enterprise customer, repeated failure, frustration, and renewal risk.",
  },
  warnings: [
    "Human approval is required before sending any response.",
    "Escalation recommended: P1.",
    "Draft is for human review only and has not been sent.",
  ],
  humanApprovalRequired: true,
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function startRun(ticket: TicketInput): Promise<RunStatus> {
  if (!ticket.subject.trim() || !ticket.message.trim()) {
    throw new Error("Subject and message are required before running the crew.");
  }

  await delay(250);

  return {
    runId: MOCK_RUN_ID,
    status: "running",
    lastUpdated: new Date().toISOString(),
  };
}

export async function getRunStatus(runId: string): Promise<RunStatus> {
  await delay(700);

  return {
    runId,
    status: "done",
    lastUpdated: new Date().toISOString(),
    reviewPackage: mockReviewPackage,
  };
}

