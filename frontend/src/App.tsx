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
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from "react";

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

gsap.registerPlugin(ScrollTrigger);

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

const orchestrationSteps = [
  { label: "Ticket received", detail: "One customer issue enters the review workflow." },
  { label: "Classification", detail: "The crew identifies issue type and support category." },
  { label: "Sentiment", detail: "Urgency, frustration, and account risk are assessed." },
  { label: "Knowledge retrieval", detail: "Relevant local support guidance is gathered." },
  { label: "Draft response", detail: "A safe agent-facing answer is prepared." },
  { label: "Routing", detail: "The right queue or team is recommended." },
  { label: "Escalation", detail: "High-risk cases are flagged for leadership attention." },
  { label: "Human review", detail: "A support lead approves, rejects, or requests changes." },
];

const loadingPhrases = [
  "Classification agent is reading the room...",
  "Sentiment agent is detecting customer frustration...",
  "Knowledge retrieval agent is checking approved sources...",
  "Drafting agent is choosing careful words...",
  "Routing agent is finding the right queue...",
  "Escalation agent is looking for risk signals...",
  "Review package is being assembled for a human...",
  "The agents are debating responsibly...",
  "Nobody is sending anything without approval...",
  "Tiny agents, big support decision...",
];

const loadingSteps = ["Classify", "Sentiment", "Retrieve", "Draft", "Route", "Escalate", "ReviewPackage"];

function App() {
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
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

  const launchDemo = () => {
    setHasEnteredApp(true);
    setView("dashboard");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (!hasEnteredApp) {
    return <LandingPage onLaunch={launchDemo} />;
  }

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
      {status === "running" && <RunLoadingModal runtimeMode={runtimeMode} />}
    </main>
  );
}

function RunLoadingModal({ runtimeMode }: { runtimeMode: RuntimeMode }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const runtimeCopy = loadingRuntimeCopy(runtimeMode);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % loadingPhrases.length);
    }, 2100);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="run-loading-overlay" aria-live="polite">
      <section
        className="run-loading-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-loading-title"
        aria-describedby="run-loading-description"
      >
        <div className="agent-orbit-loader" aria-hidden="true">
          <span className="agent-orbit-center" />
          <span className="agent-orbit-dot agent-orbit-dot-one" />
          <span className="agent-orbit-dot agent-orbit-dot-two" />
          <span className="agent-orbit-dot agent-orbit-dot-three" />
          <span className="agent-orbit-dot agent-orbit-dot-four" />
        </div>
        <div className="run-loading-copy">
          <p className="eyebrow">{runtimeCopy.kicker}</p>
          <h2 id="run-loading-title">{runtimeCopy.title}</h2>
          <p id="run-loading-description">
            Analyzing the ticket, drafting a response, and preparing everything for human review. Nothing is sent automatically.
          </p>
          <p className="loading-phrase">{loadingPhrases[phraseIndex]}</p>
        </div>
        <div className="loading-step-list" aria-label="Typical workflow">
          <span className="loading-step-heading">Typical workflow</span>
          <div>
            {loadingSteps.map((step, index) => (
              <span className="loading-step" style={{ "--step-index": index } as CSSProperties} key={step}>
                {step}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const orchestrationRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!pageRef.current || typeof window === "undefined") return;

    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lenis: Lenis | null = null;
    let animationFrame = 0;
    const mm = gsap.matchMedia();

    if (!reducedMotion) {
      lenis = new Lenis({
        duration: 1.25,
        smoothWheel: true,
        touchMultiplier: 1.05,
        wheelMultiplier: 0.9,
      });
      lenis.on("scroll", ScrollTrigger.update);

      const raf = (time: number) => {
        lenis?.raf(time);
        animationFrame = requestAnimationFrame(raf);
      };
      animationFrame = requestAnimationFrame(raf);
    }

    const context = gsap.context(() => {
      if (reducedMotion) return;

      gsap.from(".landing-kicker", {
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out",
        y: 22,
      });
      gsap.from(".landing-headline .line", {
        autoAlpha: 0,
        delay: 0.08,
        duration: 1.05,
        ease: "expo.out",
        stagger: 0.16,
        yPercent: 88,
      });
      gsap.from(".landing-subtitle, .landing-actions, .landing-badges", {
        autoAlpha: 0,
        delay: 0.62,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.14,
        y: 28,
      });
      gsap.to(".scroll-indicator", {
        autoAlpha: 0,
        ease: "power3.out",
        scrollTrigger: {
          end: "45% top",
          scrub: true,
          start: "top top",
          trigger: ".landing-hero",
        },
        y: 28,
      });

      mm.add("(min-width: 900px)", () => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            end: "+=1500",
            pin: true,
            scrub: 1,
            start: "top top",
            trigger: ".orchestration-section",
          },
        });

        timeline
          .from(".orchestration-copy", {
            autoAlpha: 0,
            duration: 0.95,
            ease: "power3.out",
            x: -44,
          })
          .from(
            ".agent-node",
            {
              autoAlpha: 0,
              duration: 0.95,
              ease: "power3.out",
              scale: 0.94,
              stagger: 0.2,
              y: 72,
            },
            0.1,
          )
          .to(
            ".orchestration-map",
            {
              duration: 1.4,
              ease: "expo.inOut",
              scale: 1.035,
              xPercent: -5,
            },
            0.15,
          );
      });

      mm.add("(max-width: 899px)", () => {
        gsap.from(".agent-node", {
          autoAlpha: 0,
          duration: 0.78,
          ease: "power3.out",
          scrollTrigger: {
            start: "top 74%",
            trigger: ".orchestration-section",
          },
          stagger: 0.12,
          y: 34,
        });
      });
    }, pageRef);

    ScrollTrigger.refresh();

    return () => {
      context.revert();
      mm.revert();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      lenis?.destroy();
    };
  }, []);

  const scrollToOrchestration = () => {
    orchestrationRef.current?.scrollIntoView({
      behavior:
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      block: "start",
    });
  };

  return (
    <main className="landing-page" ref={pageRef}>
      <section className="landing-hero" aria-label="Multi-agent support crew landing">
        <div className="landing-ambient landing-ambient-one" aria-hidden="true" />
        <div className="landing-ambient landing-ambient-two" aria-hidden="true" />
        <div className="landing-grid" aria-hidden="true" />
        <div className="landing-hero-inner">
          <p className="landing-kicker">CrewAI customer support command layer</p>
          <h1 className="landing-headline">
            <span className="line">Run the support crew.</span>
            <span className="line">Review before it reaches the customer.</span>
          </h1>
          <p className="landing-subtitle">
            A multi-agent CrewAI workflow classifies tickets, evaluates risk, retrieves knowledge, drafts a response, and
            keeps every customer-facing action behind human approval.
          </p>
          <div className="landing-actions">
            <button className="landing-primary" type="button" onClick={onLaunch}>
              Launch Demo
            </button>
            <button className="landing-secondary" type="button" onClick={scrollToOrchestration}>
              See how it works
            </button>
          </div>
          <div className="landing-badges" aria-label="Product highlights">
            <span>YAML-defined agents</span>
            <span>Sequential process</span>
            <span>Human approval checkpoint</span>
          </div>
        </div>
        <div className="scroll-indicator" aria-hidden="true">
          <span />
          Scroll
        </div>
      </section>

      <section className="orchestration-section" ref={orchestrationRef}>
        <div className="orchestration-copy">
          <p className="landing-section-kicker">Multi-agent orchestration</p>
          <h2>One ticket moves through a disciplined CrewAI review path.</h2>
          <p>
            The demo keeps the story visible: each specialist contributes a bounded output, and the final package waits for
            a human decision.
          </p>
        </div>
        <div className="orchestration-map" aria-label="CrewAI orchestration sequence">
          {orchestrationSteps.map((step, index) => (
            <article className="agent-node" key={step.label}>
              <span className="agent-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.label}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-split-section">
        <div>
          <p className="landing-section-kicker">Human review built in</p>
          <h2>Governance is the product behavior, not an afterthought.</h2>
        </div>
        <div className="landing-feature-grid">
          <article>
            <span>01</span>
            <h3>No automatic send</h3>
            <p>Drafts remain internal until a support lead approves, rejects, or requests changes.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Escalation clarity</h3>
            <p>High-risk tickets surface severity, target owner, and rationale before the response is used.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Operator control</h3>
            <p>The crew produces evidence and recommendations; the human owns the final customer action.</p>
          </article>
        </div>
      </section>

      <section className="landing-observability-section">
        <div className="observability-card">
          <p className="landing-section-kicker">Observable by design</p>
          <h2>Every run carries a correlation trail.</h2>
          <p>
            Run ID, trace ID, event timeline, and runtime metrics make the workflow explainable for demos, debugging, and
            stakeholder review.
          </p>
        </div>
        <div className="observability-mini-grid" aria-label="Observability concepts">
          <span>run_id</span>
          <span>trace_id</span>
          <span>agent timeline</span>
          <span>step durations</span>
          <span>review status</span>
          <span>runtime mode</span>
        </div>
      </section>

      <section className="landing-final-cta">
        <p className="landing-section-kicker">Ready for the live workflow</p>
        <h2>Launch the CrewAI demo console.</h2>
        <button className="landing-primary" type="button" onClick={onLaunch}>
          Launch CrewAI Demo
        </button>
      </section>
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
          <p>Review support runs, spot escalations, and start the next CrewAI analysis.</p>
        </div>
        <button className="primary-action" onClick={onStart}>
          <Send aria-hidden="true" />
          Start New Support Run
        </button>
      </div>

      <div className="hero-panel">
        <div>
          <p className="eyebrow">Support operations workspace</p>
          <h2>CrewAI support triage, held for human approval</h2>
          <p>Run the crew, review the draft, and decide before anything reaches the customer.</p>
          <div className="hero-tags">
            <span>Human-in-the-loop</span>
            <span>CrewAI runtime</span>
            <span>ReviewPackage output</span>
          </div>
        </div>
      </div>

      <div className="metric-grid dashboard-metrics">
        <Metric tone="blue" label="Total runs" value={summary?.totalRuns ?? history.length} />
        <Metric tone="purple" label="Pending reviews" value={pendingReviews} />
        <Metric tone="orange" label="Escalated cases" value={escalatedCases} />
        <Metric tone="green" label="Average runtime" value={formatDuration(summary?.averageWallTimeMs)} />
        <Metric tone={latestRun?.status === "error" || latest?.status === "error" ? "red" : "blue"} label="Latest status" value={latestRun?.status ?? latest?.status ?? "none"} />
      </div>

      <section className="board-card">
        <SectionHeader title="Recent Runs" subtitle="Latest analyses and review state." />
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
        <p>Submit one ticket to the CrewAI runtime and review the result before sending anything.</p>
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
              <p>CrewAI LLM is recommended for the demo.</p>
              </div>
            </div>
            <fieldset className="runtime-selector" aria-label="Runtime Mode">
              <legend>Runtime Mode</legend>
              {providerConfigured === false && (
                <p className="runtime-warning">
                  Provider configuration was not detected. CrewAI LLM will fail safely until MODEL, OPENAI_API_BASE, and
                  OPENAI_API_KEY are configured.
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
          <p className="eyebrow">Flow</p>
          <h3>One ticket. One review package.</h3>
          <ol>
            <li>Enter ticket context.</li>
            <li>Run CrewAI.</li>
            <li>Review the draft.</li>
            <li>Approve, reject, or request changes.</li>
          </ol>
          <details>
            <summary>Fallback modes</summary>
            <p>Use fallback modes only for offline debugging or no-provider demos.</p>
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

      {reviewPackage && <DraftResponsePanel reviewPackage={reviewPackage} />}

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

      {(run.requestedRuntimeMode === "crewai_llm" || run.actualRuntimeMode === "crewai_llm") && <CrewAIExecutionPanel run={run} />}

      {reviewPackage ? <AgentResults reviewPackage={reviewPackage} /> : <RuntimeOutput run={run} />}

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
      <div className="compact-execution-header">
        <div>
          <p className="eyebrow">CrewAI confirmation</p>
          <h3>CrewAI Crew completed</h3>
          <p>Sequential crew run completed and stopped at the human approval checkpoint.</p>
        </div>
        <StatusBadge status={run.crewaiKickoffStatus === "completed" ? "done" : run.status} />
      </div>
      <div className="execution-summary-strip">
        <span>Crew: {run.crewName ?? "CustomerSupportCrew"}</span>
        <span>Process: {run.process ?? "sequential"}</span>
        <span>Parsed: {run.reviewPackageParseStatus ?? "n/a"}</span>
        <span>{run.agentsUsed.length || 6} agents / {run.tasksUsed.length || 7} tasks</span>
      </div>
      <details className="execution-task-details">
        <summary>View CrewAI execution details</summary>
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
        <span className="execution-section-label">Tasks executed</span>
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
  const [selectedDetail, setSelectedDetail] = useState<{ title: string; value: string; detail: string } | null>(null);
  const rows = [
    {
      title: "Classification",
      value: reviewPackage.classification.category,
      detail: reviewPackage.classification.rationale,
    },
    {
      title: "Sentiment",
      value: `${reviewPackage.sentiment.label} / ${reviewPackage.sentiment.urgency}`,
      detail: reviewPackage.sentiment.riskFlags.join(", ") || "No risk flags",
    },
    {
      title: "Knowledge",
      value: `${reviewPackage.retrievedSources.length} source(s)`,
      detail: reviewPackage.retrievedSources.map((source) => `${source.title}: ${source.snippet}`).join("\n\n"),
    },
    {
      title: "Routing",
      value: reviewPackage.routingRecommendation.queue,
      detail: reviewPackage.routingRecommendation.rationale,
    },
    {
      title: "Escalation",
      value: `${reviewPackage.escalationRecommendation.escalate ? "Escalate" : "No escalation"} · ${reviewPackage.escalationRecommendation.severity}`,
      detail: reviewPackage.escalationRecommendation.reason,
    },
  ];

  return (
    <section className="board-card quiet-card">
      <SectionHeader title="Agent output summary" subtitle="Compact specialist results. Open details only when needed." />
      <div className="agent-summary-list">
        {rows.map((row) => (
          <div className="agent-summary-row" key={row.title}>
            <div>
              <span className="agent-summary-label">{row.title}</span>
              <strong>{row.value}</strong>
            </div>
            <button className="secondary-action small-button" type="button" onClick={() => setSelectedDetail(row)}>
              View details
            </button>
          </div>
        ))}
      </div>
      {reviewPackage.warnings.length > 0 && (
        <details className="warning-summary">
          <summary>
            <AlertTriangle aria-hidden="true" />
            {reviewPackage.warnings.length} warning(s)
          </summary>
          <ul>
            {reviewPackage.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      {selectedDetail && (
        <Modal title={selectedDetail.title} onClose={() => setSelectedDetail(null)}>
          <p className="modal-value">{selectedDetail.value}</p>
          <pre className="modal-detail-text">{selectedDetail.detail}</pre>
        </Modal>
      )}
    </section>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 id="detail-modal-title">{title}</h3>
          <button className="icon-button" type="button" aria-label="Close details" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
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

function loadingRuntimeCopy(mode: RuntimeMode) {
  if (mode === "crewai_flow") {
    return {
      kicker: "CrewAI flow in motion",
      title: "CrewAI flow is working",
    };
  }
  if (mode === "crewai_llm") {
    return {
      kicker: "CrewAI agent runtime",
      title: "CrewAI agents are working",
    };
  }
  return {
    kicker: "Local workflow fallback",
    title: "Local workflow is working",
  };
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
