# Deploy on Render (hosted demo for judges)

One Docker service serves both the API and the website. Free-tier disk is ephemeral, so saved data resets on redeploy. That's fine for a demo.

1. Push the repo to GitHub (public).
2. Render → **New → Blueprint** → select the repo. It reads `render.yaml`. (Check field names against Render's current Blueprint docs if the import complains.)
3. In the service's **Environment** tab, set: `LLM_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`. Leave `PAYPAL_ENV=sandbox`.
4. After it deploys, open `https://<your-service>.onrender.com/api/health`. Expect `aiMode: live`, `paypalConfigured: true`.
5. **Webhook:** PayPal Developer Dashboard → your Sandbox app → **Webhooks → Add webhook**. URL: `https://<your-service>.onrender.com/api/paypal/webhook`. Subscribe to the capture events (completed, pending, denied, refunded, reversed). Copy the **Webhook ID** into Render as `PAYPAL_WEBHOOK_ID` and redeploy. `/api/paypal/config` then reports `webhookConfigured: true`.
6. Make one real sandbox payment on the hosted site.

**Cost protection:** the app has no sign-in, so anyone with the URL can trigger AI calls (limited to 10 per minute per visitor). Set a spend limit on the AI key, and take the service down after judging ends (Dec 15, 2026).
**Free tier sleeps** when idle, so the first request can take about a minute. Open the site yourself just before judging windows.
