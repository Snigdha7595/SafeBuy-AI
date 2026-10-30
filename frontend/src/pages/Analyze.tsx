import { useEffect, useState, type ChangeEvent } from "react";
import { analyzeListing, ApiError, getSummary } from "../services/api";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Info } from "lucide-react";
import { CATALOG } from "../services/catalog";
import { analyzeDemo } from "../services/demoAnalysis";
import { toCents } from "../services/affordability";
import { useReports } from "../hooks/useReports";
import type { BudgetInput, Listing } from "../types";

const EMPTY: Listing = { name: "", category: "", price: "", currency: "USD", seller: "", description: "", listingText: "", returnPolicy: "", warranty: "", url: "", evidence: "" };
const PRIORITIES = ["Price", "Durability", "Warranty", "Delivery"];
type Errors = Partial<Record<string, string>>;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (<div><label htmlFor={id} className="label">{label}</label><div className="mt-1">{children}</div>
    {hint && !error && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger">{error}</p>}</div>);
}

export default function Analyze() {
  const nav = useNavigate();
  const { setCurrent } = useReports();
  const preset = (useLocation().state as { productId?: string } | null)?.productId;
  const seed = CATALOG.find((p) => p.id === preset);
  const [l, setL] = useState<Listing>(seed ?? EMPTY);
  const [catalogId, setCatalogId] = useState<string | undefined>(seed?.id);
  const [b, setB] = useState<BudgetInput>({ available: "", existing: "", urgency: "normal", priorities: [] });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ msg: string; offlineOk: boolean } | null>(null);

  // Prefill available budget from the planner when one is set (remaining after spending and planned purchases).
  useEffect(() => { getSummary().then((x) => { if (x.configured && x.remainingCents > 0) setB((p) => p.available ? p : { ...p, available: (x.remainingCents / 100).toFixed(2) }); }).catch(() => {}); }, []);
  const set = (k: keyof Listing) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setL({ ...l, [k]: e.target.value }); setCatalogId(undefined); };
  const err = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-err` : undefined });

  function validate(): Errors {
    const e: Errors = {};
    if (!l.name.trim()) e.name = "Enter the product name.";
    if (!l.category.trim()) e.category = "Enter a category, such as Headphones.";
    const p = toCents(l.price);
    if (p === null || p <= 0) e.price = "Enter a price greater than zero, like 129.99.";
    if (!l.description.trim() && !l.listingText.trim()) e.listingText = "Paste the description or listing text so there is something to analyze.";
    if (toCents(b.available) === null) e.available = "Enter your available budget (0 or more).";
    if (b.existing.trim() && toCents(b.existing) === null) e.existing = "Existing spending must be a number, 0 or more.";
    if (l.url.trim() && !/^https?:\/\/\S+\.\S+/.test(l.url.trim())) e.url = "Enter a full link starting with http:// or https://.";
    return e;
  }
  async function submit(ev?: React.FormEvent) {
    ev?.preventDefault();
    const e = validate(); setErrors(e); setFailed(null);
    if (Object.keys(e).length) { document.getElementById(Object.keys(e)[0])?.focus(); return; }
    setBusy(true);
    try { setCurrent(await analyzeListing(l, b, catalogId)); nav("/app/report"); }
    catch (x) {
      const ae = x instanceof ApiError ? x : null;
      setFailed({ msg: ae?.message ?? "The analysis failed. Try again.", offlineOk: ae?.kind === "network" });
    } finally { setBusy(false); }
  }
  function runOffline() {
    setCurrent(analyzeDemo(l, b, catalogId)); nav("/app/report");
  }
  const loadSample = (id: string) => { const p = CATALOG.find((c) => c.id === id)!; setL(p); setCatalogId(id); setErrors({}); };

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <div><h1 className="text-2xl font-semibold tracking-tight">Analyze a product</h1>
        <p className="mt-1 text-sm text-ink-soft">Paste the listing details you can see. SafeBuy AI reviews only what you provide.</p></div>

      <section className="surface p-5">
        <h2 className="font-semibold">Start from a demo listing</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATALOG.map((p) => <button type="button" key={p.id} onClick={() => loadSample(p.id)} className={`btn-secondary ${catalogId === p.id ? "!border-brand !bg-brand-tint" : ""}`}>{p.name}</button>)}
        </div>
        <p className="mt-2 text-xs text-ink-faint">Sample listings are invented demo data.</p>
      </section>

      <section className="surface space-y-4 p-5">
        <h2 className="font-semibold">Listing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Product name" error={errors.name}><input id="name" className="input" value={l.name} onChange={set("name")} {...err("name")} /></Field>
          <Field id="category" label="Category" error={errors.category}><input id="category" className="input" value={l.category} onChange={set("category")} {...err("category")} /></Field>
          <Field id="price" label="Price" error={errors.price}><input id="price" inputMode="decimal" className="input" value={l.price} onChange={set("price")} {...err("price")} /></Field>
          <Field id="currency" label="Currency"><select id="currency" className="input" value={l.currency} onChange={set("currency")}>{["USD", "EUR", "GBP"].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field id="seller" label="Seller name" hint="Leave blank if the listing doesn't show one."><input id="seller" className="input" value={l.seller} onChange={set("seller")} /></Field>
          <Field id="url" label="Product URL (optional)" error={errors.url}><input id="url" className="input" value={l.url} onChange={set("url")} {...err("url")} /></Field>
        </div>
        {l.url.trim() && <p className="flex gap-2 rounded-lg bg-paper p-3 text-xs text-ink-soft"><Info size={14} className="mt-0.5 shrink-0" aria-hidden />Links aren't fetched or scanned. The link is saved as a reference only, so paste the listing text below.</p>}
        <Field id="description" label="Seller description"><textarea id="description" rows={3} className="input" value={l.description} onChange={set("description")} /></Field>
        <Field id="listingText" label="Full listing text" error={errors.listingText}><textarea id="listingText" rows={4} className="input" value={l.listingText} onChange={set("listingText")} {...err("listingText")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="returnPolicy" label="Return and refund policy"><textarea id="returnPolicy" rows={2} className="input" value={l.returnPolicy} onChange={set("returnPolicy")} /></Field>
          <Field id="warranty" label="Warranty"><textarea id="warranty" rows={2} className="input" value={l.warranty} onChange={set("warranty")} /></Field>
        </div>
        <Field id="evidence" label="Other observations (optional)"><textarea id="evidence" rows={2} className="input" value={l.evidence} onChange={set("evidence")} /></Field>
      </section>

      <section className="surface space-y-4 p-5">
        <h2 className="font-semibold">Your budget</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="available" label={`Available discretionary budget (${l.currency})`} error={errors.available}><input id="available" inputMode="decimal" className="input" value={b.available} onChange={(e) => setB({ ...b, available: e.target.value })} {...err("available")} /></Field>
          <Field id="existing" label="Existing spending not yet deducted" error={errors.existing} hint="Optional."><input id="existing" inputMode="decimal" className="input" value={b.existing} onChange={(e) => setB({ ...b, existing: e.target.value })} {...err("existing")} /></Field>
          <Field id="urgency" label="How soon do you need it?"><select id="urgency" className="input" value={b.urgency} onChange={(e) => setB({ ...b, urgency: e.target.value as BudgetInput["urgency"] })}><option value="low">No rush</option><option value="normal">Within a few weeks</option><option value="high">Urgently</option></select></Field>
        </div>
        <fieldset><legend className="label">What matters most</legend>
          <div className="mt-2 flex flex-wrap gap-4">{PRIORITIES.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#0E8F6E]" checked={b.priorities.includes(p)}
              onChange={(e) => setB({ ...b, priorities: e.target.checked ? [...b.priorities, p] : b.priorities.filter((x) => x !== p) })} />{p}</label>))}</div></fieldset>
      </section>

      {failed && (<div role="alert" className="space-y-2 rounded-lg bg-danger-tint p-3 text-sm text-danger"><p>{failed.msg}</p>
        <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => submit()}>Try again</button>
          {failed.offlineOk && <button type="button" className="btn-secondary" onClick={runOffline}>Run offline demo analysis</button>}</div></div>)}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" aria-hidden />}{busy ? "Analyzing…" : "Analyze listing"}</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setL(EMPTY); setCatalogId(undefined); setErrors({}); }}>Clear form</button>
      </div>
    </form>
  );
}
