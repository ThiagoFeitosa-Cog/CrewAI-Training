import {
  AlertTriangle,
  BarChart3,
  FileText,
  History,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Save,
  Send,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import {
  getApiHealth,
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
  crewai_llm: "CrewAI agent runtime",
};

const primaryRuntimeOption: { value: RuntimeMode; label: string } = { value: "crewai_llm", label: "CrewAI LLM · Recommended" };
const fallbackRuntimeOptions: Array<{ value: RuntimeMode; label: string }> = [
  { value: "deterministic", label: "Local deterministic" },
  { value: "crewai_flow", label: "CrewAI Flow" },
];

const reviewOptions: Array<{ value: HumanReviewState["status"]; label: string }> = [
  { value: "approved", label: "Approve" },
  { value: "rejected", label: "Reject" },
  { value: "needs_changes", label: "Needs changes" },
];

function App() {
  const [view, setView] = useState<AppView>("dashboard");
  const [ticket, setTicket] = useState<TicketInput>(seededTicket);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("crewai_llm");
  const [status, setStatus] = useState<CrewStatus>("idle");
  const [latestRun, setLatestRun] = useState<RunStatus | null>(null);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [observabilitySummary, setObservabilitySummary] = useState<ObservabilityAggregateSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewDecision, setReviewDecision] = useState<HumanReviewState["status"]>("approved");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const refreshDashboardData = async () => {
    const [runs, summary] = await Promise.all([getRunHistory(), getObservabilitySummary()]);
    setHistory(runs);
    setObservabilitySummary(summary);
  };

  useEffect(() => {
    void refreshDashboardData().catch(() => undefined);
  }, []);

  useEffect(() => {
    void getApiHealth()
      .then((health) => {
        setApiStatus(health.status === "ok" ? "online" : "offline");
        setProviderConfigured(health.providerConfigured);
      })
      .catch(() => {
        setApiStatus("offline");
        setProviderConfigured(false);
      });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        agentsUsed: [],
        tasksUsed: [],
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
    setRuntimeMode("crewai_llm");
    setStatus("idle");
    setErrorMessage("");
  };

  const updateTicket = (field: keyof TicketInput, value: string) => {
    setTicket((current) => ({ ...current, [field]: value }));
  };

  return (
    <main className={isSidebarCollapsed ? "app-frame sidebar-is-collapsed" : "app-frame sidebar-is-expanded"}>
      <TopNav
        currentView={view}
        apiStatus={apiStatus}
        isCollapsed={isSidebarCollapsed}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onNavigate={(nextView) => {
          setView(nextView);
          setIsMobileDrawerOpen(false);
        }}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        onToggleMobileDrawer={() => setIsMobileDrawerOpen((current) => !current)}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
      />

      <div className="main-workspace app-shell">
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
            providerConfigured={providerConfigured}
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
      </div>
    </main>
  );
}

function TopNav({
  currentView,
  apiStatus,
  isCollapsed,
  isMobileDrawerOpen,
  onNavigate,
  onToggleCollapse,
  onToggleMobileDrawer,
  onCloseMobileDrawer,
}: {
  currentView: AppView;
  apiStatus: "checking" | "online" | "offline";
  isCollapsed: boolean;
  isMobileDrawerOpen: boolean;
  onNavigate: (view: AppView) => void;
  onToggleCollapse: () => void;
  onToggleMobileDrawer: () => void;
  onCloseMobileDrawer: () => void;
}) {
  const apiStatusText = apiStatusLabel(apiStatus);
  const apiStatusTitle = `API Status: ${apiStatusText}`;
  const navItems: Array<{ view: AppView; label: string; icon: typeof BarChart3 }> = [
    { view: "dashboard", label: "Dashboard", icon: BarChart3 },
    { view: "new-run", label: "New Run", icon: Send },
    { view: "history", label: "History", icon: History },
  ];

  const renderNavItems = (mode: "desktop" | "mobile") =>
    navItems.map((item) => {
      const Icon = item.icon;
      const isActive = currentView === item.view;
      return (
        <button
          key={`${mode}-${item.view}`}
          className={isActive ? "nav-button nav-active" : "nav-button"}
          aria-current={isActive ? "page" : undefined}
          title={isCollapsed && mode === "desktop" ? item.label : undefined}
          onClick={() => onNavigate(item.view)}
        >
          <Icon aria-hidden="true" />
          <span className="nav-label">{item.label}</span>
        </button>
      );
    });

  return (
    <>
      <header className="mobile-topbar">
        <button className="icon-button" type="button" aria-label="Open navigation menu" onClick={onToggleMobileDrawer}>
          <Menu aria-hidden="true" />
        </button>
        <div className="mobile-brand">
          <div className="brand-mark">SC</div>
          <span>SupportCrew AI</span>
        </div>
        <ApiStatus status={apiStatus} variant="mobile" title={apiStatusTitle} />
      </header>

      <aside className={isCollapsed ? "app-sidebar sidebar-collapsed" : "app-sidebar sidebar-expanded"} aria-label="Primary navigation">
        <div className="sidebar-brand-row">
          <div className="brand-lockup">
            <div className="brand-mark">SC</div>
            <div className="brand-copy">
              <h1>SupportCrew AI</h1>
              <p>Multi-agent support review</p>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
          >
            {isCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
        </div>
        <nav className="top-nav" aria-label="Primary navigation">
          {renderNavItems("desktop")}
        </nav>
        <ApiStatus status={apiStatus} variant={isCollapsed ? "collapsed" : "expanded"} title={apiStatusTitle} />
      </aside>

      <div className={isMobileDrawerOpen ? "mobile-backdrop mobile-backdrop-open" : "mobile-backdrop"} onClick={onCloseMobileDrawer} aria-hidden="true" />
      <aside className={isMobileDrawerOpen ? "mobile-drawer mobile-drawer-open" : "mobile-drawer"} aria-hidden={!isMobileDrawerOpen}>
        <div className="mobile-drawer-header">
          <div className="brand-lockup">
            <div className="brand-mark">SC</div>
            <div>
              <h1>SupportCrew AI</h1>
              <p>Multi-agent support review</p>
            </div>
          </div>
          <button className="icon-button" type="button" aria-label="Close navigation menu" onClick={onCloseMobileDrawer}>
            <X aria-hidden="true" />
          </button>
        </div>
        <nav className="top-nav" aria-label="Mobile primary navigation">
          {renderNavItems("mobile")}
        </nav>
        <ApiStatus status={apiStatus} variant="drawer" title={apiStatusTitle} />
      </aside>
    </>
  );
}

function ApiStatus({
  status,
  variant,
  title,
}: {
  status: "checking" | "online" | "offline";
  variant: "expanded" | "collapsed" | "mobile" | "drawer";
  title: string;
}) {
  const labels = {
    expanded: "API Status",
    collapsed: "",
    mobile: "API",
    drawer: `API ${apiStatusLabel(status)}`,
  };

  return (
    <div className={`api-status api-status-${status} api-status-${variant}`} title={title} aria-label={title}>
      <span className="api-status-dot" aria-hidden="true" />
      {labels[variant] && <span className="api-status-label">{labels[variant]}</span>}
    </div>
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
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Operations cockpit</p>
          <h2>Support review command center</h2>
          <p>Monitor multi-agent ticket analysis, review risk, and keep every response under human control.</p>
        </div>
        <button className="primary-action" onClick={onStart}>
          <Send aria-hidden="true" />
          Start New Support Run
        </button>
      </div>

      <div className="hero-panel">
        <div>
          <p className="eyebrow">Support operations workspace</p>
          <h2>Multi-agent support triage with human review</h2>
          <p>
            Classify tickets, assess customer risk, draft a response, and route escalations while keeping every customer message under human approval.
          </p>
          <div className="hero-tags">
            <span>Human-in-the-loop</span>
            <span>Local-first demo</span>
            <span>Agent activity visible</span>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="metric-grid dashboard-metrics">
        <Metric tone="blue" label="Total runs" value={summary?.totalRuns ?? history.length} />
        <Metric tone="purple" label="Pending reviews" value={pendingReviews} />
        <Metric tone="orange" label="Escalated cases" value={escalatedCases} />
        <Metric tone="green" label="Average runtime" value={formatDuration(summary?.averageWallTimeMs)} />
        <Metric tone={latestRun?.status === "error" || latest?.status === "error" ? "red" : "blue"} label="Latest status" value={latestRun?.status ?? latest?.status ?? "none"} />
      </div>

      <section className="attention-card">
        <SectionHeader title="Needs Attention" subtitle="Runs that should be reviewed before any customer-facing action." />
        <div className="attention-grid">
          <div>
            <span className="attention-label">Pending review</span>
            <strong>{pendingReviews}</strong>
            <p>Drafts waiting for a support lead decision.</p>
          </div>
          <div>
            <span className="attention-label">Escalated risk</span>
            <strong>{escalatedCases}</strong>
            <p>Cases flagged for priority routing or customer success follow-up.</p>
          </div>
          <div>
            <span className="attention-label">Latest activity</span>
            <strong>{latest ? statusLabel(latest.status) : "No runs"}</strong>
            <p>{latest?.subject ?? "Start a new support run to populate the cockpit."}</p>
          </div>
        </div>
      </section>

      <section className="board-card">
        <SectionHeader title="Recent Runs" subtitle="Latest support analyses and human review state." />
        <RunsTable runs={history.slice(0, 6)} onOpenRun={onOpenRun} />
      </section>
    </section>
  );
}

function NewRunView({
  ticket,
  runtimeMode,
  providerConfigured,
  status,
  errorMessage,
  onTicketChange,
  onRuntimeChange,
  onRun,
  onReset,
}: {
  ticket: TicketInput;
  runtimeMode: RuntimeMode;
  providerConfigured: boolean | null;
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
      <div className="workspace-header">
        <div>
        <p className="eyebrow">New Support Run</p>
        <h2>Start a focused ticket analysis</h2>
        <p>Run the YAML-defined CrewAI agents through the sequential crew process and stop at the human approval checkpoint.</p>
        </div>
      </div>

      <section className="new-run-layout">
        <div className="form-card">
          <div className="step-header">
            <span>Step 1</span>
            <div>
              <h3>Customer and ticket details</h3>
              <p>Capture enough context for the crew to classify, route, and draft safely.</p>
            </div>
          </div>
          <div className="sample-strip">
            <div>
              <span className="sample-title">Seeded demo ticket</span>
              <p>Enterprise customer, urgent integration failure, renewal risk.</p>
            </div>
            <button type="button" className="ghost-button" onClick={onReset}>
              Use sample ticket
            </button>
          </div>
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
            <div className="step-header">
              <span>Step 2</span>
              <div>
                <h3>Choose CrewAI runtime</h3>
                <p>CrewAI LLM is the primary product path. Fallback modes stay available for offline debugging.</p>
              </div>
            </div>
            <fieldset className="runtime-selector" aria-label="Runtime Mode">
              <legend>Runtime Mode</legend>
              {providerConfigured === false && (
                <p className="runtime-warning">
                  Provider configuration was not detected. CrewAI LLM can still be selected, but the run will fail safely until MODEL,
                  OPENAI_API_BASE, and OPENAI_API_KEY are configured.
                </p>
              )}
              <div className="runtime-options runtime-options-primary">
                <button
                  type="button"
                  className={runtimeMode === primaryRuntimeOption.value ? "runtime-card runtime-card-active runtime-card-recommended" : "runtime-card runtime-card-recommended"}
                  aria-pressed={runtimeMode === primaryRuntimeOption.value}
                  title={runtimeTooltip(primaryRuntimeOption.value)}
                  onClick={() => onRuntimeChange(primaryRuntimeOption.value)}
                >
                  <span className="runtime-card-kicker">Recommended CrewAI path</span>
                  <span className="runtime-card-title">{primaryRuntimeOption.label}</span>
                  <span className="runtime-card-description">{runtimeHelperText(primaryRuntimeOption.value)}</span>
                </button>
              </div>
              <details className="advanced-runtime-options">
                <summary>Advanced fallback modes</summary>
                <p>Use these only for offline debugging, no-provider demos, or architecture validation.</p>
                <div className="runtime-options runtime-options-fallback">
                  {fallbackRuntimeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={runtimeMode === option.value ? "runtime-card runtime-card-active" : "runtime-card"}
                    aria-pressed={runtimeMode === option.value}
                    title={runtimeTooltip(option.value)}
                    onClick={() => onRuntimeChange(option.value)}
                  >
                    <span className="runtime-card-title">{option.label}</span>
                    <span className="runtime-card-description">{runtimeHelperText(option.value)}</span>
                  </button>
                  ))}
                </div>
              </details>
            </fieldset>
            {status === "error" && <p className="inline-error">{errorMessage}</p>}
            <div className="step-header compact-step">
              <span>Step 3</span>
              <div>
                <h3>Run analysis</h3>
                <p>The result opens as a human review console. Nothing is sent automatically.</p>
              </div>
            </div>
            <div className="button-row">
              <button className="primary-action" type="submit" disabled={status === "running"}>
                <Send aria-hidden="true" />
                {status === "running" ? "Running analysis" : "Run Analysis"}
              </button>
              <button type="button" className="secondary-action" onClick={onReset}>
                <RotateCcw aria-hidden="true" />
                Reset
              </button>
            </div>
          </form>
        </div>
        <aside className="helper-card">
          <p className="eyebrow">How this works</p>
          <h3>One ticket, one guided review.</h3>
          <ol>
            <li>Enter or keep the seeded support ticket.</li>
            <li>Run the CrewAI agent runtime.</li>
            <li>Inspect the crew execution metadata and ReviewPackage.</li>
            <li>Approve, reject, or request changes. Nothing is sent automatically.</li>
          </ol>
          <details>
            <summary>Which runtime should I choose?</summary>
            <p>Use CrewAI LLM for the main presentation. Local deterministic is only an advanced fallback for offline debugging or no-provider demos.</p>
          </details>
        </aside>
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
      <div className="run-header-card review-console-header">
        <div>
          <p className="eyebrow">Run Details</p>
          <h2>{reviewPackage?.classification.category ?? "Runtime output"}</h2>
          <p>Review the recommendation, escalation risk, and response draft before deciding.</p>
        </div>
        <div className="run-header-meta">
          <StatusBadge status={run.status} />
          <RuntimePill runtime={run.actualRuntimeMode} />
          <span className="trace-pill">Trace {shortId(run.traceId)}</span>
        </div>
      </div>

      <section className="summary-card">
        <div>
          <h3>Executive Summary</h3>
          <p className="summary-action">{action.title}</p>
          <p>{action.reason}</p>
        </div>
        <div className="summary-meta">
          <Metric tone="blue" label="Requested runtime" value={runtimeLabels[run.requestedRuntimeMode] ?? run.requestedRuntimeMode} />
          <Metric tone="purple" label="Actual runtime" value={runtimeLabels[run.actualRuntimeMode] ?? run.actualRuntimeMode} />
          <Metric tone={reviewPackage?.escalationRecommendation.escalate ? "orange" : "green"} label="Escalation" value={reviewPackage?.escalationRecommendation.escalate ? "Required" : "Not required"} />
          <Metric tone="red" label="Human review" value="Required" />
        </div>
      </section>

      {(run.requestedRuntimeMode === "crewai_llm" || run.actualRuntimeMode === "crewai_llm") && <CrewAIExecutionPanel run={run} />}

      <section className="board-card slim-card secondary-details-card">
        <details>
          <summary>Run metadata</summary>
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
            <button className="secondary-action" onClick={onRetry}>
              Retry
            </button>
          )}
        </details>
      </section>

      {reviewPackage && <DraftResponsePanel reviewPackage={reviewPackage} />}

      {reviewPackage ? <AgentResults reviewPackage={reviewPackage} /> : <RuntimeOutput run={run} />}

      <section className="review-card">
        <SectionHeader title="Human review checkpoint" subtitle="No response is sent automatically." />
        <div className="review-controls">
          <div className="review-status-line">
            <span>Saved review status</span>
            <StatusBadge status={run.humanReview.status} />
          </div>
          <fieldset className="decision-group" aria-label="Decision">
            <legend>Decision</legend>
            <div className="decision-options">
              {reviewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={reviewDecision === option.value ? "decision-button decision-button-active" : "decision-button"}
                  aria-pressed={reviewDecision === option.value}
                  onClick={() => onReviewDecisionChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Reviewer notes
            <textarea value={reviewerNotes} onChange={(event) => onReviewerNotesChange(event.target.value)} />
          </label>
          <button className="primary-action" onClick={onSubmitReview}>
            <Save aria-hidden="true" />
            Submit review decision
          </button>
        </div>
      </section>

      <ObservabilityPanel run={run} />
    </section>
  );
}

function CrewAIExecutionPanel({ run }: { run: RunStatus }) {
  const agentLabels: Record<string, string> = {
    classification_agent: "Classification",
    sentiment_analysis_agent: "Sentiment",
    knowledge_retrieval_agent: "Knowledge Retrieval",
    solution_generation_agent: "Solution Generation",
    routing_agent: "Routing",
    escalation_agent: "Escalation",
  };

  return (
    <section className="crewai-execution-card">
      <SectionHeader title="CrewAI Crew Execution" subtitle="YAML-defined agents running in a sequential process with a human approval checkpoint." />
      <div className="execution-meta-grid">
        <MetaItem label="Crew" value={run.crewName ?? "CustomerSupportCrew"} />
        <MetaItem label="Process" value={run.process ?? "sequential"} />
        <MetaItem label="Kickoff status" value={run.crewaiKickoffStatus ?? "not_applicable"} />
        <MetaItem label="ReviewPackage parse status" value={run.reviewPackageParseStatus ?? "n/a"} />
      </div>
      <div className="execution-chip-section">
        <span className="execution-section-label">Agents executed</span>
        <div className="execution-chip-grid">
          {(run.agentsUsed.length ? run.agentsUsed : Object.keys(agentLabels)).map((agent) => (
            <span className="execution-chip" key={agent}>
              {agentLabels[agent] ?? labelFromIdentifier(agent)}
            </span>
          ))}
        </div>
      </div>
      <details className="execution-task-details">
        <summary>Tasks executed</summary>
        <div className="execution-chip-grid">
          {run.tasksUsed.map((task) => (
            <span className="execution-chip execution-chip-secondary" key={task}>
              {labelFromIdentifier(task)}
            </span>
          ))}
        </div>
      </details>
      {run.runtimeOutput?.parseError && <p className="inline-error">{run.runtimeOutput.parseError}</p>}
    </section>
  );
}

function DraftResponsePanel({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  return (
    <section className="draft-review-card">
      <SectionHeader title="Draft Response Review" subtitle="Prepared by the solution agent. Human approval is required before sending." />
      <div className="draft-layout">
        <div className="draft-response-box">
          <p>{reviewPackage.draftResponse.text}</p>
        </div>
        <div className="draft-sidecar">
          <StatusBadge status={reviewPackage.humanApprovalRequired ? "pending" : "approved"} />
          <p>Source-backed draft for support agent review.</p>
          <details>
            <summary>Source references</summary>
            <p>{reviewPackage.draftResponse.sourceIds.join(", ") || "No source ids attached."}</p>
          </details>
        </div>
      </div>
    </section>
  );
}

function AgentResults({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  return (
    <section className="board-card">
      <SectionHeader title="Agent Results" subtitle="Specialist outputs organized for review." />
      <div className="agent-grid">
        <ResultCard title="Classification" value={reviewPackage.classification.category} detail={reviewPackage.classification.rationale} />
        <ResultCard
          title="Customer Sentiment"
          value={`${reviewPackage.sentiment.label} / ${reviewPackage.sentiment.urgency}`}
          detail={reviewPackage.sentiment.riskFlags.join(", ") || "No risk flags"}
        />
        <ResultCard
          title="Knowledge Used"
          value={`${reviewPackage.retrievedSources.length} source(s)`}
          detail={reviewPackage.retrievedSources.map((source) => source.title).join(", ")}
        />
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
    <section className="board-card">
      <SectionHeader title="CrewAI Runtime Output" subtitle="Live LLM output is preserved for human review." />
      <p className="approval-note">This output has not been sent to the customer.</p>
      {run.runtimeOutput?.parseError && <p className="inline-error">{run.runtimeOutput.parseError}</p>}
      <pre className="runtime-output-text">{run.runtimeOutput?.outputText ?? run.runtimeError ?? "No runtime output available."}</pre>
    </section>
  );
}

function ObservabilityPanel({ run }: { run: RunStatus }) {
  return (
    <section className="technical-card">
      <SectionHeader title="Technical visibility" subtitle="Secondary details for debugging, validation, and course review." />
      <div className="technical-panel-list">
        <details className="tech-panel">
          <summary>
            <span>Agent activity</span>
            <small>{run.observabilitySteps.length} step(s)</small>
          </summary>
          <Timeline items={run.observabilitySteps.map((step) => ({ title: step.name, body: step.summary, meta: step.status }))} />
        </details>
        <details className="tech-panel">
          <summary>
            <span>Runtime events</span>
            <small>{run.events.length} event(s)</small>
          </summary>
          <Timeline
            items={run.events.map((event) => ({
              title: event.eventType.replace(/_/g, " "),
              body: event.safeSummary,
              meta: event.durationMs ? formatDuration(event.durationMs) : new Date(event.timestamp).toLocaleTimeString(),
            }))}
          />
        </details>
        <details className="tech-panel">
          <summary>
            <span>Performance</span>
            <small>{formatDuration(run.metrics?.wallTimeMs)}</small>
          </summary>
          <div className="metric-grid compact-metrics">
            <Metric label="Wall time" value={formatDuration(run.metrics?.wallTimeMs)} />
            <Metric label="Slowest step" value={run.metrics?.slowestStep ?? "n/a"} />
            <Metric label="Token usage" value={run.metrics?.tokenUsage ? "Available" : "Not available for this run"} />
            <Metric label="Cost estimate" value={run.metrics?.costEstimate ? "Available" : "Not available for this run"} />
          </div>
          <Timeline
            items={(run.metrics?.stepMetrics ?? []).map((step) => ({
              title: step.stepName,
              body: step.status,
              meta: formatDuration(step.durationMs),
            }))}
          />
        </details>
        <details className="tech-panel">
          <summary>
            <span>Runtime details</span>
            <small>{run.runtimeStatus}</small>
          </summary>
          <div className="metadata-grid">
            <MetaItem label="Requested runtime" value={runtimeLabels[run.requestedRuntimeMode] ?? run.requestedRuntimeMode} />
            <MetaItem label="Actual runtime" value={runtimeLabels[run.actualRuntimeMode] ?? run.actualRuntimeMode} />
            <MetaItem label="Parse status" value={run.reviewPackageParseStatus ?? "n/a"} />
            <MetaItem label="LLM kickoff attempted" value={run.llmKickoffAttempted ? "Yes" : "No"} />
          </div>
          {run.runtimeError && <p className="inline-error">{run.runtimeError}</p>}
        </details>
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
          <button key={item} className={filter === item ? "filter-pill filter-pill-active" : "filter-pill"} onClick={() => onFilterChange(item)}>
            {filterLabel(item)}
          </button>
        ))}
      </div>
      <section className="board-card">
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
              <td><RuntimePill runtime={run.actualRuntimeMode} /></td>
              <td>
                <StatusBadge status={run.status as CrewStatus} />
              </td>
              <td><StatusBadge status={run.reviewStatus} /></td>
              <td><StatusBadge status={run.escalated ? "escalated" : "not_escalated"} /></td>
              <td>{new Date(run.updatedAt).toLocaleString()}</td>
              <td>
                <button className="ghost-button small-button" onClick={() => onOpenRun(run.runId)}>
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
      <span className="result-card-label">{title}</span>
      <span className="result-card-value">{value}</span>
      <details>
        <summary>View details</summary>
        <p>{detail}</p>
      </details>
    </article>
  );
}

function Metric({ label, value, tone = "blue" }: { label: string; value: string | number; tone?: "blue" | "purple" | "green" | "yellow" | "red" | "orange" }) {
  return (
    <div className={`metric-card metric-card-${tone}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

function Timeline({ items }: { items: Array<{ title: string; body: string; meta: string }> }) {
  if (!items.length) return <p className="muted-text">No events recorded for this run.</p>;
  return (
    <ol className="timeline-list">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`}>
          <span className="timeline-title">{item.title.replace(/_/g, " ")}</span>
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
    <section className="board-card empty-state">
      <FileText aria-hidden="true" />
      <h2>{title}</h2>
      <p>{body}</p>
      <button className="primary-action" onClick={onAction}>{action}</button>
    </section>
  );
}

function StatusBadge({ status }: { status: CrewStatus | string }) {
  return <span className={`status-badge status-badge-${status}`}>{statusLabel(status)}</span>;
}

function RuntimePill({ runtime }: { runtime: string }) {
  return <span className={`runtime-pill runtime-pill-${runtime}`}>{runtimeLabels[runtime] ?? runtime}</span>;
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

function runtimeHelperText(mode: RuntimeMode) {
  if (mode === "crewai_flow") return "CrewAI Flow path for orchestration validation.";
  if (mode === "crewai_llm") return "Full CrewAI crew kickoff with YAML-defined agents and sequential tasks.";
  return "Offline deterministic fallback for debugging or no-provider demos.";
}

function runtimeTooltip(mode: RuntimeMode) {
  if (mode === "crewai_flow") return "Runs the CrewAI Flow architecture path while preserving the human review checkpoint.";
  if (mode === "crewai_llm") return "Attempts the live CrewAI LLM runtime when provider configuration is available.";
  return "Uses deterministic local logic. Keep as an advanced fallback only.";
}

function labelFromIdentifier(value: string) {
  return value
    .replace(/_task$/, "")
    .replace(/_agent$/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 12)}...` : id;
}

function filterLabel(filter: HistoryFilter) {
  if (filter === "pending") return "Pending";
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

function apiStatusLabel(status: "checking" | "online" | "offline") {
  const labels: Record<"checking" | "online" | "offline", string> = {
    checking: "Checking",
    online: "Online",
    offline: "Offline",
  };
  return labels[status];
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    done: "Done",
    running: "Running",
    error: "Error",
    idle: "Idle",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    needs_changes: "Needs changes",
    escalated: "Escalated",
    not_escalated: "No",
  };
  return labels[status] ?? status;
}

export default App;
