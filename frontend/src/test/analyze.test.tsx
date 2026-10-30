import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Analyze from "../pages/Analyze";
import { mockApi, renderPage, sampleReport } from "./utils";

const health = { "/budget/summary": { body: { configured: false } } };

describe("Analyze form", () => {
  it("shows inline errors and does not call the API when empty", async () => {
    const calls = mockApi(health);
    renderPage(<Analyze />);
    await userEvent.click(screen.getByRole("button", { name: /analyze listing/i }));
    expect(await screen.findByText(/enter the product name/i)).toBeInTheDocument();
    expect(screen.getByText(/greater than zero/i)).toBeInTheDocument();
    expect(screen.getByText(/available budget/i, { selector: "p" })).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("/analyze"))).toBe(false);
  });

  it("rejects a malformed price", async () => {
    mockApi(health); renderPage(<Analyze />);
    await userEvent.type(screen.getByRole("textbox", { name: "Price" }), "12.345");
    await userEvent.click(screen.getByRole("button", { name: /analyze listing/i }));
    expect(await screen.findByText(/greater than zero, like 129.99/i)).toBeInTheDocument();
  });

  it("never claims a pasted URL was scanned", async () => {
    mockApi(health); renderPage(<Analyze />);
    await userEvent.type(screen.getByLabelText(/product url/i), "https://shop.example/item");
    expect(screen.getByText(/aren't fetched or scanned/i)).toBeInTheDocument();
  });

  it("loads a sample listing into the form", async () => {
    mockApi(health); renderPage(<Analyze />);
    await userEvent.click(screen.getByRole("button", { name: "BassMax Pro Headphones" }));
    expect(screen.getByLabelText("Product name")).toHaveValue("BassMax Pro Headphones");
    expect(screen.getByRole("textbox", { name: "Price" })).toHaveValue("39.00");
  });

  it("submits to the backend and navigates to the report on success", async () => {
    const calls = mockApi({ ...health, "/analyze": { body: sampleReport() } });
    renderPage(<Analyze />);
    await userEvent.click(screen.getByRole("button", { name: "Aurora ANC Headphones" }));
    await userEvent.type(screen.getByLabelText(/available discretionary budget/i), "500");
    await userEvent.click(screen.getByRole("button", { name: /analyze listing/i }));
    await waitFor(() => expect(screen.getByText("navigated-away")).toBeInTheDocument());
    const post = calls.find((c) => c.url.includes("/analyze"))!;
    expect(JSON.parse(String(post.init?.body)).catalogId).toBe("hp-1");
  });

  it("offers retry and an explicit offline option when the server is unreachable", async () => {
    mockApi({ ...health, "/analyze": "network-error" });
    renderPage(<Analyze />);
    await userEvent.click(screen.getByRole("button", { name: "Aurora ANC Headphones" }));
    await userEvent.type(screen.getByLabelText(/available discretionary budget/i), "500");
    await userEvent.click(screen.getByRole("button", { name: /analyze listing/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the safebuy server/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /offline demo analysis/i })).toBeInTheDocument();
  });

  it("shows server validation and rate-limit messages without an offline option", async () => {
    mockApi({ ...health, "/analyze": { status: 429, body: {} } });
    renderPage(<Analyze />);
    await userEvent.click(screen.getByRole("button", { name: "Aurora ANC Headphones" }));
    await userEvent.type(screen.getByLabelText(/available discretionary budget/i), "500");
    await userEvent.click(screen.getByRole("button", { name: /analyze listing/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many requests/i);
    expect(screen.queryByRole("button", { name: /offline demo/i })).toBeNull();
  });
});
