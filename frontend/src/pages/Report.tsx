import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CircleHelp, Bookmark, Columns3, RefreshCw, CreditCard, FlaskConical, Check } from "lucide-react";
import { useState } from "react";
import { useReports } from "../hooks/useReports";
import { saveAnalysis } from "../services/api";
import { fromCents, toCents } from "../services/affordability";
import type { Report as R, Severity } from "../types";

const sevStyle: Record<Severity, string> = { low: "bg-paper text-ink-soft", medium: "bg-caution-tint text-caution", high: "bg-danger-tint text-danger" };
const statusIcon = { present: <CheckCircle2 size={16} className="text-brand" aria-label="Present" />, missing: <AlertTriangle size={16} className="text-caution" aria-label="Missing" />, unclear: <CircleHelp size={16} className="text-caution" aria-label="Unclear" /> };

export default function Report() {
  const { current: r } = useReports();
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const nav = useNavigate();
  const [justSaved, setJustSaved] = useState(false);
  if (!r) return (<div className="surface p-6 text-sm"><p>No analysis yet.</p><Link to="/app/analyze" className="btn-primary mt-4">Analyze a product</Link></div>);
  const a = (r as R).affordability, cur = r.listing.currency, isSaved = justSaved;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight">{r.listing.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">{fromCents(a.priceCents, cur)} · {r.listing.category}</p></div>
        {r.mode === "llm" ? <span className="badge-ok">AI analysis · {r.model}</span>
          : <span className="badge-demo"><FlaskConical size={12} aria-hidden />Demo analysis: rule-based, not a live AI scan</span>}
      </div>

      <section className="surface p-5">
        <h2 className="text-lg font-semibold">{r.assessment}</h2>
        <p className="mt-1 text-sm text-ink-soft">{r.summary} This is an assessment of the information supplied, not a guarantee about the seller or product.</p>
        {r.notes?.map((n) => <p key={n} className="mt-2 text-xs text-ink-faint">{n}</p>)}
        <p className="mt-3 rounded-lg bg-paper p-3 text-sm"><span className="font-medium">Next step:</span> {r.nextStep}</p>
      </section>

      <section><h2 className="mb-3 font-semibold">Findings</h2>
        {r.findings.length === 0 ? <p className="surface p-5 text-sm text-ink-soft">No concerns found in the supplied text. That doesn't confirm the listing is trustworthy.</p> :
          <ul className="space-y-3">{r.findings.map((f) => (
            <li key={f.id} className="surface p-5">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{f.title}</h3>
                <span className={`badge ${sevStyle[f.severity]}`}>{f.severity} severity</span><span className="badge bg-paper text-ink-soft">{f.confidence} confidence</span></div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[110px_1fr]">
                <dt className="text-ink-faint">Observed</dt><dd>{f.observed}</dd>
                <dt className="text-ink-faint">Source</dt><dd>{f.source}</dd>
                <dt className="text-ink-faint">Why it matters</dt><dd>{f.whyItMatters}</dd>
                <dt className="text-ink-faint">Verify</dt><dd>{f.verify}</dd>
              </dl></li>))}</ul>}
        <p className="mt-2 text-xs text-ink-faint">Confidence reflects how clearly the supplied text supports the finding. It is not a statistical probability.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5"><h2 className="font-semibold">Seller transparency</h2>
          <ul className="mt-3 space-y-3 text-sm">{r.seller.map((s) => (
            <li key={s.label} className="flex gap-3">{statusIcon[s.status]}<div><p className="font-medium">{s.label}</p><p className="text-ink-soft">{s.note}</p></div></li>))}</ul>
          <p className="mt-3 text-xs text-ink-faint">No seller was independently verified.</p></section>
        <section className="surface p-5"><h2 className="font-semibold">Price context</h2>
          <p className="mt-3 text-sm">{r.priceContext.note}</p><p className="mt-2 text-xs text-ink-faint">Basis: {r.priceContext.basis}</p></section>
      </div>

      <section className="surface p-5"><h2 className="font-semibold">Affordability</h2>
        {a.error ? <p className="mt-2 text-sm text-danger">{a.error}</p> : <>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-ink-faint">Price</dt><dd className="text-lg font-semibold">{fromCents(a.priceCents, cur)}</dd></div>
            <div><dt className="text-ink-faint">Available</dt><dd className="text-lg font-semibold">{fromCents(a.budgetCents, cur)}</dd></div>
            <div><dt className="text-ink-faint">{a.fits ? "Remaining" : "Over budget by"}</dt><dd className={`text-lg font-semibold ${a.fits ? "" : "text-danger"}`}>{fromCents(a.fits ? a.remainingCents : a.shortfallCents, cur)}</dd></div>
            <div><dt className="text-ink-faint">Budget used</dt><dd className="text-lg font-semibold">{a.percentUsed}%</dd></div>
          </dl>
          <p className="mt-3 text-sm text-ink-soft">{a.fits ? "This fits your available budget." : "This doesn't fit your available budget."} Fitting the budget doesn't mean it's the right purchase.</p>
          {a.alternatives.length > 0 && <div className="mt-4"><h3 className="text-sm font-medium">Lower-priced demo alternatives that fit</h3>
            <ul className="mt-2 flex flex-wrap gap-2">{a.alternatives.map((p) => <li key={p.id}><Link to="/app/analyze" state={{ productId: p.id }} className="btn-secondary">{p.name} · {fromCents(toCents(p.price) ?? 0, p.currency)}</Link></li>)}</ul></div>}</>}
        <p className="mt-3 text-xs text-ink-faint">Calculated by the server with exact decimal math, not by the AI.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={async () => { setSaveErr(null); try { await saveAnalysis(r); setJustSaved(true); } catch (e) { setSaveErr((e as Error).message); } }}>{isSaved ? <Check size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}{isSaved ? "Saved" : "Save analysis"}</button>
        <Link to="/app/compare" className="btn-secondary"><Columns3 size={16} aria-hidden />Compare alternatives</Link>
        <button className="btn-secondary" onClick={() => nav("/app/analyze")}><RefreshCw size={16} aria-hidden />Re-analyze</button>
        {r.catalogId ? <Link to="/app/checkout" className="btn-primary"><CreditCard size={16} aria-hidden />Continue to checkout</Link>
          : <button className="btn-primary" disabled><CreditCard size={16} aria-hidden />Continue to checkout</button>}
      </div>
      {saveErr && <p role="alert" className="text-sm text-danger">Couldn't save: {saveErr}</p>}
      <p className="text-xs text-ink-faint">{r.catalogId ? "Checkout runs in PayPal Sandbox. You'll confirm before any payment, and no real money is charged." : "Checkout is only available for demo catalog products. Pick a catalog product to try it."}</p>
    </div>
  );
}
