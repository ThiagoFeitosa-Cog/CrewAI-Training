import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Send, XCircle } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { getRunStatus, startRun } from "./services/stubCrewService";
import type { CrewStatus, ReviewPackage, RunStatus, TicketInput } from "./types";
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
  const [errorMessage, setErrorMessage] = useState<string>("");

  const formattedUpdated = useMemo(() => new Date(lastUpdated).toLocaleString(), [lastUpdated]);

  const updateTicket = (field: keyof TicketInput, value: string) => {
    setTicket((current) => ({ ...current, [field]: value }));
  };

  const runCrew = async () => {
    try {
      setErrorMessage("");
      setReviewPackage(null);
      setStatus("running");
      const started = await startRun(ticket);
      setLatestRun(started);
      setLastUpdated(started.lastUpdated);

      const completed = await getRunStatus(started.runId);
      setLatestRun(completed);
      setReviewPackage(completed.reviewPackage ?? null);
      setStatus(completed.status);
      setLastUpdated(completed.lastUpdated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The crew run failed.";
      const failedRun = {
        runId: latestRun?.runId ?? "not-started",
        status: "error" as CrewStatus,
        lastUpdated: new Date().toISOString(),
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

  const reset = () => {
    setTicket(seededTicket);
    setStatus("idle");
    setReviewPackage(null);
    setLatestRun(null);
    setErrorMessage("");
    setLastUpdated(new Date().toISOString());
  };

  return (
    <main className="app-shell">
      <section className={`status-banner status-${status}`} aria-live="polite">
        <div className="status-title">
          <StatusIcon status={status} />
          <strong>{statusCopy[status]}</strong>
          <span className="status-pill">{status}</span>
        </div>
        <span>Last updated: {formattedUpdated}</span>
      </section>

      <header className="page-header">
        <div>
          <p className="eyebrow">Multi-Agent Customer Support Crew</p>
          <h1>Customer Support Review Workflow</h1>
        </div>
        <p>
          Stubbed frontend module for reviewing a crew-generated support package. Drafts are for human
          review only and are never sent automatically.
        </p>
      </header>

      <div className="layout-grid">
        <section className="panel" aria-labelledby="ticket-form-heading">
          <h2 id="ticket-form-heading">Support ticket input</h2>
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
          <h2 id="history-heading">History</h2>
          {latestRun ? (
            <dl className="history-list">
              <div>
                <dt>Run ID</dt>
                <dd>{latestRun.runId}</dd>
              </div>
              <div>
                <dt>Ticket</dt>
                <dd>{ticket.subject}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusCopy[latestRun.status]}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{new Date(latestRun.lastUpdated).toLocaleString()}</dd>
              </div>
            </dl>
          ) : (
            <p>No crew runs yet. Use Run to create the latest review package.</p>
          )}
        </section>
      </div>

      <section className="panel results-panel" aria-labelledby="results-heading">
        <h2 id="results-heading">Review package result</h2>
        {status === "idle" && <p>Run the crew to generate a mocked review package.</p>}
        {status === "running" && <p>Crew: running. Classification, retrieval, drafting, routing, and escalation are being simulated.</p>}
        {status === "error" && <p className="inline-error">{errorMessage}</p>}
        {status === "done" && reviewPackage && <ReviewPackageView reviewPackage={reviewPackage} />}
      </section>
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

