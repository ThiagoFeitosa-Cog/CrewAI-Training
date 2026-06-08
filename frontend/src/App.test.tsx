import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const updatedAt = "2026-06-07T23:30:00.000Z";

const apiRun = {
  run_id: "run-test-001",
  status: "done",
  runtime_mode: "deterministic",
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
  human_review: {
    status: "pending",
    reviewer_notes: "",
    updated_at: null,
  },
};

const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith("/api/runs") && init?.method === "POST") {
    return Response.json(apiRun);
  }
  if (url.endsWith("/api/runs")) {
    return Response.json({
      runs: [
        {
          run_id: apiRun.run_id,
          status: apiRun.status,
          runtime_mode: apiRun.runtime_mode,
          subject: "Urgent: API sync failed again before our renewal review",
          review_status: "pending",
          created_at: updatedAt,
          updated_at: updatedAt,
        },
      ],
    });
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

  it("runs the integrated crew workflow and renders the review package", async () => {
    render(<App />);

    expect(screen.getByText("Crew: idle")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Urgent: API sync failed again before our renewal review");

    await userEvent.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => expect(screen.getAllByText("Crew: done").length).toBeGreaterThan(0), { timeout: 2000 });
    expect(screen.getAllByText("technical_support").length).toBeGreaterThan(0);
    expect(screen.getByText(/Human approval required: yes/i)).toBeInTheDocument();
    expect(screen.getByText(/This draft has not been sent/i)).toBeInTheDocument();
    expect(screen.getByText("Agent Activity")).toBeInTheDocument();
  });

  it("resets the workflow back to idle", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    await waitFor(() => expect(screen.getAllByText("Crew: done").length).toBeGreaterThan(0), { timeout: 2000 });

    await userEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByText("Crew: idle")).toBeInTheDocument();
    expect(screen.getByText("Run the crew to generate a backend ReviewPackage.")).toBeInTheDocument();
  });

  it("submits a human review decision", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    await waitFor(() => expect(screen.getByText("Human Review")).toBeInTheDocument(), { timeout: 2000 });

    await userEvent.type(screen.getByLabelText("Reviewer notes"), "Looks good.");
    await userEvent.click(screen.getByRole("button", { name: /submit review decision/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/review"), expect.any(Object)));
  });
});
