import type { AgentStep, HumanReviewState, ReviewPackage, RunHistoryItem, RunStatus, TicketInput } from "../types";

const API_BASE_URL = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

interface ApiRunRecord {
  run_id: string;
  status: "done" | "running" | "error";
  runtime_mode: string;
  updated_at: string;
  review_package?: ApiReviewPackage;
  observability_steps?: AgentStep[];
  human_review?: {
    status: HumanReviewState["status"];
    reviewer_notes: string;
    updated_at?: string | null;
  };
}

interface ApiReviewPackage {
  classification: { category: string; confidence: number; rationale: string };
  sentiment: { sentiment_label: string; urgency: string; risk_flags: string[] };
  retrieval: {
    sources: Array<{ source_id: string; title: string; snippet: string; relevance_score: number }>;
  };
  draft_response: {
    draft_text: string;
    source_ids: string[];
    sendable_after_human_review: boolean;
  };
  routing: { queue: string; rationale: string };
  escalation: { escalate: boolean; severity: string; target: string | null; reason: string };
  warnings: string[];
  human_approval_required: boolean;
  ready_for_human_review: boolean;
}

const toReviewPackage = (api: ApiReviewPackage): ReviewPackage => ({
  classification: {
    category: api.classification.category,
    confidence: api.classification.confidence,
    rationale: api.classification.rationale,
  },
  sentiment: {
    label: api.sentiment.sentiment_label,
    urgency: api.sentiment.urgency,
    riskFlags: api.sentiment.risk_flags,
  },
  retrievedSources: api.retrieval.sources.map((source) => ({
    sourceId: source.source_id,
    title: source.title,
    snippet: source.snippet,
    relevance: source.relevance_score,
  })),
  draftResponse: {
    text: api.draft_response.draft_text,
    sourceIds: api.draft_response.source_ids,
    humanReviewOnly: api.draft_response.sendable_after_human_review,
  },
  routingRecommendation: {
    queue: api.routing.queue,
    rationale: api.routing.rationale,
  },
  escalationRecommendation: {
    escalate: api.escalation.escalate,
    severity: api.escalation.severity,
    target: api.escalation.target ?? "none",
    reason: api.escalation.reason,
  },
  warnings: api.warnings,
  humanApprovalRequired: api.human_approval_required,
  readyForHumanReview: api.ready_for_human_review,
});

const toRunStatus = (api: ApiRunRecord): RunStatus => ({
  runId: api.run_id,
  status: api.status === "done" ? "done" : api.status,
  runtimeMode: api.runtime_mode,
  lastUpdated: api.updated_at,
  reviewPackage: api.review_package ? toReviewPackage(api.review_package) : undefined,
  observabilitySteps: api.observability_steps ?? [],
  humanReview: {
    status: api.human_review?.status ?? "pending",
    reviewerNotes: api.human_review?.reviewer_notes ?? "",
    updatedAt: api.human_review?.updated_at ?? null,
  },
});

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export async function startRun(ticket: TicketInput): Promise<RunStatus> {
  const payload = {
    customerId: ticket.customerId,
    companyName: ticket.companyName,
    planTier: ticket.planTier,
    productArea: ticket.productArea,
    subject: ticket.subject,
    message: ticket.message,
  };
  return toRunStatus(await request<ApiRunRecord>("/api/runs", { method: "POST", body: JSON.stringify(payload) }));
}

export async function getRunStatus(runId: string): Promise<RunStatus> {
  return toRunStatus(await request<ApiRunRecord>(`/api/runs/${runId}`));
}

export async function getRunHistory(): Promise<RunHistoryItem[]> {
  const response = await request<{
    runs: Array<{
      run_id: string;
      status: string;
      runtime_mode: string;
      subject: string;
      review_status: HumanReviewState["status"];
      created_at: string;
      updated_at: string;
    }>;
  }>("/api/runs");

  return response.runs.map((run) => ({
    runId: run.run_id,
    status: run.status,
    runtimeMode: run.runtime_mode,
    subject: run.subject,
    reviewStatus: run.review_status,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }));
}

export async function submitReview(
  runId: string,
  decision: HumanReviewState["status"],
  reviewerNotes: string,
): Promise<RunStatus> {
  return toRunStatus(
    await request<ApiRunRecord>(`/api/runs/${runId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, reviewerNotes }),
    }),
  );
}
