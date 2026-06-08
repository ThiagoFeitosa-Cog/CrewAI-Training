import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Save, Send, XCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { getRunHistory, getRunStatus, startRun, submitReview } from "./services/apiCrewService";
import type { CrewStatus, HumanReviewState, ReviewPackage, RunHistoryItem, RunStatus, TicketInput } from "./types";
import "./styles.css";

const seededTicket: TicketInput = {
  customerId: "CUST-2048",
  companyName: "Northstar Analytics",
  planTier: "Enterprise",
  productArea: "Integrations",
  subject: "Urgent: API sync failed again before our renewal review",
  message:
    "Our Salesforce sync failed again this morning and our revenue team cannot work. This is the third time this month and leadership is frustrated. We need this fixed ASAP before our renewal review next week.",
};

const statusCopy: Record<CrewStatus, string> = {
  idle: "Crew: idle",
  running: "Crew: running",
  done: "Crew: done",
  error: "Crew: error",
};

function StatusIcon({ status }: { status: CrewStatus }) {
  if (status === "done") return <CheckCircle2 aria-hidden="true" />;
  if (status === "error") return <XCircle aria-hidden="true" />;
  if (status === "running") return <Clock aria-hidden="true" />;
  return <AlertTriangle aria-hidden="true" />;
}

function App() {
  const [ticket, setTicket] = useState<TicketInput>(seededTicket);
  const [status, setStatus] = useState<CrewStatus>("idle");
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [reviewPackage, setReviewPackage] = useState<ReviewPackage | null>(null);
  const [latestRun, setLatestRun] = useState<RunStatus | null>(null);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [reviewDecision, setReviewDecision] = useState<HumanReviewState["status"]>("approved");
  const [reviewerNotes, setReviewerNotes] = useState<string>("");

  const formattedUpdated = useMemo(() => new Date(lastUpdated).toLocaleString(), [lastUpdated]);

  const refreshHistory = async () => {
    setHistory(await getRunHistory());
  };

  useEffect(() => {
    void refreshHistory().catch(() => undefined);
  }, []);

  const updateTicket = (field: keyof TicketInput, value: string) => {
    setTicket((current) => ({ ...current, [field]: value }));
  };

  const applyRun = (run: RunStatus) => {
    setLatestRun(run);
    setReviewPackage(run.reviewPackage ?? null);
    setStatus(run.status);
    setLastUpdated(run.lastUpdated);
    setReviewerNotes(run.humanReview.reviewerNotes);
  };

  const runCrew = async () => {
    try {
      setErrorMessage("");
      setReviewPackage(null);
      setStatus("running");
      setLastUpdated(new Date().toISOString());

      const started = await startRun(ticket);
      applyRun(started);

      const completed = await getRunStatus(started.runId);
      applyRun(completed);
      await refreshHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The crew run failed.";
      const failedRun = {
        runId: latestRun?.runId ?? "not-started",
        status: "error" as CrewStatus,
        runtimeMode: "deterministic",
        lastUpdated: new Date().toISOString(),
        observabilitySteps: [],
        humanReview: { status: "pending" as const, reviewerNotes: "", updatedAt: null },
        errorMessage: message,
      };
      setLatestRun(failedRun);
      setStatus("error");
      setErrorMessage(message);
      setLastUpdated(failedRun.lastUpdated);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runCrew();
  };

  const submitHumanReview = async () => {
    if (!latestRun) return;
    const reviewed = await submitReview(latestRun.runId, reviewDecision, reviewerNotes);
    applyRun(reviewed);
    await refreshHistory();
  };

  const reset = () => {
    setTicket(seededTicket);
    setStatus("idle");
    setReviewPackage(null);
    setLatestRun(null);
    setErrorMessage("");
    setReviewerNotes("");
    setReviewDecision("approved");
    setLastUpdated(new Date().toISOString());
  };

  return (
    <main className="app-shell">
      <section className={`status-banner status-${status}`} aria-live="polite">
        <div className="status-title">
          <StatusIcon status={status} />
          <strong>{statusCopy[status]}</strong>
          <span className="status-pill">{status}</span>
          {latestRun && <span className="runtime-pill">{latestRun.runtimeMode}</span>}
        </div>
        <span>Last updated: {formattedUpdated}</span>
      </section>

      <header className="page-header">
        <div>
          <p className="eyebrow">Multi-Agent Customer Support Crew</p>
          <h1>Customer Support Review Workflow</h1>
        </div>
        <p>
          Integrated Week 4 MVP. The browser calls the local FastAPI backend, the backend creates a ReviewPackage, and
          no customer-facing response is sent automatically.
        </p>
      </header>

      <div className="layout-grid">
        <section className="panel" aria-labelledby="ticket-form-heading">
          <h2 id="ticket-form-heading">Customer Support Request</h2>
          <form onSubmit={handleSubmit} className="ticket-form">
            <div className="field-grid">
              <label>
                Customer ID
                <input value={ticket.customerId} onChange={(e) => updateTicket("customerId", e.target.value)} />
              </label>
              <label>
                Company name
                <input value={ticket.companyName} onChange={(e) => updateTicket("companyName", e.target.value)} />
              </label>
              <label>
                Plan tier
                <input value={ticket.planTier} onChange={(e) => updateTicket("planTier", e.target.value)} />
              </label>
              <label>
                Product area
                <input value={ticket.productArea} onChange={(e) => updateTicket("productArea", e.target.value)} />
              </label>
            </div>
            <label>
              Subject
              <input value={ticket.subject} onChange={(e) => updateTicket("subject", e.target.value)} required />
            </label>
            <label>
              Message
              <textarea value={ticket.message} onChange={(e) => updateTicket("message", e.target.value)} required />
            </label>
            {status === "error" && <p className="inline-error">{errorMessage}</p>}
            <div className="button-row">
              <button type="submit" disabled={status === "running"}>
                <Send aria-hidden="true" />
                {status === "running" ? "Crew running" : "Run"}
              </button>
              <button type="button" className="secondary" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                Reset
              </button>
              {status === "error" && (
                <button type="button" className="secondary" onClick={() => void runCrew()}>
                  Retry
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel" aria-labelledby="history-heading">
          <h2 id="history-heading">Run History</h2>
          {history.length ? (
            <div className="history-stack">
              {history.slice(0, 6).map((run) => (
                <article className="history-card" key={run.runId}>
                  <strong>{run.subject}</strong>
                  <span>{run.runId}</span>
                  <span>
                    {run.status} · review {run.reviewStatus}
                  </span>
                  <small>{new Date(run.updatedAt).toLocaleString()}</small>
                </article>
              ))}
            </div>
          ) : (
            <p>No crew runs yet. Use Run to create the latest review package.</p>
          )}
        </section>
      </div>

      <section className="panel results-panel" aria-labelledby="results-heading">
        <h2 id="results-heading">Review Package</h2>
        {status === "idle" && <p>Run the crew to generate a backend ReviewPackage.</p>}
        {status === "running" && <p>Crew: running. The backend is classifying, retrieving, drafting, routing, and checking escalation.</p>}
        {status === "error" && <p className="inline-error">{errorMessage}</p>}
        {status === "done" && reviewPackage && <ReviewPackageView reviewPackage={reviewPackage} />}
      </section>

      {latestRun && (
        <div className="layout-grid lower-grid">
          <section className="panel" aria-labelledby="activity-heading">
            <h2 id="activity-heading">Agent Activity</h2>
            <ol className="activity-list">
              {latestRun.observabilitySteps.map((step) => (
                <li key={`${step.name}-${step.timestamp}`}>
                  <strong>{step.name.replace(/_/g, " ")}</strong>
                  <span>{step.status}</span>
                  <p>{step.summary}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel" aria-labelledby="human-review-heading">
            <h2 id="human-review-heading">Human Review</h2>
            <p className="approval-note">
              Current review status: <strong>{latestRun.humanReview.status}</strong>. Nothing is sent to the customer.
            </p>
            <label>
              Decision
              <select value={reviewDecision} onChange={(event) => setReviewDecision(event.target.value as HumanReviewState["status"])}>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
                <option value="needs_changes">Needs changes</option>
              </select>
            </label>
            <label>
              Reviewer notes
              <textarea value={reviewerNotes} onChange={(event) => setReviewerNotes(event.target.value)} />
            </label>
            <button type="button" onClick={() => void submitHumanReview()}>
              <Save aria-hidden="true" />
              Submit review decision
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function ReviewPackageView({ reviewPackage }: { reviewPackage: ReviewPackage }) {
  return (
    <div className="review-grid">
      <article>
        <h3>Classification</h3>
        <p>{reviewPackage.classification.category}</p>
        <small>Confidence: {Math.round(reviewPackage.classification.confidence * 100)}%</small>
        <p>{reviewPackage.classification.rationale}</p>
      </article>
      <article>
        <h3>Sentiment</h3>
        <p>
          {reviewPackage.sentiment.label} / {reviewPackage.sentiment.urgency}
        </p>
        <small>{reviewPackage.sentiment.riskFlags.join(", ")}</small>
      </article>
      <article>
        <h3>Routing</h3>
        <p>{reviewPackage.routingRecommendation.queue}</p>
        <small>{reviewPackage.routingRecommendation.rationale}</small>
      </article>
      <article>
        <h3>Escalation</h3>
        <p>
          {reviewPackage.escalationRecommendation.escalate ? "Escalate" : "No escalation"} ·{" "}
          {reviewPackage.escalationRecommendation.severity}
        </p>
        <small>{reviewPackage.escalationRecommendation.reason}</small>
      </article>
      <article className="wide-card">
        <h3>Retrieved sources</h3>
        <ul>
          {reviewPackage.retrievedSources.map((source) => (
            <li key={source.sourceId}>
              <strong>{source.title}</strong>
              <p>{source.snippet}</p>
            </li>
          ))}
        </ul>
      </article>
      <article className="wide-card">
        <h3>Draft response</h3>
        <p>{reviewPackage.draftResponse.text}</p>
        <p className="approval-note">
          Human approval required: {reviewPackage.humanApprovalRequired ? "yes" : "no"}. This draft has not been sent.
        </p>
      </article>
      <article className="wide-card warning-card">
        <h3>Warnings</h3>
        <ul>
          {reviewPackage.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}

export default App;
