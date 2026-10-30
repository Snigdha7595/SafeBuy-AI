import type { Affordability, BudgetInput, BudgetSettings, BudgetSummary, PlannedItem, SavedItem, Listing, PaypalConfig, Report, Transaction } from "../types";

export class ApiError extends Error { constructor(message: string, public kind: "network" | "validation" | "rate" | "server") { super(message); } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...init, signal: AbortSignal.timeout(60000) }); }
  catch { throw new ApiError("Can't reach the SafeBuy server. Check that the backend is running.", "network"); }
  if (res.status === 204) return undefined as T;
  if (res.ok) return res.json();
  if (res.status === 429) throw new ApiError("Too many requests. Wait a minute and try again.", "rate");
  if (res.status === 422) {
    const d = await res.json().catch(() => null);
    const first = d?.detail?.[0];
    throw new ApiError(first ? `${String(first.loc?.slice(-1)[0] ?? "Input")}: ${first.msg.replace("Value error, ", "")}` : "Some inputs are invalid.", "validation");
  }
  const d = await res.json().catch(() => null);
  throw new ApiError(typeof d?.detail === "string" ? d.detail : "The server hit an error. Try again.", "server");
}

export const analyzeListing = (listing: Listing, budget: BudgetInput, catalogId?: string) =>
  request<Report>("/analyze", { method: "POST", body: JSON.stringify({ listing, budget, catalogId }) });
export const getHealth = () => request<{ status: string; aiMode: "live" | "demo"; paypalConfigured: boolean }>("/health");

export const getPaypalConfig = () => request<PaypalConfig>("/paypal/config");
export const createCheckoutOrder = (b: { productId: string; analysisId?: string; available?: string; existing?: string }) =>
  request<{ orderId: string; transactionId: string; amount: string; currency: string }>("/checkout/orders", { method: "POST", body: JSON.stringify({ ...b, approved: true }) });
export const captureOrder = (id: string) => request<Transaction>(`/checkout/orders/${id}/capture`, { method: "POST" });
export const refreshOrder = (id: string) => request<Transaction>(`/checkout/orders/${id}/refresh`, { method: "POST" });
export const cancelOrder = (id: string) => request<Transaction>(`/checkout/orders/${id}/cancel`, { method: "POST" });
export const getTransactions = () => request<Transaction[]>("/transactions");

export const getSettings = () => request<BudgetSettings>("/settings");
export const putSettings = (b: { currency: string; monthlyBudget: string; spent: string }) => request<BudgetSettings>("/settings", { method: "PUT", body: JSON.stringify(b) });
export const getSummary = () => request<BudgetSummary>("/budget/summary");
export const addPlanned = (name: string, amount: string) => request<PlannedItem>("/planned", { method: "POST", body: JSON.stringify({ name, amount }) });
export const deletePlanned = (id: string) => request<void>(`/planned/${id}`, { method: "DELETE" });
export const runScenario = (price: string) => request<Affordability>("/budget/scenario", { method: "POST", body: JSON.stringify({ price }) });
export const listAnalyses = () => request<SavedItem[]>("/analyses");
export const saveAnalysis = (r: Report) => request<SavedItem>("/analyses", { method: "POST", body: JSON.stringify(r) });
export const getAnalysis = (id: string) => request<Report>(`/analyses/${id}`);
export const deleteAnalysis = (id: string) => request<void>(`/analyses/${id}`, { method: "DELETE" });
