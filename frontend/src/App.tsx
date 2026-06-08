import {
  AlertTriangle,
  BarChart3,
  FileText,
  History,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  getObservabilitySummary,
  getRunHistory,
  getRunStatus,
  startRun,
  submitReview,
  subscribeRunEvents,
} from "./services/apiCrewService";
import type {
  CrewStatus,
  HumanReviewState,
  ObservabilityAggregateSummary,
  ReviewPackage,
  RuntimeMode,
  RunHistoryItem,
  RunStatus,
  TicketInput,
} from "./types";
import "./styles.css";

type AppView = "dashboard" | "new-run" | "run-details" | "history";
type HistoryFilter = "all" | "pending" | "approved" | "rejected" | "escalated";

const seededTicket: TicketInput = {
  customerId: "CUST-2048",
  companyName: "Northstar Analytics",
  planTier: "Enterprise",
  productArea: "Integrations",
  subject: "Urgent: API sync failed again before our renewal review",
  message:
    "Our Salesforce sync failed again this morning and our revenue team cannot work. This is the third time this month and leadership is frustrated. We need this fixed ASAP before our renewal review next week.",
};

const runtimeLabels: Record<RuntimeMode | string, string> = {
  deterministic: "Local deterministic",
  crewai_flow: "CrewAI Flow",
  crewai_flow_fallback: "CrewAI Flow fallback",
  crewai_llm: "CrewAI LLM",
};

const runtimeOptions: Array<{ value: RuntimeMode; label: string }> = [
  { value: "deterministic", label: "Local deterministic" },
  { value: "crewai_flow", label: "CrewAI Flow" },
  { value: "crewai_llm", label: "CrewAI LLM" },
];

function App() {
  const [view, setView] = useState<AppView>("dashboard");
  const [ticket, setTicket] = useState<TicketInput>(seededTicket);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("deterministic");
  const [status, setStatus] = useState<CrewStatus>("idle");
  const [latestRun, setLatestRun] = useState<RunStatus | null>(null);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [observabilitySummary, setObservabilitySummary] = useState<ObservabilityAggregateSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewDecision, setReviewDecision] = useState<HumanReviewState["status"]>("approved");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  const refreshDashboardData = async () => {
    const [runs, summary] = await Promise.all([getRunHistory(), getObservabilitySummary()]);
    setHistory(runs);
    setObservabilitySummary(summary);
  };

  useEffect(() => {
    void refreshDashboardData().catch(() => undefined);
  }, []);

  const applyRun = (run: RunStatus) => {
    setLatestRun(run);
    setStatus(run.status);
    setReviewerNotes(run.humanReview.reviewerNotes);
    setErrorMessage(run.runtimeError ?? run.errorMessage ?? "");
  };

  const runAnalysis = async () => {
    try {
      setErrorMessage("");
      setStatus("running");
      const started = await startRun(ticket, runtimeMode);
      applyRun(started);

      if (started.status === "error") {
        setView("run-details");
        await refreshDashboardData();
        return;
      }

      const unsubscribe = subscribeRunEvents(
        started.runId,
        (events) => setLatestRun((current) => (current ? { ...current, events } : current)),
        () => undefined,
      );
      const completed = await getRunStatus(started.runId);
      unsubscribe();
      applyRun(completed);
      setView("run-details");
      await refreshDashboardData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The crew run failed.";
      setStatus("error");
      setErrorMessage(message);
      setLatestRun({
        runId: latestRun?.runId ?? "not-started",
        traceId: latestRun?.traceId ?? "not-started",
        status: "error",
        runtimeMode,
        requestedRuntimeMode: runtimeMode,
        actualRuntimeMode: runtimeMode,
        runtimeStatus: "error",
        runtimeError: message,
        lastUpdated: new Date().toISOString(),
        observabilitySteps: [],
        events: [],
        humanReview: { status: "pending", reviewerNotes: "", updatedAt: null },
        errorMessage: message,
      });
      setView("run-details");
    }
  };

  const loadRunDetails = async (runId: string) => {
    const run = await getRunStatus(runId);
    applyRun(run);
    setView("run-details");
  };

  const submitHumanReview = async () => {
    if (!latestRun) return;
    const reviewed = await submitReview(latestRun.runId, reviewDecision, reviewerNotes);
    applyRun(reviewed);
    await refreshDashboardData();
  };

  const resetForm = () => {
    setTicket(seededTicket);
    setRuntimeMode("deterministic");
    setStatus("idle");
    setErrorMessage("");
  };

  const updateTicket = (field: keyof TicketInput, value: string) => {
    setTicket((current) => ({ ...current, [field]: value }));
  };

  return (
    <main className="app-shell">
      <TopNav currentView={view} onNavigate={setView} />

      {view === "dashboard" && (
        <DashboardView
          history={history}
          summary={observabilitySummary}
          latestRun={latestRun}
          onStart={() => setView("new-run")}
          onOpenRun={(runId) => void loadRunDetails(runId)}
        />
      )}

      {view === "new-run" && (
        <NewRunView
          ticket={ticket}
          runtimeMode={runtimeMode}
          status={status}
          errorMessage={errorMessage}
          onTicketChange={updateTicket}
          onRuntimeChange={setRuntimeMode}
          onRun={() => void runAnalysis()}
          onReset={resetForm}
        />
      )}

      {view === "run-details" && latestRun && (
        <RunDetailsView
          run={latestRun}
          reviewDecision={reviewDecision}
          reviewerNotes={reviewerNotes}
          onReviewDecisionChange={setReviewDecision}
          onReviewerNotesChange={setReviewerNotes}
          onSubmitReview={() => void submitHumanReview()}
          onRetry={() => void runAnalysis()}
        />
      )}

      {view === "run-details" && !latestRun && (
        <EmptyState title="No run selected" body="Start a new support run or open one from history." action="Start New Support Run" onAction={() => setView("new-run")} />
      )}

      {view === "history" && (
        <HistoryView
          history={history}
          filter={historyFilter}
          onFilterChange={setHistoryFilter}
          onOpenRun={(runId) => void loadRunDetails(runId)}
        />
      )}
    </main>
  );
}

function TopNav({ currentView, onNavigate }: { currentView: AppView; onNavigate: (view: AppView) => void }) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Multi-Agent Customer Support Crew</p>
        <h1>Support Operations Console</h1>
      </div>
      <nav className="top-nav" aria-label="Primary navigation">
        <button className={currentView === "dashboard" ? "nav-active" : "secondary"} onClick={() => onNavigate("dashboard")}>
          <BarChart3 aria-hidden="true" />
          Dashboard
        </button>
        <button className={currentView === "new-run" ? "nav-active" : "secondary"} onClick={() => onNavigate("new-run")}>
          <Send aria-hidden="true" />
          New Run
        </button>
        <button className={currentView === "history" ? "nav-active" : "secondary"} onClick={() => onNavigate("history")}>
          <History aria-hidden="true" />
          History
        </button>
      </nav>
    </header>
  );
}

function DashboardView({
  history,
  summary,
  latestRun,
  onStart,
  onOpenRun,
}: {
  history: RunHistoryItem[];
  summary: ObservabilityAggregateSummary | null;
  latestRun: RunStatus | null;
  onStart: () => void;
  onOpenRun: (runId: string) => void;
}) {
  const pendingReviews = history.filter((run) => run.reviewStatus === "pending").length;
  const escalatedCases = history.filter((run) => run.escalated).length;
  const latest = history[0];

  return (
    <section className="view-stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Presentation-ready MVP</p>
          <h2>AI-assisted support review, with every customer response held for human approval.</h2>
          <p>
            Process one ticket, inspect specialist agent outputs, and approve or reject the draft before anything reaches a customer.
          </p>
        </div>
        <button onClick={onStart}>
          <Send aria-hidden="true" />
          Start New Support Run
        </button>
      </div>

      <div className="metric-grid dashboard-metrics">
        <Metric label="Total runs" value={summary?.totalRuns ?? history.length} />
        <Metric label="Pending reviews" value={pendingReviews} />
        <Metric label="Escalated cases" value={escalatedCases} />
        <Metric label="Average runtime" value={formatDuration(summary?.averageWallTimeMs)} />
        <Metric label="Latest status" value={latestRun?.status ?? latest?.status ?? "none"} />
      </div>

      <section className="panel">
        <SectionHeader title="Recent Runs" subtitle="Latest support analyses and human review state." />
        <RunsTable runs={history.slice(0, 6)} onOpenRun={onOpenRun} />
      </section>
    </section>
  );
}

function NewRunView({
  ticket,
  runtimeMode,
  status,
  errorMessage,
  onTicketChange,
  onRuntimeChange,
  onRun,
  onReset,
}: {
  ticket: TicketInput;
  runtimeMode: RuntimeMode;
  status: CrewStatus;
  errorMessage: string;
  onTicketChange: (field: keyof TicketInput, value: string) => void;
  onRuntimeChange: (mode: RuntimeMode) => void;
  onRun: () => void;
  onReset: () => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRun();
  };

  return (
    <section className="view-stack narrow-view">
      <div className="page-title">
        <p className="eyebrow">New Support Run</p>
        <h2>Start a focused ticket analysis</h2>
        <p>Use the seeded example or enter a real support ticket. Local deterministic mode is safest for demos.</p>
      </div>

      <section className="panel">
        <form className="ticket-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label>
              Customer ID
              <input value={ticket.customerId} onChange={(event) => onTicketChange("customerId", event.target.value)} />
            </label>
            <label>
              Company Name
              <input value={ticket.companyName} onChange={(event) => onTicketChange("companyName", event.target.value)} />
            </label>
            <label>
              Plan Tier
              <input value={ticket.planTier} onChange={(event) => onTicketChange("planTier", event.target.value)} />
            </label>
            <label>
              Product Area
              <input value={ticket.productArea} onChange={(event) => onTicketChange("productArea", event.target.value)} />
            </label>
          </div>
          <label>
            Subject
            <input value={ticket.subject} onChange={(event) => onTicketChange("subject", event.target.value)} required />
          </label>
          <label>
            Message
            <textarea value={ticket.message} onChange={(event) => onTicketChange("message", event.target.value)} required />
          </label>
          <label>
            Runtime Mode
            <select value={runtimeMode} onChange={(event) => onRuntimeChange(event.target.value as RuntimeMode)}>
              {runtimeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {status === "error" && <p className="inline-error">{errorMessage}</p>}
          <div className="button-row">
            <button type="submit" disabled={status === "running"}>
              <Send aria-hidden="true" />
              {status === "running" ? "Running analysis" : "Run Analysis"}
            </button>
            <button type="button" className="secondary" onClick={onReset}>
              <RotateCcw aria-hidden="true" />
              Reset
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

function RunDetailsView({
  run,
  reviewDecision,
  reviewerNotes,
  onReviewDecisionChange,
  onReviewerNotesChange,
  onSubmitReview,
  onRetry,
}: {
  run: RunStatus;
  reviewDecision: HumanReviewState["status"];
  reviewerNotes: string;
  onReviewDecisionChange: (decision: HumanReviewState["status"]) => void;
  onReviewerNotesChange: (notes: string) => void;
  onSubmitReview: () => void;
  onRetry: () => void;
}) {
  const reviewPackage = run.reviewPackage;
  const action = recommendedAction(run);

  return (
    <section className="view-stack">
      <div className="details-header">
        <div>
          <p className="eyebrow">Run Details</p>
          <h2>{reviewPackage?.classification.category ?? "Runtime output"}</h2>
          <p>{run.runId}</p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <section className="panel detail-summary">
        <div>
          <h3>Executive Summary</h3>
          <p className="summary-action">{action.title}</p>
          <p>{action.reason}</p>
        </div>
        <div className="summary-meta">
          <Metric label="Requested runtime" value={runtimeLabels[run.requestedRuntimeMode] ?? run.requestedRuntimeMode} />
          <Metric label="Actual runtime" value={runtimeLabels[run.actualRuntimeMode] ?? run.actualRuntimeMode} />
          <Metric label="Escalation" value={reviewPackage?.escalationRecommendation.escalate ? "Required" : "Not required"} />
        </div>
      </section>

      <section className="panel">
        <SectionHeader title="Run Metadata" subtitle="Operational correlation and runtime state." />
        <div className="metadata-grid">
          <MetaItem label="Run ID" value={run.runId} />
          <MetaItem label="Status" value={run.status} />
          <MetaItem label="Requested runtime" value={runtimeLabels[run.requestedRuntimeMode] ?? run.requestedRuntimeMode} />
          <MetaItem label="Actual runtime" value={runtimeLabels[run.actualRuntimeMode] ?? run.actualRuntimeMode} />
          <MetaItem label="Trace ID" value={run.traceId} />
          <MetaItem label="Last updated" value={new Date(run.lastUpdated).toLocaleString()} />
        </div>
        {run.runtimeError && <p className="inline-error">{run.runtimeError}</p>}
        {run.status === "error" && (
          <button className="secondary" onClick={onRetry}>
            Retry
          </button>
        )}
      </section>

      {reviewPackage ? <AgentResults reviewPackage={reviewPackage} /> : <RuntimeOutput run={run} />}

      <section className="panel">
        <SectionHeader title="Human Review" subtitle="The draft is not sent until a person approves it." />
        <div className="review-controls">
          <p className="approval-note">
            Saved review status: <strong>{run.humanReview.status}</strong>
          </p>
          <label>
            Decision
            <select value={reviewDecision} onChange={(event) => onReviewDecisionChange(event.target.value as HumanReviewState["status"])}>
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
              <option value="needs_changes">Needs changes</option>
            </select>
          </label>
          <label>
            Reviewer notes
            <textarea value={reviewerNotes} onChange={(event) => onReviewerNotesChange(event.target.value)} />
          </label>
          <button onClick={onSubmitReview}>
            <Save aria-hidden="true" />
            Submit review decision
          </button>
        </div>
      </section>

      <ObservabilityPanel run={run} />
    </section>
  );
}

function AgentResults({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  return (
    <section className="panel">
      <SectionHeader title="Agent Results" subtitle="Specialist outputs organized for review." />
      <div className="agent-grid">
        <ResultCard title="Classification" value={reviewPackage.classification.category} detail={reviewPackage.classification.rationale} />
        <ResultCard
          title="Sentiment"
          value={`${reviewPackage.sentiment.label} / ${reviewPackage.sentiment.urgency}`}
          detail={reviewPackage.sentiment.riskFlags.join(", ") || "No risk flags"}
        />
        <ResultCard
          title="Knowledge Retrieval"
          value={`${reviewPackage.retrievedSources.length} source(s)`}
          detail={reviewPackage.retrievedSources.map((source) => source.title).join(", ")}
        />
        <ResultCard title="Draft Response" value="Human review only" detail={reviewPackage.draftResponse.text} wide />
        <ResultCard title="Routing" value={reviewPackage.routingRecommendation.queue} detail={reviewPackage.routingRecommendation.rationale} />
        <ResultCard
          title="Escalation"
          value={`${reviewPackage.escalationRecommendation.escalate ? "Escalate" : "No escalation"} · ${reviewPackage.escalationRecommendation.severity}`}
          detail={reviewPackage.escalationRecommendation.reason}
        />
      </div>
      {reviewPackage.warnings.length > 0 && (
        <div className="warning-strip">
          <AlertTriangle aria-hidden="true" />
          <span>{reviewPackage.warnings.join(" ")}</span>
        </div>
      )}
    </section>
  );
}

function RuntimeOutput({ run }: { run: RunStatus }) {
  return (
    <section className="panel">
      <SectionHeader title="CrewAI Runtime Output" subtitle="Live LLM output is preserved for human review." />
      <p className="approval-note">This output has not been sent to the customer.</p>
      <pre className="runtime-output-text">{run.runtimeOutput?.outputText ?? run.runtimeError ?? "No runtime output available."}</pre>
    </section>
  );
}

function ObservabilityPanel({ run }: { run: RunStatus }) {
  return (
    <section className="panel subdued-panel">
      <SectionHeader title="Observability" subtitle="Runtime events and performance are available for debugging." />
      <div className="observability-layout">
        <div>
          <h3>Agent Activity</h3>
          <Timeline items={run.observabilitySteps.map((step) => ({ title: step.name, body: step.summary, meta: step.status }))} />
        </div>
        <div>
          <h3>Runtime Events</h3>
          <Timeline
            items={run.events.map((event) => ({
              title: event.eventType.replace(/_/g, " "),
              body: event.safeSummary,
              meta: event.durationMs ? formatDuration(event.durationMs) : new Date(event.timestamp).toLocaleTimeString(),
            }))}
          />
        </div>
        <div>
          <h3>Performance</h3>
          <div className="metric-grid compact-metrics">
            <Metric label="Wall time" value={formatDuration(run.metrics?.wallTimeMs)} />
            <Metric label="Slowest step" value={run.metrics?.slowestStep ?? "n/a"} />
            <Metric label="Token usage" value={run.metrics?.tokenUsage ? "Available" : "Not available"} />
            <Metric label="Cost estimate" value={run.metrics?.costEstimate ? "Available" : "Not available"} />
          </div>
          <Timeline
            items={(run.metrics?.stepMetrics ?? []).map((step) => ({
              title: step.stepName,
              body: step.status,
              meta: formatDuration(step.durationMs),
            }))}
          />
        </div>
      </div>
    </section>
  );
}

function HistoryView({
  history,
  filter,
  onFilterChange,
  onOpenRun,
}: {
  history: RunHistoryItem[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onOpenRun: (runId: string) => void;
}) {
  const filtered = history.filter((run) => {
    if (filter === "all") return true;
    if (filter === "pending") return run.reviewStatus === "pending";
    if (filter === "approved") return run.reviewStatus === "approved";
    if (filter === "rejected") return run.reviewStatus === "rejected";
    return Boolean(run.escalated);
  });

  return (
    <section className="view-stack">
      <div className="page-title">
        <p className="eyebrow">History / Reviews</p>
        <h2>Review queue and completed runs</h2>
      </div>
      <div className="filter-row">
        {(["all", "pending", "approved", "rejected", "escalated"] as HistoryFilter[]).map((item) => (
          <button key={item} className={filter === item ? "nav-active" : "secondary"} onClick={() => onFilterChange(item)}>
            {filterLabel(item)}
          </button>
        ))}
      </div>
      <section className="panel">
        <RunsTable runs={filtered} onOpenRun={onOpenRun} />
      </section>
    </section>
  );
}

function RunsTable({ runs, onOpenRun }: { runs: RunHistoryItem[]; onOpenRun: (runId: string) => void }) {
  if (!runs.length) {
    return <p>No runs match this view.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Subject</th>
            <th>Company</th>
            <th>Runtime</th>
            <th>Status</th>
            <th>Review Status</th>
            <th>Escalated</th>
            <th>Updated At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.runId}>
              <td className="mono-cell">{shortId(run.runId)}</td>
              <td>{run.subject}</td>
              <td>{run.companyName ?? "Unknown"}</td>
              <td>{runtimeLabels[run.actualRuntimeMode] ?? run.actualRuntimeMode}</td>
              <td>
                <StatusBadge status={run.status as CrewStatus} />
              </td>
              <td>{run.reviewStatus}</td>
              <td>{run.escalated ? "Yes" : "No"}</td>
              <td>{new Date(run.updatedAt).toLocaleString()}</td>
              <td>
                <button className="secondary small-button" onClick={() => onOpenRun(run.runId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({ title, value, detail, wide = false }: { title: string; value: string; detail: string; wide?: boolean }) {
  return (
    <article className={wide ? "result-card wide-result" : "result-card"}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Timeline({ items }: { items: Array<{ title: string; body: string; meta: string }> }) {
  if (!items.length) return <p className="muted-text">No events recorded for this run.</p>;
  return (
    <ol className="timeline-list">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`}>
          <strong>{item.title.replace(/_/g, " ")}</strong>
          <p>{item.body}</p>
          <small>{item.meta}</small>
        </li>
      ))}
    </ol>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return (
    <section className="panel empty-state">
      <FileText aria-hidden="true" />
      <h2>{title}</h2>
      <p>{body}</p>
      <button onClick={onAction}>{action}</button>
    </section>
  );
}

function StatusBadge({ status }: { status: CrewStatus | string }) {
  return <span className={`status-badge status-badge-${status}`}>{status}</span>;
}

function recommendedAction(run: RunStatus) {
  if (run.status === "error") {
    return { title: "Review runtime configuration", reason: run.runtimeError ?? "The selected runtime returned an error." };
  }
  if (run.reviewPackage?.escalationRecommendation.escalate) {
    return { title: "Escalate and review draft", reason: run.reviewPackage.escalationRecommendation.reason };
  }
  if (run.runtimeOutput) {
    return { title: "Review CrewAI output", reason: "Live CrewAI output is available, but still requires human approval." };
  }
  return { title: "Review and approve response", reason: "The run completed and is ready for human review." };
}

function formatDuration(durationMs?: number | null) {
  if (durationMs === null || durationMs === undefined) return "n/a";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 12)}...` : id;
}

function filterLabel(filter: HistoryFilter) {
  if (filter === "pending") return "Pending Review";
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

export default App;
