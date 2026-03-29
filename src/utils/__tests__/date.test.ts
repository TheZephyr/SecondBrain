import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  parseDateValue,
  parseDateInput,
  formatDateForStorage,
  formatDateForDisplay,
  formatDateWithFieldOptions,
  formatDateForPrimeVue,
  formatMonthYear,
} from "../date";

describe("parseDateValue", () => {
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

  it("passes through a Date instance unchanged", () => {
    const d = new Date(2025, 5, 15);
    expect(parseDateValue(d)).toBe(d);
  });

  it("falls back to Date constructor for non-YYYY-MM-DD strings", () => {
    const result = parseDateValue("March 16 2025");
    expect(result).not.toBeNull();
    expect(result?.getFullYear()).toBe(2025);
  });

  it("returns null for an unparseable string", () => {
    expect(parseDateValue("not-a-date")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDateInput — exercises parseDateWithFormat (lines 31-89) and the
// fallback to parseDateValue (line 113)
// ---------------------------------------------------------------------------

describe("parseDateInput - YYYY-MM-DD format (default)", () => {
  it("parses a valid YYYY-MM-DD string", () => {
    const d = parseDateInput("2025-03-16", "YYYY-MM-DD");
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(16);
  });

  it("returns null for a YYYY-MM-DD mismatched string", () => {
    expect(parseDateInput("16-03-2025", "YYYY-MM-DD")).toBeNull();
  });

  it("uses YYYY-MM-DD when no format is given", () => {
    const d = parseDateInput("2025-01-01");
    expect(d?.getFullYear()).toBe(2025);
  });
});

describe("parseDateInput - YYYY.MM.DD format", () => {
  it("parses a valid YYYY.MM.DD string", () => {
    const d = parseDateInput("2025.03.16", "YYYY.MM.DD");
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(16);
  });

it("returns null when the string is entirely unparseable", () => {
  // "16.03.2025" matches DD.MM.YYYY, not YYYY.MM.DD — format parse returns
  // null, and parseDateValue also cannot parse it, so the result is null.
  expect(parseDateInput("16.03.2025", "YYYY.MM.DD")).toBeNull();
});

  it("returns null for a non-string value after format parse fails", () => {
    expect(parseDateInput(null, "YYYY.MM.DD")).toBeNull();
    expect(parseDateInput(undefined, "YYYY.MM.DD")).toBeNull();
    expect(parseDateInput("", "YYYY.MM.DD")).toBeNull();
  });
});

describe("parseDateInput - DD-MM-YYYY format", () => {
  it("parses a valid DD-MM-YYYY string", () => {
    const d = parseDateInput("16-03-2025", "DD-MM-YYYY");
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(16);
  });

  it("returns null when the separator does not match", () => {
    expect(parseDateInput("16.03.2025", "DD-MM-YYYY")).toBeNull();
  });

  it("falls back to parseDateValue when format parse yields null (line 113)", () => {
    // "2025-03-16" does not match DD-MM-YYYY, so parseDateWithFormat returns null
    // and the function falls back to parseDateValue, which also returns null here
    const result = parseDateInput("2025-03-16", "DD-MM-YYYY");
    // parseDateValue will succeed for this string as a fallback
    expect(result?.getFullYear()).toBe(2025);
  });

  it("passes through a Date object directly", () => {
    const d = new Date(2025, 0, 1);
    expect(parseDateInput(d, "DD-MM-YYYY")).toBe(d);
  });
});

describe("parseDateInput - DD.MM.YYYY format", () => {
  it("parses a valid DD.MM.YYYY string", () => {
    const d = parseDateInput("16.03.2025", "DD.MM.YYYY");
    expect(d?.getFullYear()).toBe(2025);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(16);
  });

  it("returns null when the separator does not match", () => {
    expect(parseDateInput("16-03-2025", "DD.MM.YYYY")).toBeNull();
  });

  it("returns null for a completely invalid string", () => {
    expect(parseDateInput("not-a-date", "DD.MM.YYYY")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatDateForStorage
// ---------------------------------------------------------------------------

describe("formatDateForStorage", () => {
  it("returns the string as-is when it already matches YYYY-MM-DD", () => {
    expect(formatDateForStorage("2024-12-31")).toBe("2024-12-31");
  });

  it("formats a Date object to YYYY-MM-DD (lines 142-151)", () => {
    // single-digit month and day must be zero-padded
    expect(formatDateForStorage(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(formatDateForStorage(new Date(2024, 11, 31))).toBe("2024-12-31");
  });

  it("parses a non-ISO string then formats it", () => {
    expect(formatDateForStorage("2024-02-03")).toBe("2024-02-03");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(formatDateForStorage(null)).toBe("");
    expect(formatDateForStorage(undefined)).toBe("");
    expect(formatDateForStorage("")).toBe("");
  });

  it("returns empty string for an unparseable string", () => {
    expect(formatDateForStorage("not-a-date")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatDateForDisplay
// ---------------------------------------------------------------------------

describe("formatDateForDisplay", () => {
  it("returns '-' for null/undefined/empty", () => {
    expect(formatDateForDisplay(null)).toBe("-");
    expect(formatDateForDisplay(undefined)).toBe("-");
    expect(formatDateForDisplay("")).toBe("-");
  });

  it("returns a localised string for a valid YYYY-MM-DD value", () => {
    const result = formatDateForDisplay("2025-06-15");
    // The exact string depends on locale, but it must not be '-'
    expect(result).not.toBe("-");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a localised string for a Date object", () => {
    const result = formatDateForDisplay(new Date(2025, 5, 15));
    expect(result).not.toBe("-");
  });

  it("returns '-' for an unparseable string", () => {
    expect(formatDateForDisplay("not-a-date")).toBe("-");
  });
});

// ---------------------------------------------------------------------------
// formatDateWithFieldOptions
// ---------------------------------------------------------------------------

describe("formatDateWithFieldOptions", () => {
  const value = "2025-03-16";

  it("formats dates using field options", () => {
    expect(formatDateWithFieldOptions(value, { format: "YYYY-MM-DD" })).toBe(
      "2025-03-16",
    );
    expect(formatDateWithFieldOptions(value, { format: "YYYY.MM.DD" })).toBe(
      "2025.03.16",
    );
    expect(formatDateWithFieldOptions(value, { format: "DD-MM-YYYY" })).toBe(
      "16-03-2025",
    );
    expect(formatDateWithFieldOptions(value, { format: "DD.MM.YYYY" })).toBe(
      "16.03.2025",
    );
  });

  it("defaults to YYYY-MM-DD when no format is specified", () => {
    expect(formatDateWithFieldOptions(value, {})).toBe("2025-03-16");
  });

  it("returns '-' for null/undefined/empty input", () => {
    expect(formatDateWithFieldOptions(null, { format: "YYYY-MM-DD" })).toBe(
      "-",
    );
    expect(
      formatDateWithFieldOptions(undefined, { format: "DD.MM.YYYY" }),
    ).toBe("-");
    expect(formatDateWithFieldOptions("", {})).toBe("-");
  });
});

// ---------------------------------------------------------------------------
// formatDateForPrimeVue
// ---------------------------------------------------------------------------

describe("formatDateForPrimeVue", () => {
  it("maps YYYY-MM-DD to yy-mm-dd", () => {
    expect(formatDateForPrimeVue("YYYY-MM-DD")).toBe("yy-mm-dd");
  });

  it("maps YYYY.MM.DD to yy.mm.dd", () => {
    expect(formatDateForPrimeVue("YYYY.MM.DD")).toBe("yy.mm.dd");
  });

  it("maps DD-MM-YYYY to dd-mm-yy", () => {
    expect(formatDateForPrimeVue("DD-MM-YYYY")).toBe("dd-mm-yy");
  });

  it("maps DD.MM.YYYY to dd.mm.yy", () => {
    expect(formatDateForPrimeVue("DD.MM.YYYY")).toBe("dd.mm.yy");
  });

  it("defaults to yy-mm-dd for undefined", () => {
    expect(formatDateForPrimeVue(undefined)).toBe("yy-mm-dd");
  });

  it("defaults to yy-mm-dd for an unrecognised format string", () => {
    expect(formatDateForPrimeVue("MM/DD/YYYY")).toBe("yy-mm-dd");
  });
});

// ---------------------------------------------------------------------------
// buildMonthGrid
// ---------------------------------------------------------------------------

describe("buildMonthGrid", () => {
  it("builds a Monday-first 42-cell month grid", () => {
    const grid = buildMonthGrid(2026, 2, new Date(2026, 2, 8));

    expect(grid).toHaveLength(42);
    expect(grid[0]?.key).toBe("2026-02-23");
    expect(grid[0]?.isCurrentMonth).toBe(false);
    expect(grid[6]?.key).toBe("2026-03-01");
    expect(grid[13]?.key).toBe("2026-03-08");
    expect(grid[13]?.isToday).toBe(true);
    expect(grid[41]?.key).toBe("2026-04-05");
  });

  it("marks only the supplied today cell as isToday", () => {
    const grid = buildMonthGrid(2026, 2, new Date(2026, 2, 8));
    const todayCells = grid.filter((cell) => cell.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0]?.key).toBe("2026-03-08");
  });

  it("marks only cells in the target month as isCurrentMonth", () => {
    const grid = buildMonthGrid(2026, 2, new Date(2026, 2, 8));
    const inMonth = grid.filter((cell) => cell.isCurrentMonth);
    // March 2026 has 31 days
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0]?.key).toBe("2026-03-01");
    expect(inMonth[30]?.key).toBe("2026-03-31");
  });

  it("handles a month whose first day is Monday (grid[0] is the 1st)", () => {
    // June 2026 starts on a Monday
    const grid = buildMonthGrid(2026, 5, new Date(2026, 5, 1));
    expect(grid[0]?.key).toBe("2026-06-01");
    expect(grid[0]?.isCurrentMonth).toBe(true);
  });

  it("handles a month whose first day is Sunday (full previous week padding)", () => {
    // November 2026 starts on a Sunday
    const grid = buildMonthGrid(2026, 10, new Date(2026, 10, 1));
    // Monday before Nov 1 is Oct 26
    expect(grid[0]?.key).toBe("2026-10-26");
    expect(grid[6]?.key).toBe("2026-11-01");
  });

  it("produces consecutive keys with no gaps", () => {
    const grid = buildMonthGrid(2025, 0, new Date(2025, 0, 1));
    for (let i = 1; i < grid.length; i++) {
      const prev = grid[i - 1]!.date.getTime();
      const curr = grid[i]!.date.getTime();
      expect(curr - prev).toBe(86_400_000); // exactly one day
    }
  });
});

// ---------------------------------------------------------------------------
// formatMonthYear
// ---------------------------------------------------------------------------

describe("formatMonthYear", () => {
  it("formats localized month and year labels", () => {
    expect(formatMonthYear(2026, 2, "en-US")).toBe("March 2026");
  });

  it("uses a different locale when provided", () => {
    // Just verify it returns a non-empty string and does not throw
    const result = formatMonthYear(2026, 2, "pl-PL");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
