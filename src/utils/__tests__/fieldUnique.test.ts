import { describe, it, expect } from "vitest";
import { normalizeUniqueKey } from "../fieldUnique";
import type { Field } from "../../types/models";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(type: Field["type"], name = "F"): Field {
  return {
    id: 1,
    collection_id: 1,
    name,
    type,
    options: null,
    order_index: 0,
  };
}

// ---------------------------------------------------------------------------
// text / longtext / url — string passthrough
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - text-like fields", () => {
  for (const type of ["text", "longtext", "url"] as const) {
    describe(`type: ${type}`, () => {
      it("returns the string value as-is", () => {
        expect(normalizeUniqueKey(makeField(type), "hello")).toBe("hello");
      });

      it("returns null for null", () => {
        expect(normalizeUniqueKey(makeField(type), null)).toBeNull();
      });

      it("returns null for undefined", () => {
        expect(normalizeUniqueKey(makeField(type), undefined)).toBeNull();
      });

      it("returns null for empty string", () => {
        expect(normalizeUniqueKey(makeField(type), "")).toBeNull();
      });

      it("coerces a number to string", () => {
        // The fallback branch returns String(value), so numbers become strings
        expect(normalizeUniqueKey(makeField(type), 42)).toBe("42");
      });
    });
  }
});

// ---------------------------------------------------------------------------
// select
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - select", () => {
  const field = makeField("select");

  it("returns the string value", () => {
    expect(normalizeUniqueKey(field, "Done")).toBe("Done");
  });

  it("returns null for null", () => {
    expect(normalizeUniqueKey(field, null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeUniqueKey(field, undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeUniqueKey(field, "")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// boolean
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - boolean", () => {
  const field = makeField("boolean");

  it('returns "1" for string "1"', () => {
    expect(normalizeUniqueKey(field, "1")).toBe("1");
  });

  it('returns "0" for string "0"', () => {
    expect(normalizeUniqueKey(field, "0")).toBe("0");
  });

  it('returns "0" for null (boolean defaults to false)', () => {
    expect(normalizeUniqueKey(field, null)).toBe("0");
  });

  it('returns "0" for undefined', () => {
    expect(normalizeUniqueKey(field, undefined)).toBe("0");
  });

  it('returns "0" for empty string', () => {
    expect(normalizeUniqueKey(field, "")).toBe("0");
  });

  it('returns "1" for numeric 1', () => {
    expect(normalizeUniqueKey(field, 1)).toBe("1");
  });

  it('returns "0" for numeric 0', () => {
    expect(normalizeUniqueKey(field, 0)).toBe("0");
  });

  it("two items with the same boolean value produce the same key", () => {
    expect(normalizeUniqueKey(field, "1")).toBe(normalizeUniqueKey(field, 1));
  });
});

// ---------------------------------------------------------------------------
// number
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - number", () => {
  const field = makeField("number");

  it("returns stringified integer", () => {
    expect(normalizeUniqueKey(field, 5)).toBe("5");
  });

  it("returns stringified zero", () => {
    expect(normalizeUniqueKey(field, 0)).toBe("0");
  });

  it("returns stringified float", () => {
    expect(normalizeUniqueKey(field, 3.14)).toBe("3.14");
  });

  it("parses and stringifies a numeric string", () => {
    expect(normalizeUniqueKey(field, "7")).toBe("7");
  });

  it("returns null for null", () => {
    expect(normalizeUniqueKey(field, null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeUniqueKey(field, undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeUniqueKey(field, "")).toBeNull();
  });

  it("returns null for a non-numeric string", () => {
    expect(normalizeUniqueKey(field, "abc")).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(normalizeUniqueKey(field, Infinity)).toBeNull();
  });

  it("produces the same key for numeric 5 and string '5'", () => {
    expect(normalizeUniqueKey(field, 5)).toBe(normalizeUniqueKey(field, "5"));
  });
});

// ---------------------------------------------------------------------------
// rating
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - rating", () => {
  const field = makeField("rating");

  it("returns stringified rating value", () => {
    expect(normalizeUniqueKey(field, 4)).toBe("4");
  });

  it("returns null for null", () => {
    expect(normalizeUniqueKey(field, null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeUniqueKey(field, "")).toBeNull();
  });

  it("returns null for a non-numeric string", () => {
    expect(normalizeUniqueKey(field, "bad")).toBeNull();
  });

  it("produces the same key for equivalent numeric representations", () => {
    expect(normalizeUniqueKey(field, 3)).toBe(normalizeUniqueKey(field, "3"));
  });
});

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - date", () => {
  const field = makeField("date");

  it("returns the ISO date string for a valid YYYY-MM-DD string", () => {
    expect(normalizeUniqueKey(field, "2025-03-16")).toBe("2025-03-16");
  });

  it("formats a Date object to YYYY-MM-DD", () => {
    const date = new Date(2026, 2, 8); // March 8 2026
    expect(normalizeUniqueKey(field, date)).toBe("2026-03-08");
  });

  it("returns null for null", () => {
    expect(normalizeUniqueKey(field, null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeUniqueKey(field, undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeUniqueKey(field, "")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(normalizeUniqueKey(field, "not-a-date")).toBeNull();
  });

  it("two items with the same date string produce the same key", () => {
    expect(normalizeUniqueKey(field, "2025-01-01")).toBe(
      normalizeUniqueKey(field, "2025-01-01"),
    );
  });

  it("different dates produce different keys", () => {
    const a = normalizeUniqueKey(field, "2025-01-01");
    const b = normalizeUniqueKey(field, "2025-01-02");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// multiselect
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - multiselect", () => {
  const field = makeField("multiselect");

  it("returns JSON of the parsed array for a valid serialized value", () => {
    expect(normalizeUniqueKey(field, '["A","B"]')).toBe('["A","B"]');
  });

  it("returns null for null (empty array after parse)", () => {
    expect(normalizeUniqueKey(field, null)).toBeNull();
  });

  it("returns null for empty string (empty array after parse)", () => {
    expect(normalizeUniqueKey(field, "")).toBeNull();
  });

  it("returns null for a serialized empty array", () => {
    expect(normalizeUniqueKey(field, "[]")).toBeNull();
  });

  it("two items with identical selections produce the same key", () => {
    expect(normalizeUniqueKey(field, '["A","B"]')).toBe(
      normalizeUniqueKey(field, '["A","B"]'),
    );
  });

  it("different orderings produce different keys (order-sensitive)", () => {
    const ab = normalizeUniqueKey(field, '["A","B"]');
    const ba = normalizeUniqueKey(field, '["B","A"]');
    expect(ab).not.toBe(ba);
  });
});

// ---------------------------------------------------------------------------
// Cross-type: null/empty consistency
// ---------------------------------------------------------------------------

describe("normalizeUniqueKey - null/empty consistency across non-boolean types", () => {
  const nullishTypes: Field["type"][] = [
    "text",
    "longtext",
    "url",
    "select",
    "number",
    "rating",
    "date",
    "multiselect",
  ];

  for (const type of nullishTypes) {
    it(`returns null for null on ${type}`, () => {
      expect(normalizeUniqueKey(makeField(type), null)).toBeNull();
    });
  }
});
