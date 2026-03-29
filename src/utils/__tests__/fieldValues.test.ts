import { describe, it, expect } from "vitest";
import {
  parseMultiselectValue,
  serializeMultiselectValue,
  parseBooleanValue,
  serializeBooleanValue,
  parseRatingValue,
  serializeRatingValue,
} from "../fieldValues";

// ---------------------------------------------------------------------------
// parseMultiselectValue
// ---------------------------------------------------------------------------

describe("parseMultiselectValue", () => {
  it("returns empty array for null", () => {
    expect(parseMultiselectValue(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(parseMultiselectValue(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseMultiselectValue("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseMultiselectValue("   ")).toEqual([]);
  });

  it("parses a valid JSON array of strings", () => {
    expect(parseMultiselectValue('["A","B","C"]')).toEqual(["A", "B", "C"]);
  });

  it("parses a single-element JSON array", () => {
    expect(parseMultiselectValue('["Solo"]')).toEqual(["Solo"]);
  });

  it("returns empty array for an empty JSON array", () => {
    expect(parseMultiselectValue("[]")).toEqual([]);
  });

  it("filters out non-string entries from a mixed array", () => {
    expect(parseMultiselectValue('["A", 1, null, "B", true]')).toEqual([
      "A",
      "B",
    ]);
  });

  it("returns empty array for a JSON object (not an array)", () => {
    expect(parseMultiselectValue('{"key":"value"}')).toEqual([]);
  });

  it("returns empty array for a JSON number", () => {
    expect(parseMultiselectValue("42")).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseMultiselectValue("[broken")).toEqual([]);
  });

  it("returns empty array for a numeric value", () => {
    expect(parseMultiselectValue(42)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// serializeMultiselectValue
// ---------------------------------------------------------------------------

describe("serializeMultiselectValue", () => {
  it("returns null for null input", () => {
    expect(serializeMultiselectValue(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(serializeMultiselectValue(undefined)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(serializeMultiselectValue([])).toBeNull();
  });

  it("serializes a single-element array", () => {
    expect(serializeMultiselectValue(["A"])).toBe('["A"]');
  });

  it("serializes a multi-element array", () => {
    expect(serializeMultiselectValue(["A", "B", "C"])).toBe('["A","B","C"]');
  });

  it("round-trips through parse correctly", () => {
    const original = ["Sci-Fi", "Classic", "Award Winner"];
    const serialized = serializeMultiselectValue(original);
    expect(parseMultiselectValue(serialized)).toEqual(original);
  });

  it("preserves order of values", () => {
    const values = ["Z", "A", "M"];
    const serialized = serializeMultiselectValue(values);
    expect(parseMultiselectValue(serialized)).toEqual(["Z", "A", "M"]);
  });
});

// ---------------------------------------------------------------------------
// parseBooleanValue
// ---------------------------------------------------------------------------

describe("parseBooleanValue", () => {
  it('returns true for string "1"', () => {
    expect(parseBooleanValue("1")).toBe(true);
  });

  it('returns false for string "0"', () => {
    expect(parseBooleanValue("0")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(parseBooleanValue("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(parseBooleanValue(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(parseBooleanValue(undefined)).toBe(false);
  });

  it("returns true for number 1", () => {
    expect(parseBooleanValue(1)).toBe(true);
  });

  it("returns false for number 0", () => {
    expect(parseBooleanValue(0)).toBe(false);
  });

  it("returns false for any other number", () => {
    expect(parseBooleanValue(2)).toBe(false);
    expect(parseBooleanValue(-1)).toBe(false);
  });

  it("returns false for an arbitrary non-empty string", () => {
    // String coerces to truthy via Boolean() but the impl checks value === "1"
    expect(parseBooleanValue("true")).toBe(false);
    expect(parseBooleanValue("yes")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// serializeBooleanValue
// ---------------------------------------------------------------------------

describe("serializeBooleanValue", () => {
  it('returns "1" for true', () => {
    expect(serializeBooleanValue(true)).toBe("1");
  });

  it('returns "0" for false', () => {
    expect(serializeBooleanValue(false)).toBe("0");
  });

  it('returns "1" for string "1"', () => {
    expect(serializeBooleanValue("1")).toBe("1");
  });

  it('returns "0" for string "0"', () => {
    expect(serializeBooleanValue("0")).toBe("0");
  });

  it('returns "1" for numeric 1', () => {
    expect(serializeBooleanValue(1)).toBe("1");
  });

  it('returns "0" for numeric 0', () => {
    expect(serializeBooleanValue(0)).toBe("0");
  });

  it('returns "0" for null', () => {
    expect(serializeBooleanValue(null)).toBe("0");
  });

  it('returns "0" for undefined', () => {
    expect(serializeBooleanValue(undefined)).toBe("0");
  });

  it("round-trips: serialize then parse restores original boolean", () => {
    expect(parseBooleanValue(serializeBooleanValue(true))).toBe(true);
    expect(parseBooleanValue(serializeBooleanValue(false))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseRatingValue
// ---------------------------------------------------------------------------

describe("parseRatingValue", () => {
  it("returns null for null", () => {
    expect(parseRatingValue(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseRatingValue(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRatingValue("")).toBeNull();
  });

  it("returns the number for a finite numeric value", () => {
    expect(parseRatingValue(3)).toBe(3);
    expect(parseRatingValue(0)).toBe(0);
    expect(parseRatingValue(5)).toBe(5);
  });

  it("returns null for Infinity", () => {
    expect(parseRatingValue(Infinity)).toBeNull();
  });

  it("returns null for -Infinity", () => {
    expect(parseRatingValue(-Infinity)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(parseRatingValue(NaN)).toBeNull();
  });

  it("parses a numeric string", () => {
    expect(parseRatingValue("4")).toBe(4);
    expect(parseRatingValue("0")).toBe(0);
  });

  it("parses a float string", () => {
    expect(parseRatingValue("3.5")).toBeCloseTo(3.5);
  });

  it("returns null for a non-numeric string", () => {
    expect(parseRatingValue("abc")).toBeNull();
    expect(parseRatingValue("five")).toBeNull();
  });

  it("returns null for a string that parses to NaN", () => {
    expect(parseRatingValue("1e999")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// serializeRatingValue
// ---------------------------------------------------------------------------

describe("serializeRatingValue", () => {
  it("returns null for null", () => {
    expect(serializeRatingValue(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(serializeRatingValue(undefined)).toBeNull();
  });

  it("returns the number for a valid finite value", () => {
    expect(serializeRatingValue(3)).toBe(3);
    expect(serializeRatingValue(0)).toBe(0);
  });

  it("returns null for Infinity", () => {
    expect(serializeRatingValue(Infinity)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(serializeRatingValue(NaN)).toBeNull();
  });

  it("round-trips: serialize then parse restores original value", () => {
    expect(parseRatingValue(serializeRatingValue(5))).toBe(5);
    expect(parseRatingValue(serializeRatingValue(0))).toBe(0);
    expect(parseRatingValue(serializeRatingValue(null))).toBeNull();
  });
});
