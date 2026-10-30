import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useReports } from "../hooks/useReports";
import { getAnalysis } from "../services/api";

/** Opens a saved analysis by id (used by Purchase history links). */
export default function AnalysisLoader() {
  const { id = "" } = useParams(); const { setCurrent } = useReports();
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  useEffect(() => { getAnalysis(id).then((r) => { setCurrent(r); setState("ok"); }).catch(() => setState("missing")); }, [id, setCurrent]);
  if (state === "ok") return <Navigate to="/app/report" replace />;
  if (state === "missing") return <div className="surface p-6 text-sm"><p>This analysis wasn't saved, so it can't be reopened.</p><Link to="/app/history" className="btn-secondary mt-4">Back to purchase history</Link></div>;
  return <p className="text-sm text-ink-soft">Loading…</p>;
}
