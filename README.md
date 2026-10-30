# SafeBuy AI

**Before you buy, understand what you're buying.**

SafeBuy AI reviews the product-listing details you give it, points out what is missing or worth verifying, checks the price against your budget, and lets you pay through **PayPal Sandbox** only after you explicitly approve. Built for the PayPal AI Hackathon 2026.

> It assesses *the information you supply*. It cannot verify a seller, guarantee a product is safe, or catch every scam. See [Limitations](#limitations-and-responsible-ai).

## Features

- **Listing analysis**: structured findings, each with the observed fact, the quoted source text, why it matters, confidence, and what to verify.
- **Seller transparency**: which details are present, missing or unclear (never presented as independently verified).
- **Affordability engine**: exact `Decimal` math in the backend. The LLM never computes totals.
- **Product comparison** across a curated demo catalog, and a **budget planner** with a what-if calculator.
- **PayPal Sandbox checkout**: Orders API v2 + JavaScript SDK v6, server-created orders, server-side capture and verification, **signature-verified webhooks** (pending payments settle, refunds recorded), persisted transactions.
- **Purchase history** in an AG Grid table (sortable, filterable).
- **Demo mode**: works with no AI key and no PayPal credentials, with clear labels. It never fakes a payment.

> **New to VS Code?** Follow [docs/VSCODE.md](docs/VSCODE.md). It has one-click tasks and a 5-minute check list.
> **Hosting:** [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md). **Devpost text and video script:** [docs/DEVPOST.md](docs/DEVPOST.md).

## Quick start

Requirements: Node 18+, Python 3.10+.

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Open http://localhost:5173 and choose **Try the demo**. Everything except live AI and PayPal works immediately.

## Environment variables

Copy `.env.example` to `.env` in the project root (it is git-ignored). Never commit real values.

| Variable | Purpose | Default |
|---|---|---|
| `LLM_API_KEY` | Enables live AI analysis (Anthropic Messages API). Empty = rule-based demo mode. | empty |
| `LLM_MODEL` | Model name. Check it against your account. | `claude-sonnet-5-5` |
| `LLM_TIMEOUT_SECONDS` | AI request timeout | `30` |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal **Sandbox** app credentials | empty |
| `PAYPAL_ENV` | Must be `sandbox`. Any other value disables payments. | `sandbox` |
| `PAYPAL_WEBHOOK_ID` | Webhook ID from the PayPal dashboard (needs a public URL) | empty |
| `FRONTEND_DIST` | Path to the built frontend; set by the Docker image | empty |
| `ALLOWED_ORIGINS` | CORS origins, comma separated | `http://localhost:5173` |
| `SAFEBUY_DB` | SQLite file path | `backend/safebuy.db` |

## Configure PayPal Sandbox

1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/) and open **Apps & Credentials** in **Sandbox**.
2. Create an app and copy its **Client ID** and **Secret** into `.env`.
3. Under **Sandbox → Accounts**, use (or create) a **Personal** sandbox buyer account for testing.
4. Restart the backend. The checkout page shows a setup screen until both values are present.
5. Analyze **Aurora ANC Headphones**, continue to checkout, tick the approval box, and pay with the sandbox buyer.

Webhooks (optional but recommended once deployed): add `https://<host>/api/paypal/webhook` in the dashboard and set `PAYPAL_WEBHOOK_ID`. Events are verified through PayPal's verify-webhook-signature API, and the order is re-fetched from PayPal rather than trusting the event body.

Flow: the browser asks the backend to create an order (price comes from the server catalog, never the client) → buyer approves via the PayPal JS SDK v6 payment session → the backend captures the order → the backend checks order ID, amount, currency and capture status against what it stored. Only a fully verified capture is recorded as `COMPLETED`.

> The PayPal integration is covered by automated tests against mocked PayPal responses. Run one real sandbox payment yourself before recording your demo.

## Demo walkthrough (about 3 minutes)

1. **Problem (15s):** shoppers face vague listings and urgency tactics, and rarely check the budget impact.
2. **Analyze (30s):** Analyze → load **BassMax Pro Headphones** → enter a budget → Analyze listing.
3. **Evidence (45s):** show findings with quoted text, confidence, and verification steps. Point out the low price is *not* called fraud.
4. **Affordability (20s):** show remaining balance, percent used, and cheaper alternatives.
5. **Compare (15s):** open Compare, pick another headphone, then Analyze this.
6. **Pay (45s):** analyze **Aurora ANC Headphones** → Continue to checkout → approve → PayPal Sandbox.
7. **Result (20s):** verified status, then Purchase history with the analysis link.

## Architecture

```
frontend/ (React, Vite, TS, Tailwind)          backend/app/ (FastAPI)
  pages, components, hooks            /api      api/        routes (analyze, checkout, planner)
  services/api.ts  ───────────────────────────► services/   analysis, llm, rules, affordability, paypal
                                                schemas/    Pydantic request/response/LLM models
PayPal JS SDK (buttons)  ──► PayPal Sandbox ◄── database/   SQLite data-access layer
                                       data/catalog.json (demo catalog)
```

- **Analysis**: `rules.py` computes seller transparency and price context in code. In live mode the LLM supplies findings, which are schema-validated, and findings quoting text not in the listing are dropped. On any AI failure the app falls back to rules and says so.
- **Money**: integer cents and `Decimal` only. Inputs like `NaN`, `1e3`, negatives and 3 decimals are rejected.
- **Persistence**: SQLite for transactions, budget settings, planned purchases and saved analyses, behind `backend/app/database/`.
- **Safety**: listing text is passed as delimited, untrusted data; the system prompt forbids following instructions inside it. 10 analyses/minute per IP.

## Tests

```bash
cd backend && python -m pytest          # API, money, AI validation, PayPal state machine, webhooks, planner
cd frontend && npm test                 # form validation, report, checkout, history, budget, error states
cd frontend && npm run build            # type-check + production build
```

## Limitations and responsible AI

- Assessments cover only the text you provide. No external sources, seller databases or reviews are consulted, and the app never says otherwise.
- A low price or a missing detail is a reason to check, not proof of wrongdoing. Confidence labels describe how directly the text supports a finding; they are not calibrated probabilities.
- Pasted URLs are not fetched or scanned. (Fetching would need SSRF protection.)
- The product catalog, sellers and sample prices are invented demo data.
- **Single-user demo mode**: there is no authentication. Do not expose a deployed instance with personal data.
- Payments are Sandbox only, and no real money moves. The AI recommends; it never initiates a payment.
- The catalog exists in both `data/catalog.json` (backend) and `frontend/src/services/catalog.ts`. Keep them in sync.
- In-memory rate limiting suits one server process only.

## Submission checklist (not yet done)

- [ ] Replace `[Your Name]` in `LICENSE`
- [ ] Push to a **public** GitHub repository
- [ ] Run one real PayPal Sandbox payment end to end
- [ ] Record and publish a public YouTube demo under 3 minutes

## License

MIT. See [LICENSE](LICENSE).
