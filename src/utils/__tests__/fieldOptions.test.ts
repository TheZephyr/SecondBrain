import { describe, expect, it } from "vitest";
import {
  getDefaultOptions,
  parseFieldOptions,
  serializeFieldOptions,
} from "../fieldOptions";

describe("fieldOptions utils", () => {
  it("returns defaults when raw options are null", () => {
    expect(parseFieldOptions("text", null)).toEqual({});
    expect(parseFieldOptions("longtext", null)).toEqual({ richText: false });
    expect(parseFieldOptions("number", null)).toEqual({});
    expect(parseFieldOptions("date", null)).toEqual({ format: "YYYY-MM-DD" });
    expect(parseFieldOptions("select", null)).toEqual({ choices: [] });
    expect(parseFieldOptions("multiselect", null)).toEqual({ choices: [] });
    expect(parseFieldOptions("boolean", null)).toEqual({ icon: "square" });
    expect(parseFieldOptions("url", null)).toEqual({});
    expect(parseFieldOptions("rating", null)).toEqual({
      icon: "star",
      color: "currentColor",
      min: 0,
      max: 5,
    });
  });

  it("parses well-formed JSON options", () => {
    const raw = JSON.stringify({ choices: ["A", "B"], defaultValue: "A" });
    const parsed = parseFieldOptions("select", raw);
    expect(parsed).toEqual({ choices: ["A", "B"], defaultValue: "A" });
  });

  it("merges defaults for partial options", () => {
    const raw = JSON.stringify({ max: 10 });
    const parsed = parseFieldOptions("rating", raw);
    expect(parsed).toEqual({
      icon: "star",
      color: "currentColor",
      min: 0,
      max: 10,
    });
  });

  it("falls back to defaults on malformed JSON", () => {
    const parsed = parseFieldOptions("date", "{oops");
    expect(parsed).toEqual(getDefaultOptions("date"));
  });

  it("serializes and parses round-trip", () => {
    const options = { choices: ["One", "Two"], defaultValue: "One" };
    const raw = serializeFieldOptions(options);
    const parsed = parseFieldOptions("select", raw);
    expect(parsed).toEqual(options);
  });
});
