import { describe, expect, it } from "vitest";
import { addDays, addMonths, calendarMonth, calendarWeek, diffDays, isPlainDate, today } from "./dates";

describe("dates", () => {
  it("handles month ends and leap years", () => {
    expect(calendarMonth("2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(calendarMonth("2027-02-10")).toEqual({ start: "2027-02-01", end: "2027-02-28" });
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is unaffected by DST transitions", () => {
    // Europe DST ends 2026-10-25; calendar math must still step one day.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("uses Monday-start weeks", () => {
    expect(calendarWeek("2026-10-30")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
  });

  it("validates dates", () => {
    expect(isPlainDate("2026-02-29")).toBe(false);
    expect(isPlainDate("2028-02-29")).toBe(true);
    expect(isPlainDate("2026-13-01")).toBe(false);
  });

  it("computes today in a timezone", () => {
    const instant = new Date("2026-10-30T23:30:00Z");
    expect(today("UTC", instant)).toBe("2026-10-30");
    expect(today("Europe/Tallinn", instant)).toBe("2026-10-31");
    expect(today("America/Lima", instant)).toBe("2026-10-30");
  });
});
