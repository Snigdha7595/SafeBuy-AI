import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Checkout from "../pages/Checkout";
import { mockApi, renderPage, sampleReport } from "./utils";

const rep = () => sampleReport("hp-1", "500");

describe("Checkout", () => {
  it("shows setup instructions, not a fake payment, when PayPal isn't configured", async () => {
    mockApi({ "/paypal/config": { body: { configured: false, clientId: null, environment: "sandbox", currency: "USD" } } });
    renderPage(<Checkout />, { report: rep() });
    expect(await screen.findByText(/paypal sandbox isn't set up/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/nothing here is simulated/i)).toBeInTheDocument();
  });

  it("requires explicit approval and states it's a sandbox test", async () => {
    mockApi({ "/paypal/config": { body: { configured: true, clientId: "cid", environment: "sandbox", currency: "USD" } } });
    renderPage(<Checkout />, { report: rep() });
    const box = await screen.findByRole("checkbox");
    expect(box).not.toBeChecked();
    expect(screen.getByText(/no real money is charged/i, { selector: "p span, label span" })).toBeInTheDocument();
    expect(screen.getByText(/never pays for you/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/paypal payment buttons/i)).toBeNull();
  });

  it("shows a retry when the config request fails", async () => {
    mockApi({ "/paypal/config": "network-error" });
    renderPage(<Checkout />, { report: rep() });
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("refuses checkout for a non-catalog listing", () => {
    renderPage(<Checkout />, { report: { ...rep(), catalogId: null } });
    expect(screen.getByText(/available for demo catalog products/i)).toBeInTheDocument();
  });
});

describe("Checkout with PayPal SDK v6 (faked SDK)", () => {
  it("creates the order on the server, then captures on approval and shows a verified result", async () => {
    let cb: { onApprove: (x: { orderId: string }) => Promise<void> } | null = null;
    const fakeSdk = {
      findEligibleMethods: async () => ({ isEligible: (m: string) => m === "paypal" }),
      createPayPalOneTimePaymentSession: (callbacks: typeof cb) => { cb = callbacks;
        return { start: async (_o: unknown, order: Promise<{ orderId: string }>) => { const { orderId } = await order; await cb!.onApprove({ orderId }); } }; },
    };
    const createInstance = vi.fn(async () => fakeSdk);
    (window as unknown as { paypal: unknown }).paypal = { createInstance };
    const calls = mockApi({
      "/paypal/config": { body: { configured: true, clientId: "cid", environment: "sandbox", currency: "USD" } },
      "/checkout/orders/ORDER123/capture": { body: { id: "t", paypalOrderId: "ORDER123", productId: "hp-1", productName: "Aurora ANC Headphones", amount: "129.00", currency: "USD", status: "COMPLETED", captureId: "CAP1", environment: "sandbox", createdAt: "x", updatedAt: "x" } },
      "/checkout/orders": { body: { orderId: "ORDER123", transactionId: "t", amount: "129.00", currency: "USD" } },
    });
    const { container } = renderPage(<Checkout />, { report: rep() });
    await userEvent.click(await screen.findByRole("checkbox"));
    const btn = await waitFor(() => { const b = container.querySelector("paypal-button"); expect(b).not.toBeNull(); return b!; });
    expect(createInstance).toHaveBeenCalledWith(expect.objectContaining({ clientId: "cid", components: ["paypal-payments"] }));
    await userEvent.click(btn);
    expect(await screen.findByText(/payment verified/i)).toBeInTheDocument();
    const create = calls.find((c) => c.url.endsWith("/checkout/orders"))!;
    expect(JSON.parse(String(create.init?.body))).toMatchObject({ productId: "hp-1", approved: true });
    expect(JSON.parse(String(create.init?.body)).amount).toBeUndefined();   // the browser never sends a price
    delete (window as unknown as { paypal?: unknown }).paypal;
  });
});
