import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Budget from "../pages/Budget";
import { mockApi, renderPage } from "./utils";

const sum = { configured: true, currency: "USD", monthlyBudgetCents: 60000, spentCents: 21500, plannedCents: 18900, remainingCents: 19600, percentCommitted: 67.3, planned: [{ id: "p1", name: "Desk", amount: "189.00", currency: "USD" }] };
const set = { configured: true, currency: "USD", monthlyBudget: "600.00", spent: "215.00" };

describe("Budget planner", () => {
  it("shows server-computed remaining balance and planned items", async () => {
    mockApi({ "/budget/summary": { body: sum }, "/settings": { body: set } });
    renderPage(<Budget />);
    expect(await screen.findByText("$196.00")).toBeInTheDocument();
    expect(screen.getByText("Desk")).toBeInTheDocument();
    expect(screen.getByText(/67.3% of \$600.00 committed/)).toBeInTheDocument();
  });

  it("marks an over-budget plan clearly", async () => {
    mockApi({ "/budget/summary": { body: { ...sum, remainingCents: -4000 } }, "/settings": { body: set } });
    renderPage(<Budget />);
    expect(await screen.findByText(/you're over budget/i)).toBeInTheDocument();
  });

  it("runs a scenario and reports the shortfall", async () => {
    mockApi({ "/budget/summary": { body: sum }, "/settings": { body: set },
      "/budget/scenario": { body: { priceCents: 30000, budgetCents: 19600, remainingCents: -10400, percentUsed: 153.1, fits: false, shortfallCents: 10400, alternatives: [] } } });
    renderPage(<Budget />);
    await userEvent.type(await screen.findByLabelText("Scenario price"), "300");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("$104.00")).toBeInTheDocument();
  });

  it("shows server validation errors for a bad budget", async () => {
    mockApi({ "/budget/summary": { body: { ...sum, configured: false } }, "/settings": (_u, i) => (i?.method === "PUT" ? { status: 422, body: { detail: [{ loc: ["body", "monthlyBudget"], msg: "Value error, monthly budget must be a plain number like 129.99" }] } } : { body: { configured: false } }) });
    renderPage(<Budget />);
    await userEvent.type(await screen.findByLabelText("Monthly discretionary budget"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/plain number/i);
  });
});
