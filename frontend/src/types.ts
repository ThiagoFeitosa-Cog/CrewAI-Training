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
}

export interface RunStatus {
  runId: string;
  status: CrewStatus;
  lastUpdated: string;
  reviewPackage?: ReviewPackage;
  errorMessage?: string;
}

