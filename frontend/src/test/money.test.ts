import { describe, expect, it } from "vitest";
import { computeAffordability, fromCents, toCents } from "../services/affordability";
import { CATALOG } from "../services/catalog";

describe("toCents", () => {
  it.each([["129.99", 12999], ["0.1", 10], ["5", 500], ["0", 0]])("parses %s", (s, c) => expect(toCents(s)).toBe(c));
  it.each(["", "-1", "abc", "1e3", "1.234", "NaN", "1,000"])("rejects %j", (s) => expect(toCents(s)).toBeNull());
});

describe("offline affordability", () => {
  it("is exact with no float drift", () => {
    const r = computeAffordability("0.10", "0.30", "", "USD", CATALOG);
    expect(r.remainingCents).toBe(20);
  });
  it("reports shortfall and never lists dearer alternatives", () => {
    const r = computeAffordability("349.00", "200", "", "USD", CATALOG, "mon-1");
    expect(r.fits).toBe(false); expect(r.shortfallCents).toBe(14900);
    expect(r.alternatives.every((a) => (toCents(a.price) ?? 0) < 34900)).toBe(true);
  });
  it("returns an error for invalid input instead of a number", () => {
    expect(computeAffordability("-5", "100", "", "USD", CATALOG).error).toBeTruthy();
    expect(computeAffordability("5", "x", "", "USD", CATALOG).error).toBeTruthy();
  });
  it("formats cents", () => expect(fromCents(12900, "USD")).toBe("$129.00"));
});
