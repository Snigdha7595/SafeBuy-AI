import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useReports } from "../hooks/useReports";
import { deleteAnalysis, getAnalysis, listAnalyses } from "../services/api";
import type { SavedItem } from "../types";

export default function Saved() {
  const { setCurrent } = useReports(); const nav = useNavigate();
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); listAnalyses().then(setItems).catch((e) => setErr(e.message)); };
  useEffect(load, []);
  const open = async (id: string) => { try { setCurrent(await getAnalysis(id)); nav("/app/report"); } catch (e) { setErr((e as Error).message); } };
  const del = async (id: string) => { try { await deleteAnalysis(id); setItems((x) => x?.filter((i) => i.id !== id) ?? null); } catch (e) { setErr((e as Error).message); } };

  return (
    <div className="space-y-6"><h1 className="text-2xl font-semibold tracking-tight">Saved analyses</h1>
      {err && <div role="alert" className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{err} <button className="underline" onClick={load}>Retry</button></div>}
      {items === null && !err && <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" aria-hidden />Loading…</p>}
      {items?.length === 0 && <div className="surface p-6 text-sm text-ink-soft"><p>Nothing saved yet. Run an analysis and choose Save analysis.</p><Link to="/app/analyze" className="btn-primary mt-4">Analyze a product</Link></div>}
      {items && items.length > 0 && <ul className="surface divide-y divide-line">{items.map((r) => (
        <li key={r.id} className="flex items-center gap-3 p-4 text-sm">
          <button className="min-w-0 flex-1 text-left" onClick={() => open(r.id)}>
            <p className="truncate font-medium">{r.productName}</p><p className="text-ink-soft">{r.assessment} · {new Date(r.createdAt).toLocaleDateString()}</p></button>
          <button className="btn-ghost" aria-label={`Delete ${r.productName}`} onClick={() => del(r.id)}><Trash2 size={16} /></button></li>))}</ul>}
    </div>
  );
}
