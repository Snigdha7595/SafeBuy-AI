// All data in this file is illustrative DEMO data, not real listings, sellers, or transactions.
import type { DemoReport } from "../types";

export const DEMO_REPORTS: DemoReport[] = [
  { id: "demo-1", product: "Noise-cancelling headphones", assessment: "Some details require verification", date: "Demo" },
  { id: "demo-2", product: "27-inch 4K monitor", assessment: "No major concerns identified", date: "Demo" },
  { id: "demo-3", product: "Standing desk frame", assessment: "Insufficient information", date: "Demo" },
];

export const DEMO_BUDGET = {
  currency: "USD",
  monthly: 600,
  spent: 215,
  planned: [
    { name: "Standing desk frame", amount: 189 },
    { name: "Headphones", amount: 129 },
  ],
};

export const DEMO_MONTHLY = [
  { month: "Jun", spent: 140 }, { month: "Jul", spent: 320 },
  { month: "Aug", spent: 90 }, { month: "Sep", spent: 410 },
  { month: "Oct", spent: 215 },
];
