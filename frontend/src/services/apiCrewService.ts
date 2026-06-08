import type {
  AgentStep,
  HumanReviewState,
  ObservabilityAggregateSummary,
  ReviewPackage,
  RuntimeMode,
  RuntimeOutput,
  RunEvent,
  RunHistoryItem,
  RunMetrics,
  RunObservabilitySummary,
  RunStatus,
  TicketInput,
} from "../types";

const API_BASE_URL = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

interface ApiRunRecord {
  run_id: string;
  trace_id?: string;
  status: "done" | "running" | "error";
  runtime_mode: string;
  requested_runtime_mode?: RuntimeMode;
  actual_runtime_mode?: string;
  runtime_status?: "success" | "error";
  runtime_error?: string | null;
  review_package_parse_status?: string;
  llm_kickoff_attempted?: boolean;
  runtime_output?: ApiRuntimeOutput | null;
  updated_at: string;
  review_package?: ApiReviewPackage;
  observability_steps?: AgentStep[];
  events?: ApiRunEvent[];
  metrics?: ApiRunMetrics;
  observability_summary?: ApiRunObservabilitySummary;
  human_review?: {
    status: HumanReviewState["status"];
    reviewer_notes: string;
    updated_at?: string | null;
  };
}

interface ApiRuntimeOutput {
  type: string;
  review_package_parse_status?: string;
  output_text?: string;
  human_approval_required?: boolean;
  warnings?: string[];
  configuration_warnings?: string[];
}

interface ApiRunEvent {
  event_id: string;
  run_id: string;
  trace_id: string;
  event_type: RunEvent["eventType"];
  timestamp: string;
  safe_summary: string;
  step_name?: string | null;
  duration_ms?: number | null;
  metadata?: Record<string, unknown>;
}

interface ApiStepMetric {
  step_name: string;
  status: "completed" | "error";
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

interface ApiRunMetrics {
  run_id: string;
  trace_id: string;
  runtime_mode: string;
  status: "done" | "running" | "error";
  started_at: string;
  finished_at?: string | null;
  wall_time_ms?: number | null;
  step_metrics?: ApiStepMetric[];
  slowest_step?: string | null;
  error?: string | null;
  token_usage?: Record<string, unknown> | null;
  cost_estimate?: Record<string, unknown> | null;
}

interface ApiRunObservabilitySummary {
  run_id: string;
  trace_id: string;
  runtime_mode: string;
  status: "done" | "running" | "error";
  started_at: string;
  finished_at?: string | null;
  wall_time_ms?: number | null;
  slowest_step?: string | null;
  event_count: number;
  error?: string | null;
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

const toRunEvent = (api: ApiRunEvent): RunEvent => ({
  eventId: api.event_id,
  runId: api.run_id,
  traceId: api.trace_id,
  eventType: api.event_type,
  timestamp: api.timestamp,
  safeSummary: api.safe_summary,
  stepName: api.step_name ?? null,
  durationMs: api.duration_ms ?? null,
  metadata: api.metadata ?? {},
});

const toRunMetrics = (api: ApiRunMetrics): RunMetrics => ({
  runId: api.run_id,
  traceId: api.trace_id,
  runtimeMode: api.runtime_mode,
  status: api.status === "done" ? "done" : api.status,
  startedAt: api.started_at,
  finishedAt: api.finished_at ?? null,
  wallTimeMs: api.wall_time_ms ?? null,
  stepMetrics: (api.step_metrics ?? []).map((step) => ({
    stepName: step.step_name,
    status: step.status,
    startedAt: step.started_at,
    finishedAt: step.finished_at,
    durationMs: step.duration_ms,
  })),
  slowestStep: api.slowest_step ?? null,
  error: api.error ?? null,
  tokenUsage: api.token_usage ?? null,
  costEstimate: api.cost_estimate ?? null,
});

const toRunObservabilitySummary = (api: ApiRunObservabilitySummary): RunObservabilitySummary => ({
  runId: api.run_id,
  traceId: api.trace_id,
  runtimeMode: api.runtime_mode,
  status: api.status === "done" ? "done" : api.status,
  startedAt: api.started_at,
  finishedAt: api.finished_at ?? null,
  wallTimeMs: api.wall_time_ms ?? null,
  slowestStep: api.slowest_step ?? null,
  eventCount: api.event_count,
  error: api.error ?? null,
});

const toRuntimeOutput = (api: ApiRuntimeOutput): RuntimeOutput => ({
  type: api.type,
  reviewPackageParseStatus: api.review_package_parse_status,
  outputText: api.output_text,
  humanApprovalRequired: api.human_approval_required,
  warnings: api.warnings,
  configurationWarnings: api.configuration_warnings,
});

const toRunStatus = (api: ApiRunRecord): RunStatus => ({
  runId: api.run_id,
  traceId: api.trace_id ?? api.run_id,
  status: api.status === "done" ? "done" : api.status,
  runtimeMode: api.runtime_mode,
  requestedRuntimeMode: api.requested_runtime_mode ?? (api.runtime_mode as RuntimeMode),
  actualRuntimeMode: api.actual_runtime_mode ?? api.runtime_mode,
  runtimeStatus: api.runtime_status ?? (api.status === "done" ? "success" : "error"),
  runtimeError: api.runtime_error ?? null,
  reviewPackageParseStatus: api.review_package_parse_status,
  llmKickoffAttempted: api.llm_kickoff_attempted ?? false,
  runtimeOutput: api.runtime_output ? toRuntimeOutput(api.runtime_output) : null,
  lastUpdated: api.updated_at,
  reviewPackage: api.review_package ? toReviewPackage(api.review_package) : undefined,
  observabilitySteps: api.observability_steps ?? [],
  events: (api.events ?? []).map(toRunEvent),
  metrics: api.metrics ? toRunMetrics(api.metrics) : undefined,
  observabilitySummary: api.observability_summary ? toRunObservabilitySummary(api.observability_summary) : undefined,
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

export async function startRun(ticket: TicketInput, runtimeMode: RuntimeMode = "deterministic"): Promise<RunStatus> {
  const payload = {
    customerId: ticket.customerId,
    companyName: ticket.companyName,
    planTier: ticket.planTier,
    productArea: ticket.productArea,
    subject: ticket.subject,
    message: ticket.message,
    runtimeMode,
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
      trace_id?: string;
      status: string;
      runtime_mode: string;
      requested_runtime_mode?: RuntimeMode;
      actual_runtime_mode?: string;
      runtime_status?: "success" | "error";
      runtime_error?: string | null;
      subject: string;
      review_status: HumanReviewState["status"];
      created_at: string;
      updated_at: string;
    }>;
  }>("/api/runs");

  return response.runs.map((run) => ({
    runId: run.run_id,
    traceId: run.trace_id ?? run.run_id,
    status: run.status,
    runtimeMode: run.runtime_mode,
    requestedRuntimeMode: run.requested_runtime_mode ?? (run.runtime_mode as RuntimeMode),
    actualRuntimeMode: run.actual_runtime_mode ?? run.runtime_mode,
    runtimeStatus: run.runtime_status ?? (run.status === "done" ? "success" : "error"),
    runtimeError: run.runtime_error ?? null,
    subject: run.subject,
    reviewStatus: run.review_status,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }));
}

export async function getRunEvents(runId: string): Promise<RunEvent[]> {
  return (await request<ApiRunEvent[]>(`/api/runs/${runId}/events-json`)).map(toRunEvent);
}

export async function getRunMetrics(runId: string): Promise<RunMetrics> {
  return toRunMetrics(await request<ApiRunMetrics>(`/api/runs/${runId}/metrics`));
}

export async function getObservabilitySummary(): Promise<ObservabilityAggregateSummary> {
  const response = await request<{
    total_runs: number;
    completed_runs: number;
    error_runs: number;
    average_wall_time_ms?: number | null;
    latest_run_id?: string | null;
    deterministic_mode_runs: number;
    crewai_flow_mode_runs?: number;
    llm_mode_runs: number;
  }>("/api/observability/summary");
  return {
    totalRuns: response.total_runs,
    completedRuns: response.completed_runs,
    errorRuns: response.error_runs,
    averageWallTimeMs: response.average_wall_time_ms ?? null,
    latestRunId: response.latest_run_id ?? null,
    deterministicModeRuns: response.deterministic_mode_runs,
    crewaiFlowModeRuns: response.crewai_flow_mode_runs ?? 0,
    llmModeRuns: response.llm_mode_runs,
  };
}

export function subscribeRunEvents(runId: string, onEvents: (events: RunEvent[]) => void, onError: () => void): () => void {
  if (typeof EventSource === "undefined") {
    onError();
    return () => undefined;
  }

  const source = new EventSource(`${API_BASE_URL}/api/runs/${runId}/events`);
  const events: RunEvent[] = [];

  const handleMessage = (message: MessageEvent) => {
    try {
      const event = toRunEvent(JSON.parse(message.data) as ApiRunEvent);
      events.push(event);
      onEvents([...events]);
      if (event.eventType === "run_completed" || event.eventType === "error") {
        source.close();
      }
    } catch {
      onError();
      source.close();
    }
  };

  [
    "run_started",
    "runtime_selected",
    "runtime_started",
    "runtime_completed",
    "runtime_error",
    "task_started",
    "task_completed",
    "tool_used",
    "run_completed",
    "review_submitted",
    "error",
  ].forEach((eventType) => source.addEventListener(eventType, handleMessage));

  source.onmessage = handleMessage;
  source.onerror = () => {
    onError();
    source.close();
  };

  return () => source.close();
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
