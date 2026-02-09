import { describe, it, expect } from "vitest";
import {
  parseDateValue,
  formatDateForStorage,
  formatDateForDisplay,
} from "../date";

describe("date utils", () => {
  it("parses YYYY-MM-DD into a Date", () => {
    const date = parseDateValue("2024-02-03");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(1);
    expect(date?.getDate()).toBe(3);
  });

  it("returns null for null/undefined/empty", () => {
    expect(parseDateValue(null)).toBeNull();
    expect(parseDateValue(undefined)).toBeNull();
    expect(parseDateValue("")).toBeNull();
  });

  it("formats dates for storage", () => {
    const date = new Date(2024, 0, 5);
    expect(formatDateForStorage(date)).toBe("2024-01-05");
    expect(formatDateForStorage("2024-12-31")).toBe("2024-12-31");
  });

  it("returns empty string for invalid storage input", () => {
    expect(formatDateForStorage("not-a-date")).toBe("");
  });

  it("returns '-' for invalid display input", () => {
    expect(formatDateForDisplay(null)).toBe("-");
  });
});
