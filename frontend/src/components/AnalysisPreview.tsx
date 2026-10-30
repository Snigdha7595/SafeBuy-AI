import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

/** Static illustration for the landing page. Demo content only. */
export default function AnalysisPreview() {
  return (
    <div className="surface rise overflow-hidden" aria-label="Sample analysis preview (demo data)">
      <div className="flex items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <p className="text-sm text-ink-faint">Sample listing</p>
          <h3 className="font-semibold">Wireless headphones, $129</h3>
        </div>
        <span className="badge-demo">Demo data</span>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex gap-3 rounded-lg bg-caution-tint p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-caution" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Return policy is not stated</p>
            <p className="mt-0.5 text-ink-soft">
              The listing mentions "hassle-free service" but gives no return window. Confirm it before paying.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-ink-faint">Budget left</dt><dd className="font-semibold">$471</dd></div>
          <div><dt className="text-ink-faint">Share of budget</dt><dd className="font-semibold">21.5%</dd></div>
          <div><dt className="text-ink-faint">Fits budget</dt>
            <dd className="flex items-center gap-1 font-semibold text-brand-dark"><CheckCircle2 size={14} aria-hidden />Yes</dd></div>
        </dl>

        <div className="flex items-center justify-between rounded-lg border border-line p-3 text-sm">
          <span><span className="font-medium">Next step:</span> ask the seller for the return window</span>
          <ArrowRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
        </div>
      </div>
    </div>
  );
}
