import { createContext, useContext, useState, type ReactNode } from "react";
import type { Report } from "../types";

/** Holds only the analysis being viewed. Saved analyses live in the backend database. */
interface Ctx { current: Report | null; setCurrent: (r: Report | null) => void; }
const C = createContext<Ctx | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Report | null>(null);
  return <C.Provider value={{ current, setCurrent }}>{children}</C.Provider>;
}
export const useReports = () => { const c = useContext(C); if (!c) throw new Error("ReportsProvider missing"); return c; };
