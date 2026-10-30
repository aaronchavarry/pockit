import { describe, expect, it } from "vitest";
import { categorizeMerchant, localDateTime } from "../../../supabase/functions/_shared/import-rules";

const categories = [
  { id: "cat-groceries", name: "Groceries", keywords: ["Plaza Vea", "Tottus", "Rimi"] },
  { id: "cat-transport", name: "Transport", keywords: ["Uber", "Bolt"] },
  { id: "cat-fun", name: "Fun", keywords: ["Netflix", "cinema"] },
];

describe("categorizeMerchant", () => {
  it("matches whole keywords, accent- and case-insensitively", () => {
    expect(categorizeMerchant("PLAZA VEA SURCO", categories)).toBe("cat-groceries");
    expect(categorizeMerchant("UBER *TRIP", categories)).toBe("cat-transport");
    expect(categorizeMerchant("NETFLIX.COM", categories)).toBe("cat-fun");
  });
  it("returns null when unsure", () => {
    expect(categorizeMerchant("ANTHROPIC* CLAUDE SUB", categories)).toBeNull();
    expect(categorizeMerchant("UBERRIMI", categories)).toBeNull(); // no partial words
    expect(categorizeMerchant("UBER EATS RIMI", categories)).toBeNull(); // two categories
  });
});

describe("localDateTime", () => {
  it("converts an instant to Lima calendar time", () => {
    // 2026-10-29T17:30:00Z is 12:30 in Lima (UTC-5).
    expect(localDateTime(Date.UTC(2026, 9, 29, 17, 30), "America/Lima")).toEqual({ date: "2026-10-29", time: "12:30" });
    expect(localDateTime(Date.UTC(2026, 9, 30, 2, 0), "America/Lima")).toEqual({ date: "2026-10-29", time: "21:00" });
  });
});
