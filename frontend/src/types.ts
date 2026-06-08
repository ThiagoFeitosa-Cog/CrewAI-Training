export type CrewStatus = "idle" | "running" | "done" | "error";

export interface TicketInput {
  customerId: string;
  companyName: string;
  planTier: string;
  productArea: string;
  subject: string;
  message: string;
}

export interface RetrievedSource {
  sourceId: string;
  title: string;
  snippet: string;
  relevance: number;
}

export interface ReviewPackage {
  classification: {
    category: string;
    confidence: number;
    rationale: string;
  };
  sentiment: {
    label: string;
    urgency: string;
    riskFlags: string[];
  };
  retrievedSources: RetrievedSource[];
  draftResponse: {
    text: string;
    sourceIds: string[];
    humanReviewOnly: boolean;
  };
  routingRecommendation: {
    queue: string;
    rationale: string;
  };
  escalationRecommendation: {
    escalate: boolean;
    severity: string;
    target: string;
    reason: string;
  };
  warnings: string[];
  humanApprovalRequired: boolean;
  readyForHumanReview: boolean;
}

export interface RunStatus {
  runId: string;
  status: CrewStatus;
  runtimeMode: string;
  lastUpdated: string;
  reviewPackage?: ReviewPackage;
  observabilitySteps: AgentStep[];
  humanReview: HumanReviewState;
  errorMessage?: string;
}

export interface AgentStep {
  name: string;
  status: "pending" | "running" | "completed" | "error";
  summary: string;
  timestamp: string;
}

export interface HumanReviewState {
  status: "pending" | "approved" | "rejected" | "needs_changes";
  reviewerNotes: string;
  updatedAt?: string | null;
}

export interface RunHistoryItem {
  runId: string;
  status: string;
  runtimeMode: string;
  subject: string;
  reviewStatus: HumanReviewState["status"];
  createdAt: string;
  updatedAt: string;
}
