import type { Affordability, CatalogProduct } from "../types";

/** Parses a decimal string into integer cents. Returns null if invalid or negative. No floats in the math. */
export function toCents(v: string): number | null {
  const s = v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0"));
}
export const fromCents = (c: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(c / 100);

/** TEMPORARY client-side calculation for demo mode. Stage 3 moves the authoritative version to the backend (Decimal). */
export function computeAffordability(
  price: string, available: string, existing: string, currency: string, catalog: CatalogProduct[], excludeId?: string
): Affordability {
  const base: Affordability = { priceCents: 0, budgetCents: 0, remainingCents: 0, percentUsed: 0, fits: false, shortfallCents: 0, alternatives: [] };
  const p = toCents(price), a = toCents(available), e = existing.trim() ? toCents(existing) : 0;
  if (p === null || p <= 0) return { ...base, error: "Enter a price greater than zero, like 129.99." };
  if (a === null) return { ...base, error: "Enter your available budget as a non-negative number." };
  if (e === null) return { ...base, error: "Existing spending must be a non-negative number." };
  const budget = Math.max(a - e, 0);
  const remaining = budget - p;
  const percentUsed = budget === 0 ? 100 : Math.round((p * 1000) / budget) / 10;
  const alternatives = catalog.filter((c) => c.id !== excludeId && c.currency === currency && (toCents(c.price) ?? Infinity) <= budget && (toCents(c.price) ?? 0) < p);
  return { priceCents: p, budgetCents: budget, remainingCents: remaining, percentUsed, fits: remaining >= 0, shortfallCents: remaining < 0 ? -remaining : 0, alternatives };
}
