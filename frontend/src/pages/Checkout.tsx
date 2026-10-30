import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, XCircle, Ban, FlaskConical, KeyRound, Loader2 } from "lucide-react";
import { useReports } from "../hooks/useReports";
import { getProduct } from "../services/catalog";
import { fromCents, toCents } from "../services/affordability";
import { cancelOrder, captureOrder, createCheckoutOrder, getPaypalConfig, refreshOrder, ApiError } from "../services/api";
import type { PaypalConfig, Transaction } from "../types";

declare global { interface Window { paypal?: any } }

// PayPal JS SDK v6 (v5's client-id script URL is deprecated). Sandbox host only: this app never handles real money.
const SDK_V6 = "https://www.sandbox.paypal.com/web-sdk/v6/core";
function loadSdk(): Promise<void> {
  if (window.paypal?.createInstance) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SDK_V6; s.async = true;
    s.onload = () => (window.paypal?.createInstance ? res() : rej(new Error("The PayPal SDK loaded but is unavailable.")));
    s.onerror = () => rej(new Error("The PayPal SDK failed to load. Check your connection and retry."));
    document.head.appendChild(s);
  });
}

const resultUI = {
  COMPLETED: { icon: CheckCircle2, color: "text-brand-dark", title: "Payment verified" },
  PENDING: { icon: Clock, color: "text-caution", title: "Payment pending" },
  FAILED: { icon: XCircle, color: "text-danger", title: "Payment failed" },
  CANCELLED: { icon: Ban, color: "text-ink-soft", title: "Checkout cancelled" },
  REFUNDED: { icon: Ban, color: "text-ink-soft", title: "Payment refunded" },
  CREATED: { icon: Clock, color: "text-ink-soft", title: "Awaiting approval" },
} as const;

export default function Checkout() {
  const { current: r } = useReports();
  const product = r?.catalogId ? getProduct(r.catalogId) : undefined;
  const [cfg, setCfg] = useState<PaypalConfig | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const orderRef = useRef<string | null>(null);

  const load = () => { setLoadErr(null); getPaypalConfig().then(setCfg).catch((e: ApiError) => setLoadErr(e.message)); };
  useEffect(load, []);

  useEffect(() => {
    if (!approved || !cfg?.configured || !cfg.clientId || !product || tx || !box.current) return;
    const host = box.current;
    let session: any, button: HTMLElement | null = null, cancelled = false;
    (async () => {
      await loadSdk();
      const sdk = await window.paypal.createInstance({ clientId: cfg.clientId, components: ["paypal-payments"], pageType: "checkout" });
      const methods = await sdk.findEligibleMethods({ currencyCode: product.currency });
      if (cancelled) return;
      if (!methods.isEligible("paypal")) { setErr("PayPal isn't available for this currency or account in the sandbox."); return; }
      session = sdk.createPayPalOneTimePaymentSession({
        onApprove: async ({ orderId }: { orderId: string }) => {
          setBusy(true);
          try { setTx(await captureOrder(orderId)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        },
        onCancel: async () => { if (orderRef.current) { try { setTx(await cancelOrder(orderRef.current)); } catch { /* order stays CREATED */ } } },
        onError: () => setErr("PayPal reported an error. No payment was recorded. You can try again."),
      });
      // The server creates the order (price from the server catalog); the SDK just gets the id.
      const createOrder = async () => {
        setErr(null);
        const o = await createCheckoutOrder({ productId: product.id, analysisId: r?.id, available: r?.budget.available, existing: r?.budget.existing });
        orderRef.current = o.orderId; return { orderId: o.orderId };
      };
      button = document.createElement("paypal-button");
      button.setAttribute("type", "pay");
      button.addEventListener("click", () => {
        session.start({ presentationMode: "auto" }, createOrder()).catch((e: Error) => setErr(e.message || "Checkout could not start."));
      });
      host.replaceChildren(button);
    })().catch((e: Error) => !cancelled && setErr(e.message));
    return () => { cancelled = true; try { session?.destroy?.(); } catch { /* ignore */ } button?.remove(); };
  }, [approved, cfg, product, tx, r]);

  if (!r || !product) return (
    <div className="surface p-6 text-sm"><p>Checkout is available for demo catalog products. Analyze one first.</p>
      <Link to="/app/analyze" className="btn-primary mt-4">Analyze a product</Link></div>);

  const price = fromCents(toCents(product.price) ?? 0, product.currency);
  const a = r.affordability;

  if (tx) {
    const { icon: Icon, color, title } = resultUI[tx.status];
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="surface p-6">
          <div className={`flex items-center gap-3 ${color}`}><Icon size={24} aria-hidden /><h1 className="text-xl font-semibold">{title}</h1></div>
          <dl className="mt-5 grid grid-cols-[120px_1fr] gap-2 text-sm">
            <dt className="text-ink-faint">Product</dt><dd>{tx.productName}</dd>
            <dt className="text-ink-faint">Amount</dt><dd>{fromCents(toCents(tx.amount) ?? 0, tx.currency)}</dd>
            <dt className="text-ink-faint">Status</dt><dd>{tx.status}</dd>
            <dt className="text-ink-faint">PayPal order</dt><dd className="break-all">{tx.paypalOrderId}</dd>
            {tx.captureId && <><dt className="text-ink-faint">Capture ID</dt><dd className="break-all">{tx.captureId}</dd></>}
            {tx.failureReason && <><dt className="text-ink-faint">Details</dt><dd>{tx.failureReason}</dd></>}
          </dl>
          {tx.status === "COMPLETED" && <p className="mt-4 text-sm text-ink-soft">Verified by the server against PayPal. Sandbox payment only; no real money moved.</p>}
          {tx.status === "PENDING" && <button className="btn-secondary mt-4" onClick={async () => { try { setTx(await refreshOrder(tx.paypalOrderId)); } catch (e) { setErr((e as Error).message); } }}>Check status again</button>}
          {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
          <div className="mt-5 flex gap-3">
            {(tx.status === "FAILED" || tx.status === "CANCELLED") && <button className="btn-primary" onClick={() => { setTx(null); setApproved(false); setErr(null); }}>Try again</button>}
            <Link to="/app" className="btn-secondary">Back to overview</Link>
          </div>
        </div>
      </div>);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft"><span className="badge-demo"><FlaskConical size={12} aria-hidden />PayPal Sandbox</span>Test payments only. No real money is charged.</p></div>

      <section className="surface p-5">
        <div className="flex justify-between gap-4"><div><h2 className="font-semibold">{product.name}</h2><p className="text-sm text-ink-soft">Seller: {product.seller} (demo data)</p></div>
          <p className="text-lg font-semibold">{price}</p></div>
        <p className="mt-3 rounded-lg bg-paper p-3 text-sm">Assessment: <span className="font-medium">{r.assessment}</span>.{" "}
          {!a.error && (a.fits ? `After this you'd have ${fromCents(a.remainingCents, product.currency)} left (${a.percentUsed}% of your budget used).` : `This is ${fromCents(a.shortfallCents, product.currency)} over your budget.`)}</p>
      </section>

      {loadErr && <div role="alert" className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{loadErr} <button className="underline" onClick={load}>Retry</button></div>}
      {!cfg && !loadErr && <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" aria-hidden />Checking PayPal setup…</p>}

      {cfg && !cfg.configured && (
        <section className="surface p-5"><h2 className="flex items-center gap-2 font-semibold"><KeyRound size={18} aria-hidden />PayPal Sandbox isn't set up</h2>
          <p className="mt-2 text-sm text-ink-soft">No payment can be made until sandbox credentials are added. Nothing here is simulated.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            <li>Create a Sandbox app in the PayPal Developer Dashboard and copy its Client ID and Secret.</li>
            <li>Put them in <code>.env</code> as <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> (keep <code>PAYPAL_ENV=sandbox</code>).</li>
            <li>Restart the backend, then reload this page.</li></ol></section>)}

      {cfg?.configured && (
        <section className="surface space-y-4 p-5">
          <label className="flex gap-3 text-sm"><input type="checkbox" className="mt-0.5 accent-[#0E8F6E]" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
            <span>I approve a <strong>Sandbox</strong> payment of <strong>{price}</strong> for {product.name}. I understand this is a test and no real money is charged.</span></label>
          {!approved && <p className="text-xs text-ink-faint">Tick the box to show the PayPal button. SafeBuy AI never pays for you.</p>}
          {busy && <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" aria-hidden />Confirming with PayPal…</p>}
          {approved && <div ref={box} aria-label="PayPal payment buttons" />}
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        </section>)}
    </div>
  );
}
