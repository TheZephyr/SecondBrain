import { describe, it, expect } from "vitest";
import type { Field, Item } from "../../types/models";

import {
  escapeCsvValue,
  serializeItemsToCsv,
  serializeItemsToJson,
  parseImportContent,
  buildImportPreview,
} from "../collectionImportExport";

describe("collectionImportExport utils", () => {
  const fields: Field[] = [
    {
      id: 1,
      collection_id: 1,
      name: "Author",
      type: "text",
      options: null,
      order_index: 0,
    },
    {
      id: 2,
      collection_id: 1,
      name: "Title",
      type: "text",
      options: null,
      order_index: 1,
    },
  ];

  const items: Item[] = [
    {
      id: 1,
      collection_id: 1,
      order: 1,
      data: {
        Title: "Dune",
        Author: "Frank",
      },
    },
    {
      id: 2,
      collection_id: 1,
      order: 2,
      data: {
        Title: 'He said "hi"',
        Author: null,
      },
    },
  ];

  it("escapes CSV values with quotes", () => {
    expect(escapeCsvValue(null)).toBe('""');
    expect(escapeCsvValue("He said \"hi\"")).toBe('"He said ""hi"""');
  });

  it("serializes items to CSV with ordered fields", () => {
    const csv = serializeItemsToCsv(items, fields);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Author","Title"');
    expect(lines[1]).toBe('"Frank","Dune"');
    expect(lines[2]).toBe('"","He said ""hi"""');
  });

  it("serializes items to JSON with ordered keys and fallback", () => {
    const json = serializeItemsToJson(items, fields);
    const parsed = JSON.parse(json) as Array<Record<string, string>>;

    expect(parsed).toEqual([
      { Author: "Frank", Title: "Dune" },
      { Author: "", Title: 'He said "hi"' },
    ]);
    expect(Object.keys(parsed[0])).toEqual(["Author", "Title"]);
  });

  it("parses CSV import content", () => {
    const content =
      '" Name ","Age","Quote"\n" Alice ","30","He said ""hi, there"""\n\n"Bob","","  spaced  "';
    const parsed = parseImportContent("csv", content);
    expect(parsed.fields).toEqual(["Name", "Age", "Quote"]);
    expect(parsed.rows).toEqual([
      { Name: "Alice", Age: "30", Quote: 'He said "hi, there"' },
      { Name: "", Age: "", Quote: "" },
      { Name: "Bob", Age: "", Quote: "spaced" },
    ]);
  });

  it("parses JSON import content", () => {
    const content = JSON.stringify([{ Name: "Alice", Age: "30" }]);
    const parsed = parseImportContent("json", content);
    expect(parsed.fields).toEqual(["Name", "Age"]);
    expect(parsed.rows).toEqual([{ Name: "Alice", Age: "30" }]);
  });

  it("rejects JSON that is not an array", () => {
    expect(() => parseImportContent("json", "{}")).toThrow("JSON_NOT_ARRAY");
  });

  it("builds import preview with matched and new fields", () => {
    const previewFields: Field[] = [
      {
        id: 10,
        collection_id: 1,
        name: "Name",
        type: "text",
        options: null,
        order_index: 0,
      },
    ];
    const parsed = {
      rows: [{ name: "Alice", City: "Paris" }],
      fields: ["name", "City"],
    };
    const preview = buildImportPreview(parsed, previewFields);

    expect(preview.itemCount).toBe(1);
    expect(preview.matchedFields).toEqual(["name"]);
    expect(preview.newFields).toEqual(["City"]);
    expect(preview.sample).toEqual([{ name: "Alice", City: "Paris" }]);
  });
});

describe("parseImportContent – CSV edge cases", () => {
  it("strips UTF-8 BOM from the first header", () => {
    const bom = "\uFEFF";
    const content = `${bom}"Name","Age"\n"Alice","30"`;
    const parsed = parseImportContent("csv", content);
    expect(parsed.fields[0]).toBe("Name");
    expect(parsed.rows[0].Name).toBe("Alice");
  });

  it("throws EMPTY_CSV for empty string", () => {
    expect(() => parseImportContent("csv", "")).toThrow("EMPTY_CSV");
  });

  it("throws EMPTY_CSV for whitespace-only string", () => {
    expect(() => parseImportContent("csv", "   \n\n  ")).toThrow("EMPTY_CSV");
  });

  it("handles commas inside quoted values", () => {
    const content = '"Name","Address"\n"Alice","123 Main St, Apt 4"';
    const parsed = parseImportContent("csv", content);
    expect(parsed.rows[0].Address).toBe("123 Main St, Apt 4");
  });

  it("handles rows with missing columns (fills with empty string)", () => {
    const content = '"A","B","C"\n"1","2","3"\n"only-a"';
    const parsed = parseImportContent("csv", content);
    expect(parsed.rows[1].A).toBe("only-a");
    expect(parsed.rows[1].B).toBe("");
    expect(parsed.rows[1].C).toBe("");
  });

  it("trims whitespace from header names and values", () => {
    const content = '"  Name  "," Age "\n"  Alice  "," 30 "';
    const parsed = parseImportContent("csv", content);
    expect(parsed.fields).toEqual(["Name", "Age"]);
    expect(parsed.rows[0].Name).toBe("Alice");
    expect(parsed.rows[0].Age).toBe("30");
  });

  it("handles unicode and emoji values", () => {
    const content = '"Name","Note"\n"Ñoño","Hello 🌍🎉"';
    const parsed = parseImportContent("csv", content);
    expect(parsed.rows[0].Name).toBe("Ñoño");
    expect(parsed.rows[0].Note).toBe("Hello 🌍🎉");
  });
});

describe("parseImportContent – JSON edge cases", () => {
  it("handles empty JSON array", () => {
    const parsed = parseImportContent("json", "[]");
    expect(parsed.fields).toEqual([]);
    expect(parsed.rows).toEqual([]);
  });

  it("rejects non-array JSON (object)", () => {
    expect(() => parseImportContent("json", '{"a": 1}')).toThrow(
      "JSON_NOT_ARRAY",
    );
  });

  it("rejects non-array JSON (string)", () => {
    expect(() => parseImportContent("json", '"hello"')).toThrow(
      "JSON_NOT_ARRAY",
    );
  });
});

describe("serializeItemsToCsv – edge cases", () => {
  it("handles items with null field values", () => {
    const testFields: Field[] = [
      {
        id: 1,
        collection_id: 1,
        name: "A",
        type: "text",
        options: null,
        order_index: 0,
      },
      {
        id: 2,
        collection_id: 1,
        name: "B",
        type: "text",
        options: null,
        order_index: 1,
      },
    ];
    const testItems: Item[] = [
      { id: 1, collection_id: 1, order: 1, data: { A: "value", B: null } },
    ];

    const csv = serializeItemsToCsv(testItems, testFields);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"value",""');
  });

  it("handles items with undefined (missing) field values", () => {
    const testFields: Field[] = [
      {
        id: 1,
        collection_id: 1,
        name: "A",
        type: "text",
        options: null,
        order_index: 0,
      },
      {
        id: 2,
        collection_id: 1,
        name: "B",
        type: "text",
        options: null,
        order_index: 1,
      },
    ];
    const testItems: Item[] = [
      { id: 1, collection_id: 1, order: 1, data: { A: "only-a" } },
    ];

    const csv = serializeItemsToCsv(testItems, testFields);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"only-a",""');
  });

  it("exports fields in order_index order regardless of input order", () => {
    const testFields: Field[] = [
      {
        id: 1,
        collection_id: 1,
        name: "Z-Last",
        type: "text",
        options: null,
        order_index: 2,
      },
      {
        id: 2,
        collection_id: 1,
        name: "A-First",
        type: "text",
        options: null,
        order_index: 0,
      },
      {
        id: 3,
        collection_id: 1,
        name: "M-Middle",
        type: "text",
        options: null,
        order_index: 1,
      },
    ];
    const testItems: Item[] = [];

    const csv = serializeItemsToCsv(testItems, testFields);
    expect(csv).toBe('"A-First","M-Middle","Z-Last"');
  });
});

describe("serializeItemsToJson – edge cases", () => {
  it("replaces undefined values with empty string in JSON output", () => {
    const testFields: Field[] = [
      {
        id: 1,
        collection_id: 1,
        name: "A",
        type: "text",
        options: null,
        order_index: 0,
      },
      {
        id: 2,
        collection_id: 1,
        name: "B",
        type: "text",
        options: null,
        order_index: 1,
      },
    ];
    const testItems: Item[] = [
      { id: 1, collection_id: 1, order: 1, data: { A: "value" } },
    ];

    const json = serializeItemsToJson(testItems, testFields);
    const parsed = JSON.parse(json) as Array<Record<string, string>>;
    expect(parsed[0].A).toBe("value");
    expect(parsed[0].B).toBe("");
  });

  it("preserves key order matching order_index", () => {
    const testFields: Field[] = [
      {
        id: 1,
        collection_id: 1,
        name: "Zebra",
        type: "text",
        options: null,
        order_index: 1,
      },
      {
        id: 2,
        collection_id: 1,
        name: "Alpha",
        type: "text",
        options: null,
        order_index: 0,
      },
    ];
    const testItems: Item[] = [
      { id: 1, collection_id: 1, order: 1, data: { Zebra: "z", Alpha: "a" } },
    ];

    const json = serializeItemsToJson(testItems, testFields);
    const parsed = JSON.parse(json) as Array<Record<string, string>>;
    expect(Object.keys(parsed[0])).toEqual(["Alpha", "Zebra"]);
  });
});
