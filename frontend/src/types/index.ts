export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type Assessment =
  | "No major concerns identified in the supplied information"
  | "Some details require verification"
  | "Multiple material concerns require attention"
  | "Insufficient information to assess";

export interface Listing {
  name: string; category: string; price: string; currency: string; seller: string;
  description: string; listingText: string; returnPolicy: string; warranty: string;
  url: string; evidence: string;
}
export interface BudgetInput {
  available: string; existing: string; urgency: "low" | "normal" | "high"; priorities: string[];
}
export interface CatalogProduct extends Listing {
  id: string; specs: Record<string, string>; knownGaps: string[];
}
export interface Finding {
  id: string; title: string; severity: Severity; confidence: Confidence;
  observed: string; source: string; whyItMatters: string; verify: string;
}
export interface Affordability {
  priceCents: number; budgetCents: number; remainingCents: number; percentUsed: number;
  fits: boolean; shortfallCents: number; alternatives: CatalogProduct[]; error?: string;
}
export interface Report {
  id: string; createdAt: string; mode: "demo-rules" | "llm"; model?: string | null; notes?: string[]; catalogId?: string | null;
  listing: Listing; budget: BudgetInput;
  assessment: Assessment; summary: string;
  observed: string[]; findings: Finding[]; missing: string[];
  seller: { label: string; status: "present" | "missing" | "unclear"; note: string }[];
  priceContext: { basis: string; comparableCount: number; note: string };
  affordability: Affordability; nextStep: string;
}
export interface DemoReport { id: string; product: string; assessment: string; date: string; }
export type TxStatus = "CREATED" | "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED";
export interface Transaction {
  id: string; paypalOrderId: string; productId: string; productName: string; amount: string; currency: string;
  status: TxStatus; captureId?: string | null; failureReason?: string | null; analysisId?: string | null;
  budgetRemainingCents?: number | null; environment: string; createdAt: string; updatedAt: string;
}
export interface PaypalConfig { configured: boolean; clientId: string | null; environment: string; currency: string; webhookConfigured?: boolean; }
export interface BudgetSettings { configured: boolean; currency: string; monthlyBudget: string; spent: string; }
export interface PlannedItem { id: string; name: string; amount: string; currency: string; }
export interface BudgetSummary {
  configured: boolean; currency: string; monthlyBudgetCents: number; spentCents: number; plannedCents: number;
  remainingCents: number; percentCommitted: number; planned: PlannedItem[];
}
export interface SavedItem { id: string; productName: string; assessment: string; createdAt: string; }
