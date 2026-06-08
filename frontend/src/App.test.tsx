import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const updatedAt = "2026-06-07T23:30:00.000Z";

const apiRun = {
  run_id: "run-test-001",
  trace_id: "run-test-001",
  status: "done",
  runtime_mode: "deterministic",
  requested_runtime_mode: "deterministic",
  actual_runtime_mode: "deterministic",
  runtime_status: "success",
  runtime_error: null,
  review_package_parse_status: "parsed",
  llm_kickoff_attempted: false,
  updated_at: updatedAt,
  review_package: {
    classification: {
      category: "technical_support",
      confidence: 0.82,
      rationale: "The ticket mentions API sync failure and blocked revenue workflow.",
    },
    sentiment: {
      sentiment_label: "high_risk",
      urgency: "critical",
      risk_flags: ["urgent_language", "frustration", "renewal_risk"],
    },
    retrieval: {
      sources: [
        {
          source_id: "api-sync-troubleshooting",
          title: "API Sync Troubleshooting",
          snippet: "Confirm affected integration, latest sync timestamp, auth status, and recent error messages.",
          relevance_score: 1,
        },
      ],
    },
    draft_response: {
      draft_text: "A support agent should verify context and personalize this response before sending it.",
      source_ids: ["api-sync-troubleshooting"],
      sendable_after_human_review: true,
    },
    routing: {
      queue: "technical_support",
      rationale: "API sync failures should be reviewed by Technical Support.",
    },
    escalation: {
      escalate: true,
      severity: "P1",
      target: "customer_success_manager",
      reason: "Enterprise customer, repeated failure, frustration, and renewal risk.",
    },
    warnings: ["Human approval is required before sending any response."],
    human_approval_required: true,
    ready_for_human_review: true,
  },
  observability_steps: [
    {
      name: "classification",
      status: "completed",
      summary: "Classified as technical_support.",
      timestamp: updatedAt,
    },
  ],
  events: [
    {
      event_id: "evt-001",
      run_id: "run-test-001",
      trace_id: "run-test-001",
      event_type: "run_started",
      timestamp: updatedAt,
      safe_summary: "Run started in deterministic mode.",
      step_name: null,
      duration_ms: null,
      metadata: {},
    },
    {
      event_id: "evt-002",
      run_id: "run-test-001",
      trace_id: "run-test-001",
      event_type: "run_completed",
      timestamp: updatedAt,
      safe_summary: "Run completed and ReviewPackage is ready for human review.",
      step_name: null,
      duration_ms: 42,
      metadata: { status: "done" },
    },
  ],
  metrics: {
    run_id: "run-test-001",
    trace_id: "run-test-001",
    runtime_mode: "deterministic",
    status: "done",
    started_at: updatedAt,
    finished_at: updatedAt,
    wall_time_ms: 42,
    step_metrics: [
      {
        step_name: "classification",
        status: "completed",
        started_at: updatedAt,
        finished_at: updatedAt,
        duration_ms: 5,
      },
    ],
    slowest_step: "classification",
    error: null,
    token_usage: null,
    cost_estimate: null,
  },
  observability_summary: {
    run_id: "run-test-001",
    trace_id: "run-test-001",
    runtime_mode: "deterministic",
    status: "done",
    started_at: updatedAt,
    finished_at: updatedAt,
    wall_time_ms: 42,
    slowest_step: "classification",
    event_count: 2,
    error: null,
  },
  human_review: {
    status: "pending",
    reviewer_notes: "",
    updated_at: null,
  },
};

const historyPayload = {
  runs: [
    {
      run_id: apiRun.run_id,
      trace_id: apiRun.trace_id,
      status: apiRun.status,
      runtime_mode: apiRun.runtime_mode,
      requested_runtime_mode: apiRun.requested_runtime_mode,
      actual_runtime_mode: apiRun.actual_runtime_mode,
      runtime_status: apiRun.runtime_status,
      runtime_error: apiRun.runtime_error,
      subject: "Urgent: API sync failed again before our renewal review",
      company_name: "Northstar Analytics",
      escalated: true,
      review_status: "pending",
      created_at: updatedAt,
      updated_at: updatedAt,
    },
  ],
};

const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);

  if (url.endsWith("/api/observability/summary")) {
    return Response.json({
      total_runs: 1,
      completed_runs: 1,
      error_runs: 0,
      average_wall_time_ms: 42,
      latest_run_id: apiRun.run_id,
      deterministic_mode_runs: 1,
      crewai_flow_mode_runs: 0,
      llm_mode_runs: 0,
    });
  }

  if (url.endsWith("/api/runs") && init?.method === "POST") {
    return Response.json(apiRun);
  }

  if (url.endsWith("/api/runs")) {
    return Response.json(historyPayload);
  }

  if (url.includes("/review")) {
    return Response.json({
      ...apiRun,
      human_review: { status: "approved", reviewer_notes: "Looks good.", updated_at: updatedAt },
    });
  }

  if (url.includes("/api/runs/")) {
    return Response.json(apiRun);
  }

  return new Response("Not found", { status: 404 });
});

describe("Customer Support Review Workflow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the dashboard as the initial view", async () => {
    render(<App />);

    expect(screen.getByText("Support Operations Console")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start new support run/i })).toBeInTheDocument();
    expect(screen.getByText("Recent Runs")).toBeInTheDocument();
    expect(await screen.findByText("Northstar Analytics")).toBeInTheDocument();
  });

  it("renders the new run form with runtime selector", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /start new support run/i }));

    expect(screen.getByLabelText("Customer ID")).toHaveValue("CUST-2048");
    expect(screen.getByLabelText("Company Name")).toHaveValue("Northstar Analytics");
    expect(screen.getByLabelText("Runtime Mode")).toHaveValue("deterministic");
    expect(screen.getByRole("button", { name: /run analysis/i })).toBeInTheDocument();
  });

  it("sends the selected runtime mode and opens run details", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /start new support run/i }));
    await userEvent.selectOptions(screen.getByLabelText("Runtime Mode"), "crewai_flow");
    await userEvent.click(screen.getByRole("button", { name: /run analysis/i }));

    await waitFor(() => expect(screen.getByText("Run Details")).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("Agent Results")).toBeInTheDocument();
    expect(screen.getByText("Human Review")).toBeInTheDocument();

    const postCall = mockFetch.mock.calls.find(([url, init]) => String(url).endsWith("/api/runs") && init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ runtimeMode: "crewai_flow" });
  });

  it("renders human review controls and submits a decision", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /start new support run/i }));
    await userEvent.click(screen.getByRole("button", { name: /run analysis/i }));

    await screen.findByText("Human Review");
    await userEvent.type(screen.getByLabelText("Reviewer notes"), "Looks good.");
    await userEvent.click(screen.getByRole("button", { name: /submit review decision/i }));

    await waitFor(() => expect(screen.getByText(/Saved review status:/i)).toBeInTheDocument());
    expect(mockFetch.mock.calls.some(([url]) => String(url).includes("/review"))).toBe(true);
  });

  it("renders the history table with filters", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /^history$/i }));

    expect(await screen.findByText("History / Reviews")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pending review/i })).toBeInTheDocument();
    expect(screen.getByText("Northstar Analytics")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^view$/i })).toBeInTheDocument();
  });
});
