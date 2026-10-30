import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ScanSearch, Bookmark, Columns3, PiggyBank, Receipt, Settings, Menu, X, FlaskConical } from "lucide-react";
import Logo from "../components/Logo";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/analyze", label: "Analyze product", icon: ScanSearch },
  { to: "/app/saved", label: "Saved analyses", icon: Bookmark },
  { to: "/app/compare", label: "Compare products", icon: Columns3 },
  { to: "/app/budget", label: "Budget planner", icon: PiggyBank },
  { to: "/app/history", label: "Purchase history", icon: Receipt },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const links = (
    <ul className="space-y-1">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-tint text-brand-dark" : "text-ink-soft hover:bg-paper hover:text-ink"}`}
          >
            <Icon size={18} aria-hidden />{label}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-line bg-white p-4 lg:block">
        <div className="mb-6 px-2 pt-1"><Logo to="/app" /></div>
        <nav aria-label="App">{links}</nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:px-8">
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="lg:hidden"><Logo to="/app" /></div>
          <span className="badge-demo ml-auto"><FlaskConical size={12} aria-hidden />Sandbox · demo data</span>
        </header>
        <main className="flex-1 px-4 py-8 lg:px-8"><div className="mx-auto max-w-5xl"><Outlet /></div></main>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white p-4 shadow-soft">
            <div className="mb-6 flex items-center justify-between"><Logo to="/app" />
              <button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
            <nav aria-label="App">{links}</nav>
          </div>
        </div>
      )}
    </div>
  );
}
