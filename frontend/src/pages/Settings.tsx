import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHealth } from "../services/api";

export default function Settings() {
  const [h, setH] = useState<{ aiMode: string; paypalConfigured: boolean } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { getHealth().then(setH).catch(() => setErr(true)); }, []);
  const row = (k: string, v: string) => <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-ink-soft">{k}</dt><dd className="font-medium">{v}</dd></div>;
  return (
    <div className="space-y-6"><h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <section className="surface p-5"><h2 className="font-semibold">Server status</h2>
        {err ? <p role="alert" className="mt-2 text-sm text-danger">Can't reach the backend. Start it with <code>uvicorn app.main:app --port 8000</code>.</p> :
          !h ? <p className="mt-2 text-sm text-ink-soft">Checking…</p> : <dl className="mt-2 divide-y divide-line">
            {row("AI analysis", h.aiMode === "live" ? "Live (LLM configured)" : "Demo (rule-based, no AI key)")}
            {row("PayPal", h.paypalConfigured ? "Sandbox configured" : "Not configured")}
            {row("Payment environment", "Sandbox only. No real money.")}</dl>}</section>
      <section className="surface p-5"><h2 className="font-semibold">Accounts</h2>
        <p className="mt-2 text-sm text-ink-soft">This build runs in single-user demo mode. There is no sign-in, so everything saved lives in the local database on the machine running the backend. Don't expose it publicly with personal data.</p></section>
      <section className="surface p-5"><h2 className="font-semibold">Budget</h2><p className="mt-2 text-sm text-ink-soft">Set your monthly budget in the <Link className="text-brand-dark underline" to="/app/budget">Budget planner</Link>.</p></section>
    </div>
  );
}
