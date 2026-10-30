import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addPlanned, deletePlanned, getSettings, getSummary, putSettings, runScenario } from "../services/api";
import { fromCents, toCents } from "../services/affordability";
import type { Affordability, BudgetSummary } from "../types";

export default function Budget() {
  const [sum, setSum] = useState<BudgetSummary | null>(null);
  const [form, setForm] = useState({ currency: "USD", monthlyBudget: "", spent: "0" });
  const [plan, setPlan] = useState({ name: "", amount: "" });
  const [price, setPrice] = useState("");
  const [scen, setScen] = useState<Affordability | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => { const [s, st] = await Promise.all([getSummary(), getSettings()]); setSum(s); if (st.configured) setForm({ currency: st.currency, monthlyBudget: st.monthlyBudget, spent: st.spent }); };
  const load = () => { setErr(null); refresh().catch((e) => setErr(e.message)); };
  useEffect(load, []);
  const act = async (fn: () => Promise<unknown>) => { setErr(null); setBusy(true); try { await fn(); await refresh(); setScen(null); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const cur = sum?.currency ?? "USD";

  const chart = sum?.configured ? [
    { name: "Spent", v: sum.spentCents / 100, c: "#7A869E" }, { name: "Planned", v: sum.plannedCents / 100, c: "#B7791F" },
    { name: "Remaining", v: Math.max(sum.remainingCents, 0) / 100, c: "#0E8F6E" }] : [];

  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-semibold tracking-tight">Budget planner</h1>
        <p className="mt-1 text-sm text-ink-soft">Set a monthly discretionary budget, add planned purchases, and test a what-if. Saved in this app's local database (single-user demo mode).</p></div>
      {err && <div role="alert" className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{err} <button className="underline" onClick={load}>Retry</button></div>}

      <form className="surface grid gap-4 p-5 sm:grid-cols-4 sm:items-end" onSubmit={(e) => { e.preventDefault(); act(() => putSettings(form)); }}>
        <div className="sm:col-span-2"><label htmlFor="mb" className="label">Monthly discretionary budget</label><input id="mb" inputMode="decimal" className="input mt-1" value={form.monthlyBudget} onChange={(e) => setForm({ ...form, monthlyBudget: e.target.value })} /></div>
        <div><label htmlFor="sp" className="label">Spent so far</label><input id="sp" inputMode="decimal" className="input mt-1" value={form.spent} onChange={(e) => setForm({ ...form, spent: e.target.value })} /></div>
        <div className="flex gap-2"><select aria-label="Currency" className="input w-24" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{["USD", "EUR", "GBP"].map((c) => <option key={c}>{c}</option>)}</select>
          <button className="btn-primary" disabled={busy}>Save</button></div>
      </form>

      {!sum ? <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" aria-hidden />Loading…</p> : !sum.configured ? <p className="surface p-5 text-sm text-ink-soft">Enter a monthly budget above to start planning.</p> : (<>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="surface p-5">
            <p className="text-sm text-ink-faint">Remaining after spending and planned purchases</p>
            <p className={`mt-1 text-3xl font-bold tracking-tight ${sum.remainingCents < 0 ? "text-danger" : ""}`}>{fromCents(sum.remainingCents, cur)}</p>
            <p className="mt-1 text-sm text-ink-soft">{sum.percentCommitted}% of {fromCents(sum.monthlyBudgetCents, cur)} committed{sum.remainingCents < 0 ? ". You're over budget." : "."}</p>
            <div className="mt-4 h-32" role="img" aria-label="Spent, planned and remaining amounts">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={chart} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={80} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "#FAF8F4" }} formatter={(v: number) => fromCents(Math.round(v * 100), cur)} />
                <Bar dataKey="v" radius={[0, 4, 4, 0]}>{chart.map((d) => <Cell key={d.name} fill={d.c} />)}</Bar></BarChart></ResponsiveContainer></div>
          </div>

          <div className="surface p-5"><h2 className="font-semibold">Planned purchases</h2>
            <ul className="mt-3 divide-y divide-line text-sm">{sum.planned.length === 0 && <li className="py-2 text-ink-soft">Nothing planned yet.</li>}
              {sum.planned.map((p) => (<li key={p.id} className="flex items-center justify-between gap-3 py-2"><span className="truncate">{p.name}</span>
                <span className="flex items-center gap-2"><span className="font-medium">{fromCents(toCents(p.amount) ?? 0, p.currency)}</span>
                  <button className="btn-ghost !p-1.5" aria-label={`Remove ${p.name}`} onClick={() => act(() => deletePlanned(p.id))}><Trash2 size={14} /></button></span></li>))}</ul>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); act(async () => { await addPlanned(plan.name, plan.amount); setPlan({ name: "", amount: "" }); }); }}>
              <input aria-label="Planned purchase name" placeholder="Item" className="input" value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} />
              <input aria-label="Planned purchase amount" placeholder="Amount" inputMode="decimal" className="input w-28" value={plan.amount} onChange={(e) => setPlan({ ...plan, amount: e.target.value })} />
              <button className="btn-secondary" disabled={busy}>Add</button></form>
          </div>
        </section>

        <section className="surface p-5"><h2 className="font-semibold">What if I buy this?</h2>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setErr(null); runScenario(price).then(setScen).catch((x) => setErr(x.message)); }}>
            <input aria-label="Scenario price" placeholder={`Price (${cur})`} inputMode="decimal" className="input w-44" value={price} onChange={(e) => setPrice(e.target.value)} /><button className="btn-secondary">Check</button></form>
          {scen && (scen.error ? <p role="alert" className="mt-3 text-sm text-danger">{scen.error}</p> :
            <p className="mt-3 text-sm">{scen.fits ? <>This fits. You'd have <strong>{fromCents(scen.remainingCents, cur)}</strong> left ({scen.percentUsed}% of what's available).</> : <>This is <strong className="text-danger">{fromCents(scen.shortfallCents, cur)}</strong> over what's available.</>}</p>)}
        </section></>)}
    </div>
  );
}
