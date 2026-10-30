# Devpost submission kit (edit the bracketed parts)

## Tagline
Before you buy, understand what you're buying.

## Project description (paste into Devpost)
**The problem.** Online listings are often vague: no seller name, unclear returns, urgency tactics. Shoppers rarely stop to check what a purchase does to their budget.

**What SafeBuy AI does.** You paste a listing. It lists what the text says, what's missing, and what to verify, each finding backed by a quote from the listing and an honest confidence label. It never says a seller is "safe" or "a scam." It calculates, with exact decimal math in code (never by the AI), what the purchase does to your monthly budget, and suggests cheaper options. If you decide to buy, you approve a PayPal Sandbox payment yourself. The AI recommends and never pays.

**How PayPal is central.** PayPal Orders API v2 for server-created orders (the price always comes from the server, never the browser); PayPal JavaScript SDK v6 for approval; server-side capture followed by verification of order ID, amount, currency and capture status before anything is marked Completed; **signature-verified webhooks** so pending payments settle and refunds are recorded even if the tab closes; every transaction is persisted with its budget impact.

**How AI is used.** An LLM analyzes the listing and must return schema-validated JSON. Listing text is treated as untrusted data (prompt-injection resistant). Any finding that quotes text not in the listing is dropped automatically. If the AI is down, the app falls back to rule-based analysis and says so.

**Built with.** React, TypeScript, Tailwind, Recharts, AG Grid, FastAPI, Pydantic, SQLite, PayPal REST + JS SDK v6, [LLM provider], Render.

**Challenges.** Keeping the AI honest (evidence-grounding, no invented sellers or reviews), and making payments trustworthy (idempotent capture, reconciliation after network errors, webhook re-verification).

**What's next.** Real product-catalog data, accounts, and PayPal's agent tooling for assisted checkout with the same human approval.

**New project.** Built during the Submission Period (Oct 1 – Nov 12, 2026).

## Testing instructions (paste into the Devpost testing field)
- **Hosted demo:** [https://YOUR-SERVICE.onrender.com] (the first load may take about a minute to wake).
- Try it: Analyze a product → *BassMax Pro Headphones* → budget 200 → Analyze. Then analyze *Aurora ANC Headphones* → Continue to checkout → tick approval → PayPal Sandbox.
- **Sandbox buyer login:** [email] / [password] (create a Personal sandbox account in the PayPal Developer Dashboard and paste it here, in the Devpost field only, never in the repo).
- **Run locally:** see README (`docs/VSCODE.md`). Works with no keys in demo mode.

## Video script (under 3:00, no music, no other brands on screen)
0:00 Problem (15s) · 0:15 Analyze BassMax (30s) · 0:45 Evidence and confidence, "low price ≠ fraud" (35s) · 1:20 Affordability and alternatives (20s) · 1:40 Aurora → approve → PayPal Sandbox pay (40s) · 2:20 Verified result + Purchase history (20s) · 2:40 Close (15s). Rehearse once and keep it under 2:50.

## Before you submit
- [ ] Public repo with LICENSE detected (replace `[Your Name]`) · [ ] Hosted demo works · [ ] One real sandbox payment done · [ ] Webhook ID set · [ ] Video public on YouTube · [ ] Sandbox buyer credentials only in the Devpost field · [ ] Submitted before **Nov 12, 2026, 12:00 pm Pacific**
