import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { getTransactions } from "../services/api";
import { fromCents, toCents } from "../services/affordability";
import type { Transaction, TxStatus } from "../types";

ModuleRegistry.registerModules([AllCommunityModule]);

const style: Record<TxStatus, string> = { COMPLETED: "badge-ok", PENDING: "badge bg-caution-tint text-caution", FAILED: "badge bg-danger-tint text-danger", CANCELLED: "badge bg-paper text-ink-soft", CREATED: "badge bg-paper text-ink-soft", REFUNDED: "badge bg-paper text-ink-soft" };
const label: Record<TxStatus, string> = { COMPLETED: "Completed", PENDING: "Pending", FAILED: "Failed", CANCELLED: "Cancelled", CREATED: "Not approved", REFUNDED: "Refunded" };

const StatusCell = ({ data }: ICellRendererParams<Transaction>) =>
  data ? <span className={style[data.status]} title={data.failureReason ?? undefined}>{label[data.status]}</span> : null;
const AnalysisCell = ({ data }: ICellRendererParams<Transaction>) =>
  data?.analysisId ? <Link className="text-brand-dark underline" to={`/app/analysis/${data.analysisId}`}>View</Link> : <span>None</span>;

export default function History() {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); getTransactions().then(setTxs).catch((e) => setErr(e.message)); };
  useEffect(load, []);

  // Sortable, filterable grid (AG Grid Community). Status labels come from the server-verified status only.
  const cols = useMemo<ColDef<Transaction>[]>(() => [
    { headerName: "Product", field: "productName", flex: 2, minWidth: 160 },
    { headerName: "Amount", valueGetter: (p) => toCents(p.data?.amount ?? "") ?? 0, valueFormatter: (p) => fromCents(p.value, p.data?.currency ?? "USD"), filter: "agNumberColumnFilter", minWidth: 110 },
    { headerName: "Date", field: "createdAt", valueFormatter: (p) => new Date(p.value).toLocaleDateString(), sort: "desc", minWidth: 120 },
    { headerName: "Status", valueGetter: (p) => (p.data ? label[p.data.status] : ""), cellRenderer: StatusCell, minWidth: 130 },
    { headerName: "Budget left after", valueGetter: (p) => p.data?.budgetRemainingCents ?? null,
      valueFormatter: (p) => (p.value == null ? "Not recorded" : fromCents(p.value, p.data?.currency ?? "USD")), filter: "agNumberColumnFilter", minWidth: 150 },
    { headerName: "Analysis", sortable: false, filter: false, cellRenderer: AnalysisCell, minWidth: 100 },
  ], []);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Purchase history</h1>
        <p className="mt-1 text-sm text-ink-soft">PayPal Sandbox transactions only. "Completed" means the server verified the capture with PayPal. No real money moved.</p></div>
      {err && <div role="alert" className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{err} <button className="underline" onClick={load}>Retry</button></div>}
      {txs === null && !err && <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" aria-hidden />Loading…</p>}
      {txs?.length === 0 && <div className="surface p-6 text-sm text-ink-soft"><p>No sandbox transactions yet.</p><Link to="/app/analyze" className="btn-primary mt-4">Analyze a product</Link></div>}
      {txs && txs.length > 0 && (
        <div className="surface overflow-hidden p-1" aria-label="Transactions table">
          <AgGridReact<Transaction> rowData={txs} columnDefs={cols} domLayout="autoHeight" defaultColDef={{ sortable: true, filter: true, resizable: true }}
            suppressColumnVirtualisation suppressRowVirtualisation getRowId={(p) => p.data.id} />
        </div>)}
    </div>
  );
}
