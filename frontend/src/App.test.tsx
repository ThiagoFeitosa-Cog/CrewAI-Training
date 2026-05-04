import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("Customer Support Review Workflow", () => {
  it("runs the stubbed crew workflow and renders the review package", async () => {
    render(<App />);

    expect(screen.getByText("Crew: idle")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toHaveValue("Urgent: API sync failed again before our renewal review");

    await userEvent.click(screen.getByRole("button", { name: /run/i }));

    expect(screen.getByText("Crew: running")).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText("Crew: done").length).toBeGreaterThan(0), { timeout: 2000 });
    expect(screen.getAllByText("technical_support").length).toBeGreaterThan(0);
    expect(screen.getByText(/Human approval required: yes/i)).toBeInTheDocument();
    expect(screen.getByText(/This draft has not been sent/i)).toBeInTheDocument();
  });

  it("resets the workflow back to idle", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    await waitFor(() => expect(screen.getAllByText("Crew: done").length).toBeGreaterThan(0), { timeout: 2000 });

    await userEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByText("Crew: idle")).toBeInTheDocument();
    expect(screen.getByText("No crew runs yet. Use Run to create the latest review package.")).toBeInTheDocument();
  });
});
