import { Link } from "react-router-dom";
import { Search, Eye, Scale, FileSearch, Wallet, CreditCard, ShieldAlert, ScanText } from "lucide-react";
import Logo from "../components/Logo";
import AnalysisPreview from "../components/AnalysisPreview";

const steps = [
  { icon: Search, title: "Analyze", text: "Paste a listing or pick a sample product." },
  { icon: Eye, title: "Understand", text: "See what the listing says, what it leaves out, and what to verify." },
  { icon: Scale, title: "Decide", text: "Check the price against your budget, then choose whether to pay." },
];

const features = [
  { icon: ScanText, title: "Listing transparency", text: "Shows which seller, warranty, and return details are present, missing, or unclear." },
  { icon: FileSearch, title: "Evidence-based analysis", text: "Every concern quotes the listing text it came from and says how sure we are." },
  { icon: Wallet, title: "Budget intelligence", text: "Exact, code-calculated totals show what a purchase does to your discretionary budget." },
  { icon: CreditCard, title: "PayPal Sandbox checkout", text: "You approve every payment. Sandbox mode never charges real money." },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Main">
          <Logo />
          <div className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#limits" className="hover:text-ink">Limitations</a>
          </div>
          <Link to="/app/analyze" className="btn-primary">Analyze a product</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div className="rise">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Before you buy, understand what you're buying.
            </h1>
            <p className="mt-5 max-w-md text-lg text-ink-soft">
              Evaluate product listings, understand potential warning signs, and check affordability before you pay.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app/analyze" className="btn-primary">Analyze a product</Link>
              <Link to="/app?demo=1" className="btn-secondary">Try the demo</Link>
            </div>
          </div>
          <AnalysisPreview />
        </section>

        <section id="how" className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand-dark"><Icon size={20} aria-hidden /></span>
                  <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-ink-soft">{text}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Built to show its work</h2>
          <div className="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 border-t border-line pt-5">
                <Icon size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-ink-soft">{text}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section id="limits" className="mx-auto max-w-6xl px-5 pb-20">
          <div className="flex gap-4 rounded-xl border border-line bg-white p-6">
            <ShieldAlert size={22} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <div>
              <h2 className="font-semibold">What SafeBuy AI can't do</h2>
              <p className="mt-2 max-w-3xl text-sm text-ink-soft">
                It reviews only the information you provide. It can't verify a seller, guarantee a product is safe, or detect every scam.
                A low price or a missing detail is a reason to check, not proof of wrongdoing. Treat each report as a starting point for your own verification.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-ink-faint">
        SafeBuy AI · PayPal AI Hackathon 2026 · Payments run in PayPal Sandbox and never charge real money.
      </footer>
    </div>
  );
}
