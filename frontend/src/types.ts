export type CrewStatus = "idle" | "running" | "done" | "error";
export type RuntimeMode = "deterministic" | "crewai_flow" | "crewai_llm";

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
  traceId: string;
  status: CrewStatus;
  runtimeMode: string;
  requestedRuntimeMode: RuntimeMode;
  actualRuntimeMode: string;
  runtimeStatus: "success" | "error";
  runtimeError?: string | null;
  reviewPackageParseStatus?: string;
  llmKickoffAttempted?: boolean;
  crewName?: string | null;
  process?: string | null;
  crewaiKickoffAttempted?: boolean;
  crewaiKickoffStatus?: "completed" | "error" | "not_configured" | "not_applicable";
  agentsUsed: string[];
  tasksUsed: string[];
  runtimeOutput?: RuntimeOutput | null;
  lastUpdated: string;
  reviewPackage?: ReviewPackage;
  observabilitySteps: AgentStep[];
  events: RunEvent[];
  metrics?: RunMetrics;
  observabilitySummary?: RunObservabilitySummary;
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
  traceId: string;
  status: string;
  runtimeMode: string;
  requestedRuntimeMode: RuntimeMode;
  actualRuntimeMode: string;
  runtimeStatus: "success" | "error";
  runtimeError?: string | null;
  subject: string;
  companyName?: string;
  escalated?: boolean;
  reviewStatus: HumanReviewState["status"];
  createdAt: string;
  updatedAt: string;
}

export interface RunEvent {
  eventId: string;
  runId: string;
  traceId: string;
  eventType:
    | "run_started"
    | "runtime_selected"
    | "runtime_started"
    | "runtime_completed"
    | "runtime_error"
    | "task_started"
    | "task_completed"
    | "tool_used"
    | "run_completed"
    | "review_submitted"
    | "error";
  timestamp: string;
  safeSummary: string;
  stepName?: string | null;
  durationMs?: number | null;
  metadata: Record<string, unknown>;
}

export interface RuntimeOutput {
  type: string;
  reviewPackageParseStatus?: string;
  outputText?: string;
  parseError?: string;
  humanApprovalRequired?: boolean;
  warnings?: string[];
  configurationWarnings?: string[];
}

export interface StepMetric {
  stepName: string;
  status: "completed" | "error";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface RunMetrics {
  runId: string;
  traceId: string;
  runtimeMode: string;
  status: CrewStatus;
  startedAt: string;
  finishedAt?: string | null;
  wallTimeMs?: number | null;
  stepMetrics: StepMetric[];
  slowestStep?: string | null;
  error?: string | null;
  tokenUsage?: Record<string, unknown> | null;
  costEstimate?: Record<string, unknown> | null;
}

export interface RunObservabilitySummary {
  runId: string;
  traceId: string;
  runtimeMode: string;
  status: CrewStatus;
  startedAt: string;
  finishedAt?: string | null;
  wallTimeMs?: number | null;
  slowestStep?: string | null;
  eventCount: number;
  error?: string | null;
}

export interface ObservabilityAggregateSummary {
  totalRuns: number;
  completedRuns: number;
  errorRuns: number;
  averageWallTimeMs?: number | null;
  latestRunId?: string | null;
  deterministicModeRuns: number;
  crewaiFlowModeRuns?: number;
  llmModeRuns: number;
}
