import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSummary, getTransactions, listAnalyses } from "../services/api";
import type { BudgetSummary, SavedItem, Transaction } from "../types";
import { Plus, FileText, CreditCard } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DEMO_BUDGET, DEMO_MONTHLY, DEMO_REPORTS } from "../services/demoData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: DEMO_BUDGET.currency, maximumFractionDigits: 0 }).format(n);

const fmtC = (n: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export default function Overview() {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [real, setReal] = useState<BudgetSummary | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  useEffect(() => { getSummary().then((x) => setReal(x.configured ? x : null)).catch(() => {}); listAnalyses().then(setSaved).catch(() => {}); }, []);
  useEffect(() => { getTransactions().then(setTxs).catch(() => setTxs(null)); }, []);
  const demo = DEMO_BUDGET;
  const isDemo = !real;
  const monthly = real ? real.monthlyBudgetCents / 100 : demo.monthly, spent = real ? real.spentCents / 100 : demo.spent;
  const planned = real ? real.planned.map((p) => ({ name: p.name, amount: Number(p.amount) })) : demo.planned;
  const plannedTotal = real ? real.plannedCents / 100 : demo.planned.reduce((s, p) => s + p.amount, 0);
  const remaining = monthly - spent - plannedTotal;
  const pct = monthly > 0 ? Math.min(100, Math.round(((spent + plannedTotal) / monthly) * 100)) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, Snigdha</h1>
          <p className="mt-1 text-sm text-ink-soft">Budget figures marked Demo are sample data until you set your own in the Budget planner.</p>
        </div>
        <Link to="/app/analyze" className="btn-primary"><Plus size={16} aria-hidden />Analyze product</Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Monthly discretionary budget</h2>{isDemo && <span className="badge-demo">Demo</span>}</div>
          <p className="mt-4 text-3xl font-bold tracking-tight">{fmtC(remaining)}</p>
          <p className="text-sm text-ink-soft">left after {fmtC(spent)} spent and {fmtC(plannedTotal)} planned, of {fmtC(monthly)}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper" role="img" aria-label={`${pct}% of budget spent`}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="surface p-5 lg:col-span-3">
          <h2 className="font-semibold">Spending by month <span className="badge-demo ml-2">Demo data</span></h2>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEMO_MONTHLY}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis hide />
                <Tooltip cursor={{ fill: "#FAF8F4" }} formatter={(v: number) => fmt(v)} />
                <Bar dataKey="spent" fill="#0E8F6E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface">
          <h2 className="border-b border-line p-5 font-semibold">Recent analyses</h2>
          <ul className="divide-y divide-line">
            {(saved.length ? saved.slice(0, 4).map((x) => ({ id: x.id, product: x.productName, assessment: x.assessment, demo: false }))
              : DEMO_REPORTS.map((x) => ({ ...x, demo: true }))).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <FileText size={16} className="text-ink-faint" aria-hidden />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.product}</p><p className="text-ink-soft">{r.assessment}</p></div>
                {r.demo && <span className="badge-demo">Demo</span>}
              </li>))}
          </ul>
        </div>
        <div className="space-y-6">
          <div className="surface">
            <h2 className="flex items-center gap-2 border-b border-line p-5 font-semibold">Planned purchases{isDemo && <span className="badge-demo">Demo</span>}</h2>
            <ul className="divide-y divide-line">
              {planned.map((p) => (
                <li key={p.name} className="flex justify-between px-5 py-3.5 text-sm"><span>{p.name}</span><span className="font-medium">{fmtC(p.amount)}</span></li>
              ))}
            </ul>
          </div>
          <div className="surface p-5">
            <h2 className="flex items-center gap-2 font-semibold"><CreditCard size={16} aria-hidden />Sandbox transactions</h2>
            {txs && txs.length > 0 ? (
              <ul className="mt-3 divide-y divide-line text-sm">{txs.slice(0, 4).map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-2"><span className="truncate">{t.productName}</span>
                  <span className={t.status === "COMPLETED" ? "badge-ok" : "badge bg-paper text-ink-soft"}>{t.status.toLowerCase()}</span></li>))}</ul>
            ) : <p className="mt-2 text-sm text-ink-soft">None yet. Only payments verified by the backend count as completed.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
