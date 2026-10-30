import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { ReportsProvider, useReports } from "../hooks/useReports";
import { analyzeDemo } from "../services/demoAnalysis";
import { CATALOG } from "../services/catalog";
import type { Report } from "../types";
import { useEffect, type ReactElement } from "react";

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | "network-error";

/** Stubs fetch. Unmatched calls fail the test loudly instead of silently succeeding. */
export function mockApi(routes: Record<string, Handler | { status?: number; body?: unknown } | "network-error">) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k) && (!k.includes(" ") || true));
    if (!key) throw new Error(`Unmocked fetch: ${url}`);
    let r = routes[key]; if (typeof r === "function") r = r(url, init);
    if (r === "network-error") throw new TypeError("Failed to fetch");
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  }));
  return calls;
}

export function sampleReport(id = "hp-2", budget = "200"): Report {
  const p = CATALOG.find((c) => c.id === id)!;
  return analyzeDemo(p, { available: budget, existing: "", urgency: "normal", priorities: [] }, id);
}

function Seed({ report, children }: { report: Report | null; children: ReactElement }) {
  const { setCurrent } = useReports();
  useEffect(() => { setCurrent(report); }, [report, setCurrent]);
  return children;
}

export function renderPage(ui: ReactElement, opts: { path?: string; report?: Report | null; extra?: Record<string, ReactElement> } = {}) {
  const path = opts.path ?? "/page";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ReportsProvider>
        <Routes>
          <Route path={path} element={<Seed report={opts.report ?? null}>{ui}</Seed>} />
          {Object.entries(opts.extra ?? {}).map(([p, el]) => <Route key={p} path={p} element={el} />)}
          <Route path="*" element={<div>navigated-away</div>} />
        </Routes>
      </ReportsProvider>
    </MemoryRouter>);
}
