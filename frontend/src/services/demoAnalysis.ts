// Deterministic RULE-BASED analysis for demo mode. Not an LLM. Stage 3 adds the real backend AI service.
import type { BudgetInput, Finding, Listing, Report } from "../types";
import { CATALOG } from "./catalog";
import { computeAffordability, toCents, fromCents } from "./affordability";

const PRESSURE = /(limited time|only \d+ left|act now|hurry|today only|price rises|last chance|selling fast)/i;
const VAGUE_RETURN = /^(see (website|site)|contact us|n\/?a|tbd|varies)\.?$/i;

export function analyzeDemo(listing: Listing, budget: BudgetInput, catalogId?: string): Report {
  const text = `${listing.description}\n${listing.listingText}`;
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "id">) => findings.push({ ...f, id: `f${findings.length + 1}` });
  const missing: string[] = [];

  const hasSeller = listing.seller.trim().length > 1;
  const ret = listing.returnPolicy.trim();
  const retStatus = !ret ? "missing" : VAGUE_RETURN.test(ret) || ret.length < 12 ? "unclear" : "present";
  const hasWarranty = listing.warranty.trim().length > 3;

  if (!hasSeller) { missing.push("Seller name"); add({ title: "No seller identified", severity: "medium", confidence: "high",
    observed: "The submitted listing has no seller name.", source: "Seller field is empty",
    whyItMatters: "Without a seller name you can't look up their history or contact them if something goes wrong.",
    verify: "Find the seller's name and contact details on the platform before paying." }); }
  if (retStatus !== "present") { missing.push("Clear return terms"); add({ title: retStatus === "missing" ? "Return policy not stated" : "Return policy is unclear", severity: "medium", confidence: "high",
    observed: retStatus === "missing" ? "No return or refund terms were supplied." : `The return field says only "${ret}".`,
    source: retStatus === "missing" ? "Return policy field is empty" : "Return policy field",
    whyItMatters: "You can't tell how to get your money back if the item isn't as described.",
    verify: "Ask for the return window, who pays return shipping, and the refund method, in writing." }); }
  if (!hasWarranty) { missing.push("Warranty details"); add({ title: "No warranty details", severity: "low", confidence: "high",
    observed: "No warranty information was supplied.", source: "Warranty field is empty",
    whyItMatters: "Repairs or replacements after the return window may not be covered.",
    verify: "Ask what the warranty covers, how long it lasts, and who honors it." }); }
  const m = text.match(PRESSURE);
  if (m) add({ title: "Urgency language in listing", severity: "medium", confidence: "medium",
    observed: `The listing uses urgency wording: "${m[0]}".`, source: "Listing text",
    whyItMatters: "Pressure to buy quickly can discourage checking details. This alone doesn't show bad intent; many honest sellers use it.",
    verify: "Ignore the countdown and check the other items in this report first." });
  const res = text.match(/(\d{3,4})\s*x\s*(\d{3,4})/i);
  if (res && /\b4k\b/i.test(text) && Number(res[1]) < 3000) add({ title: "Title and specs disagree", severity: "high", confidence: "high",
    observed: `The listing says "4K" but also gives a resolution of ${res[1]}x${res[2]}.`, source: "Listing text",
    whyItMatters: "One of the two claims is wrong. It may be a typo or a misleading title.",
    verify: "Ask the seller to confirm the exact resolution, and check the manufacturer's spec sheet." });
  if (text.length < 40) missing.push("A meaningful description");

  // Price context: only same-category catalog entries, and we say so.
  const priceC = toCents(listing.price);
  const comps = CATALOG.filter((c) => c.category.toLowerCase() === listing.category.trim().toLowerCase() && c.id !== catalogId && c.currency === listing.currency);
  let priceContext = { basis: "No catalog products in this category.", comparableCount: 0, note: "No price comparison is possible, so none is drawn." };
  if (comps.length && priceC) {
    const prices = comps.map((c) => toCents(c.price)!).sort((a, b) => a - b);
    const med = prices[Math.floor(prices.length / 2)];
    priceContext = { basis: `${comps.length} demo catalog product${comps.length > 1 ? "s" : ""} in "${listing.category}" (median ${fromCents(med, listing.currency)}).`, comparableCount: comps.length,
      note: priceC < med * 0.5 ? "This price is well below the catalog median. That can have innocent causes (older model, different spec), so it's a prompt to compare specs, not a sign of fraud."
        : priceC > med * 1.5 ? "This price is well above the catalog median." : "This price is within a normal range of the comparison products." };
    if (priceC < med * 0.5) add({ title: "Price well below comparable demo products", severity: "low", confidence: "low",
      observed: `${fromCents(priceC, listing.currency)} vs. a catalog median of ${fromCents(med, listing.currency)}.`, source: "Demo catalog comparison",
      whyItMatters: "Large gaps are worth understanding, but a low price doesn't prove a problem.",
      verify: "Compare specs and condition (new, refurbished, older model) against the pricier options." });
  }

  const insufficient = text.length < 40 && !hasSeller && retStatus === "missing";
  const material = findings.filter((f) => f.severity !== "low").length;
  const assessment = insufficient ? "Insufficient information to assess" : material >= 3 || findings.some((f) => f.severity === "high") ? "Multiple material concerns require attention"
    : findings.length ? "Some details require verification" : "No major concerns identified in the supplied information";
  const affordability = computeAffordability(listing.price, budget.available, budget.existing, listing.currency, CATALOG, catalogId);

  const nextStep = insufficient ? "Add more of the listing text and seller details, then re-analyze."
    : findings.length ? `Verify: ${findings[0].verify}` : "Nothing stood out in what you supplied. Review the return terms once more, then decide.";
  const observed = [`Listed at ${fromCents(priceC ?? 0, listing.currency)} in ${listing.category || "an unspecified category"}.`,
    hasSeller ? `Seller named: ${listing.seller}.` : "No seller named.", hasWarranty ? `Warranty stated: ${listing.warranty}` : "No warranty stated.",
    retStatus === "present" ? `Returns: ${ret}` : "Return terms missing or unclear."];

  return { id: `r-${Date.now()}`, createdAt: new Date().toISOString(), mode: "demo-rules", catalogId: catalogId ?? null, listing, budget, assessment,
    summary: insufficient ? "There isn't enough information to assess this listing." : `Based only on the supplied text, we found ${findings.length} item${findings.length === 1 ? "" : "s"} to check.`,
    observed, findings, missing, priceContext, affordability, nextStep,
    seller: [
      { label: "Seller name", status: hasSeller ? "present" : "missing", note: hasSeller ? `${listing.seller} (not independently verified)` : "Not provided" },
      { label: "Return policy", status: retStatus, note: ret || "Not provided" },
      { label: "Warranty", status: hasWarranty ? "present" : "missing", note: listing.warranty || "Not provided" },
    ] };
}
