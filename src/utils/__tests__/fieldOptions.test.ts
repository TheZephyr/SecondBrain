import { describe, expect, it } from "vitest";
import {
  getDefaultOptions,
  getRatingOptionColors,
  getRatingValueColor,
  getSelectChoiceColor,
  getSelectChoices,
  getSelectOptionColors,
  parseFieldOptions,
  serializeFieldOptions,
} from "../fieldOptions";

describe("fieldOptions utils", () => {
  it("returns defaults when raw options are null", () => {
    expect(parseFieldOptions("text", null)).toEqual({});
    expect(parseFieldOptions("longtext", null)).toEqual({ richText: false });
    expect(parseFieldOptions("number", null)).toEqual({
      showAsChip: false,
      showThousandsSeparator: false,
      colorScale: null,
    });
    expect(parseFieldOptions("date", null)).toEqual({ format: "YYYY-MM-DD" });
    expect(parseFieldOptions("select", null)).toEqual({ choices: [], optionColors: {} });
    expect(parseFieldOptions("multiselect", null)).toEqual({ choices: [], optionColors: {} });
    expect(parseFieldOptions("boolean", null)).toEqual({ icon: "square" });
    expect(parseFieldOptions("url", null)).toEqual({});
    expect(parseFieldOptions("rating", null)).toEqual({
      icon: "star",
      color: "currentColor",
      optionColors: {},
      min: 0,
      max: 5,
    });
  });

  it("returns defaults when JSON.parse returns a non-object", () => {
    expect(parseFieldOptions("text", '"string"')).toEqual({});
    expect(parseFieldOptions("text", "123")).toEqual({});
    expect(parseFieldOptions("text", "true")).toEqual({});
    expect(parseFieldOptions("text", "null")).toEqual({});
  });

  it("parses well-formed JSON options", () => {
    const raw = JSON.stringify({ choices: ["A", "B"], defaultValue: "A" });
    const parsed = parseFieldOptions("select", raw);
    expect(parsed).toEqual({ choices: ["A", "B"], defaultValue: "A", optionColors: {} });
  });

  it("merges defaults for partial options", () => {
    const raw = JSON.stringify({ max: 10 });
    const parsed = parseFieldOptions("rating", raw);
    expect(parsed).toEqual({
      icon: "star",
      color: "currentColor",
      optionColors: {},
      min: 0,
      max: 10,
    });
  });

  it("falls back to defaults on malformed JSON", () => {
    const parsed = parseFieldOptions("date", "{oops");
    expect(parsed).toEqual(getDefaultOptions("date"));
  });

  it("serializes and parses round-trip", () => {
    const options = { choices: ["One", "Two"], defaultValue: "One", optionColors: {} };
    const raw = serializeFieldOptions(options as any);
    const parsed = parseFieldOptions("select", raw);
    expect(parsed).toEqual(options);
  });

  describe("getSelectChoices", () => {
    it("returns choices from field options", () => {
      const field = { type: "select", options: JSON.stringify({ choices: ["A", "B"] }) } as any;
      expect(getSelectChoices(field)).toEqual(["A", "B"]);
    });

    it("returns empty array if no choices", () => {
      const field = { type: "select", options: null } as any;
      expect(getSelectChoices(field)).toEqual([]);
    });

    it("returns empty array if choices is null in options", () => {
      const field = { type: "select", options: JSON.stringify({ choices: null }) } as any;
      expect(getSelectChoices(field)).toEqual([]);
    });
  });

  describe("getSelectOptionColors", () => {
    it("returns option colors from select field", () => {
      const field = {
        type: "select",
        options: JSON.stringify({ optionColors: { A: "red" } }),
      } as any;
      expect(getSelectOptionColors(field)).toEqual({ A: "red" });
    });

    it("returns option colors from multiselect field", () => {
      const field = {
        type: "multiselect",
        options: JSON.stringify({ optionColors: { B: "blue" } }),
      } as any;
      expect(getSelectOptionColors(field)).toEqual({ B: "blue" });
    });

    it("returns empty object if no option colors", () => {
      const field = { type: "select", options: null } as any;
      expect(getSelectOptionColors(field)).toEqual({});
    });

    it("returns empty object if optionColors is null in options", () => {
      const field = { type: "select", options: JSON.stringify({ optionColors: null }) } as any;
      expect(getSelectOptionColors(field)).toEqual({});
    });
  });

  describe("getSelectChoiceColor", () => {
    it("returns color for a choice", () => {
      const field = {
        type: "select",
        options: JSON.stringify({ optionColors: { A: "red" } }),
      } as any;
      expect(getSelectChoiceColor(field, "A")).toBe("red");
    });

    it("returns null for unknown choice", () => {
      const field = {
        type: "select",
        options: JSON.stringify({ optionColors: { A: "red" } }),
      } as any;
      expect(getSelectChoiceColor(field, "B")).toBeNull();
    });

    it("returns null for empty string color", () => {
      const field = {
        type: "select",
        options: JSON.stringify({ optionColors: { A: "  " } }),
      } as any;
      expect(getSelectChoiceColor(field, "A")).toBeNull();
    });
  });

  describe("getRatingOptionColors", () => {
    it("returns option colors from rating field", () => {
      const field = {
        type: "rating",
        options: JSON.stringify({ optionColors: { "5": "gold" } }),
      } as any;
      expect(getRatingOptionColors(field)).toEqual({ "5": "gold" });
    });

    it("returns empty object if no option colors", () => {
      const field = { type: "rating", options: null } as any;
      expect(getRatingOptionColors(field)).toEqual({});
    });

    it("returns empty object if optionColors is null in options", () => {
      const field = { type: "rating", options: JSON.stringify({ optionColors: null }) } as any;
      expect(getRatingOptionColors(field)).toEqual({});
    });
  });

  describe("getRatingValueColor", () => {
    it("returns color for a rating value", () => {
      const field = {
        type: "rating",
        options: JSON.stringify({ optionColors: { "5": "gold" } }),
      } as any;
      expect(getRatingValueColor(field, 5)).toBe("gold");
    });

    it("returns null for invalid values", () => {
      const field = { type: "rating", options: null } as any;
      expect(getRatingValueColor(field, null as any)).toBeNull();
      expect(getRatingValueColor(field, undefined as any)).toBeNull();
      expect(getRatingValueColor(field, NaN)).toBeNull();
      expect(getRatingValueColor(field, Infinity)).toBeNull();
    });

    it("returns null if no color for value", () => {
      const field = {
        type: "rating",
        options: JSON.stringify({ optionColors: { "5": "gold" } }),
      } as any;
      expect(getRatingValueColor(field, 4)).toBeNull();
    });

    it("returns null for empty string color", () => {
      const field = {
        type: "rating",
        options: JSON.stringify({ optionColors: { "5": " " } }),
      } as any;
      expect(getRatingValueColor(field, 5)).toBeNull();
    });
  });
});
