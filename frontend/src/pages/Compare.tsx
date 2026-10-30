import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATALOG } from "../services/catalog";
import { fromCents, toCents } from "../services/affordability";

export default function Compare() {
  const nav = useNavigate();
  const [sel, setSel] = useState<string[]>(["hp-1", "hp-2"]);
  const [budget, setBudget] = useState("");
  const toggle = (id: string) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 3 ? [...s, id] : s);
  const chosen = CATALOG.filter((p) => sel.includes(p.id));
  const bc = budget.trim() ? toCents(budget) : null;
  const rows: [string, (p: typeof CATALOG[number]) => string][] = [
    ["Price", (p) => fromCents(toCents(p.price)!, p.currency)], ["Seller", (p) => p.seller || "Not stated"],
    ["Returns", (p) => p.returnPolicy || "Not stated"], ["Warranty", (p) => p.warranty || "Not stated"],
    ["Known gaps", (p) => p.knownGaps.join("; ") || "None noted"],
    ["Budget impact", (p) => bc === null ? "Enter a budget above" : toCents(p.price)! <= bc ? `Leaves ${fromCents(bc - toCents(p.price)!, p.currency)}` : `Over by ${fromCents(toCents(p.price)! - bc, p.currency)}`],
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Compare products</h1>
        <p className="mt-1 text-sm text-ink-soft">Choose up to three. All products and seller details are invented demo data.</p></div>
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Products to compare</legend>
          {CATALOG.map((p) => <label key={p.id} className={`btn-secondary cursor-pointer ${sel.includes(p.id) ? "!border-brand !bg-brand-tint" : ""}`}>
            <input type="checkbox" className="sr-only" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />{p.name}</label>)}</fieldset>
        <div><label htmlFor="cb" className="label">Your budget (USD)</label><input id="cb" inputMode="decimal" className="input mt-1 w-40" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
      </div>
      {chosen.length === 0 ? <p className="surface p-5 text-sm text-ink-soft">Select a product to start comparing.</p> :
        <div className="surface overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
          <thead><tr className="border-b border-line"><th className="p-4" />{chosen.map((p) => <th key={p.id} className="p-4 align-top"><p className="font-semibold">{p.name}</p><p className="font-normal text-ink-faint">{p.category}</p></th>)}</tr></thead>
          <tbody>{rows.map(([label, f]) => <tr key={label} className="border-b border-line last:border-0"><th scope="row" className="p-4 font-medium text-ink-soft">{label}</th>{chosen.map((p) => <td key={p.id} className="p-4">{f(p)}</td>)}</tr>)}
            <tr><td className="p-4" />{chosen.map((p) => <td key={p.id} className="p-4"><button className="btn-primary" onClick={() => nav("/app/analyze", { state: { productId: p.id } })}>Analyze this</button></td>)}</tr></tbody>
        </table></div>}
    </div>
  );
}
