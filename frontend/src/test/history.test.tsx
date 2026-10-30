import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import History from "../pages/History";
import { mockApi, renderPage } from "./utils";

const tx = (o: object) => ({ id: "t", paypalOrderId: "O", productId: "hp-1", productName: "Aurora", amount: "129.00", currency: "USD", status: "COMPLETED",
  environment: "sandbox", createdAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z", ...o });

describe("Purchase history", () => {
  it("labels each status distinctly and links to the analysis", async () => {
    mockApi({ "/transactions": { body: [tx({ id: "1", status: "COMPLETED", analysisId: "r-1", budgetRemainingCents: 32100 }),
      tx({ id: "2", productName: "Vista", status: "FAILED", failureReason: "Amount mismatch" }), tx({ id: "3", productName: "Desk", status: "PENDING" })] } });
    renderPage(<History />);
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toHaveAttribute("title", "Amount mismatch");
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("$321.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/app/analysis/r-1");
    expect(screen.getAllByText("Not recorded").length).toBe(2);
  });

  it("shows only one Completed row when only one is verified", async () => {
    mockApi({ "/transactions": { body: [tx({ id: "1" }), tx({ id: "2", status: "CREATED" })] } });
    renderPage(<History />);
    expect(await screen.findAllByText("Completed")).toHaveLength(1);
    expect(screen.getByText("Not approved")).toBeInTheDocument();
  });

  it("has an empty state", async () => {
    mockApi({ "/transactions": { body: [] } }); renderPage(<History />);
    expect(await screen.findByText(/no sandbox transactions yet/i)).toBeInTheDocument();
  });

  it("recovers from an error with Retry", async () => {
    let n = 0;
    mockApi({ "/transactions": () => (n++ === 0 ? { status: 500, body: {} } : { body: [] }) });
    renderPage(<History />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/server hit an error/i);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText(/no sandbox transactions yet/i)).toBeInTheDocument();
  });
});
