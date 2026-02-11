import { describe, it, expect } from "vitest";
import { isSafeFieldName } from "../fieldNames";

describe("isSafeFieldName", () => {
  it("accepts valid field names", () => {
    expect(isSafeFieldName("Title")).toBe(true);
    expect(isSafeFieldName("Title 2")).toBe(true);
    expect(isSafeFieldName("field_name")).toBe(true);
    expect(isSafeFieldName("field-name")).toBe(true);
  });

  it("rejects invalid field names", () => {
    expect(isSafeFieldName("a.b")).toBe(false);
    expect(isSafeFieldName("__proto__")).toBe(false);
    expect(isSafeFieldName("constructor")).toBe(false);
    expect(isSafeFieldName(" Title")).toBe(false);
    expect(isSafeFieldName("Title ")).toBe(false);
    expect(isSafeFieldName("a".repeat(65))).toBe(false);
  });
});
