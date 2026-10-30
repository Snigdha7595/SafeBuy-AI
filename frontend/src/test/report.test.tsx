import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Report from "../pages/Report";
import { mockApi, renderPage, sampleReport } from "./utils";

describe("Report", () => {
  it("shows evidence, uncertainty and a not-verified seller note", async () => {
    renderPage(<Report />, { report: sampleReport("hp-2") });
    expect(await screen.findByText("No seller identified")).toBeInTheDocument();
    expect(screen.getAllByText(/confidence/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no seller was independently verified/i)).toBeInTheDocument();
    expect(screen.getByText(/not a statistical probability/i)).toBeInTheDocument();
    expect(screen.getByText(/rule-based, not a live ai scan/i)).toBeInTheDocument();
  });

  it("does not call a low price fraud", async () => {
    renderPage(<Report />, { report: sampleReport("hp-2") });
    expect(await screen.findByText(/not a sign of fraud/i)).toBeInTheDocument();
  });

  it("enables checkout only for catalog products", async () => {
    const { unmount } = renderPage(<Report />, { report: sampleReport("hp-1", "500") });
    expect(await screen.findByRole("link", { name: /continue to checkout/i })).toBeInTheDocument();
    unmount();
    const custom = { ...sampleReport("hp-1", "500"), catalogId: null };
    renderPage(<Report />, { report: custom });
    expect(await screen.findByRole("button", { name: /continue to checkout/i })).toBeDisabled();
    expect(screen.getByText(/only available for demo catalog products/i)).toBeInTheDocument();
  });

  it("shows over-budget state with the shortfall", async () => {
    renderPage(<Report />, { report: sampleReport("mon-1", "200") });
    expect(await screen.findByText(/doesn't fit your available budget/i)).toBeInTheDocument();
    expect(screen.getByText("Over budget by")).toBeInTheDocument();
  });

  it("saves via the backend and confirms", async () => {
    const calls = mockApi({ "/analyses": { body: { id: "x", productName: "p", assessment: "a", createdAt: "now" } } });
    renderPage(<Report />, { report: sampleReport("hp-1", "500") });
    await userEvent.click(await screen.findByRole("button", { name: /save analysis/i }));
    expect(await screen.findByRole("button", { name: /^saved$/i })).toBeInTheDocument();
    expect(calls[0].init?.method).toBe("POST");
  });

  it("surfaces a save failure instead of pretending it saved", async () => {
    mockApi({ "/analyses": "network-error" });
    renderPage(<Report />, { report: sampleReport("hp-1", "500") });
    await userEvent.click(await screen.findByRole("button", { name: /save analysis/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save/i);
    expect(screen.queryByRole("button", { name: /^saved$/i })).toBeNull();
  });

  it("asks for an analysis first when none exists", () => {
    renderPage(<Report />);
    expect(screen.getByText(/no analysis yet/i)).toBeInTheDocument();
  });
});
