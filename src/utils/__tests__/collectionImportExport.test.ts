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
    expect(parsed.schema).toBeNull();
  });

  it("rejects JSON that is not an array", () => {
    expect(() => parseImportContent("json", "{}")).toThrow("JSON_NOT_ARRAY");
  });

  it("serializes items to schema-wrapped JSON when requested", () => {
    const json = serializeItemsToJson(items, fields, { includeSchema: true });
    const parsed = JSON.parse(json) as {
      _schema: Record<string, Record<string, unknown>>;
      data: Array<Record<string, string>>;
    };

    expect(Object.keys(parsed._schema)).toEqual(["Author", "Title"]);
    expect(parsed._schema.Author).toEqual({ type: "text" });
    expect(parsed.data).toEqual([
      { Author: "Frank", Title: "Dune" },
      { Author: "", Title: 'He said "hi"' },
    ]);
  });

  it("parses wrapped JSON import content and keeps schema order ahead of data-only fields", () => {
    const content = JSON.stringify({
      _schema: {
        Status: { type: "select", choices: ["Open", "Closed", "Paused"] },
        Due: { type: "date", format: "YYYY-MM-DD" },
      },
      data: [{ status: "Open", Notes: "Alpha" }],
    });
    const parsed = parseImportContent("json", content);

    expect(parsed.fields).toEqual(["Status", "Due", "Notes"]);
    expect(parsed.schema).toEqual({
      Status: { type: "select", choices: ["Open", "Closed", "Paused"] },
      Due: { type: "date", format: "YYYY-MM-DD" },
    });
    expect(parsed.rows).toEqual([{ status: "Open", Notes: "Alpha" }]);
  });

  it("rejects wrapped JSON when data is not an array", () => {
    const content = JSON.stringify({
      _schema: { Title: { type: "text" } },
      data: {},
    });

    expect(() => parseImportContent("json", content)).toThrow(
      "JSON_SCHEMA_DATA_NOT_ARRAY",
    );
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
    expect(preview.newFields).toEqual([
      {
        name: "City",
        inferredType: "select",
        selectedType: "select",
        inferredChoices: ["Paris"],
        source: "inference",
        sourceOptions: null,
      },
    ]);
    expect(preview.sample).toEqual([{ name: "Alice", City: "Paris" }]);
  });

  it("infers boolean fields before select", () => {
    const preview = buildImportPreview(
      {
        fields: ["Done"],
        rows: [{ Done: "Yes" }, { Done: "no" }, { Done: "" }],
      },
      [],
    );

    expect(preview.newFields).toEqual([
      {
        name: "Done",
        inferredType: "boolean",
        selectedType: "boolean",
        inferredChoices: [],
        source: "inference",
        sourceOptions: null,
      },
    ]);
  });

  it("uses schema-backed types and choices for new fields", () => {
    const preview = buildImportPreview(
      {
        fields: ["Status", "Due", "Notes"],
        rows: [{ status: "Open", Notes: "Alpha" }],
        schema: {
          Status: {
            type: "select",
            choices: ["Open", "Closed", "Paused"],
            uniqueCheck: true,
          },
          Due: {
            type: "date",
            format: "YYYY-MM-DD",
          },
        },
      },
      [],
    );

    expect(preview.newFields).toEqual([
      {
        name: "Status",
        inferredType: "select",
        selectedType: "select",
        inferredChoices: ["Open", "Closed", "Paused"],
        source: "schema",
        sourceOptions: {
          type: "select",
          choices: ["Open", "Closed", "Paused"],
          uniqueCheck: true,
        },
      },
      {
        name: "Due",
        inferredType: "date",
        selectedType: "date",
        inferredChoices: [],
        source: "schema",
        sourceOptions: {
          type: "date",
          format: "YYYY-MM-DD",
        },
      },
      {
        name: "Notes",
        inferredType: "select",
        selectedType: "select",
        inferredChoices: ["Alpha"],
        source: "inference",
        sourceOptions: null,
      },
    ]);
  });

  it("includes schema-only fields in the preview even when no rows provide values", () => {
    const preview = buildImportPreview(
      {
        fields: ["Status", "Priority"],
        rows: [{ Status: "Open" }],
        schema: {
          Status: { type: "select", choices: ["Open", "Closed"] },
          Priority: { type: "number" },
        },
      },
      [],
    );

    expect(preview.newFields).toContainEqual({
      name: "Priority",
      inferredType: "number",
      selectedType: "number",
      inferredChoices: [],
      source: "schema",
      sourceOptions: { type: "number" },
    });
  });

  it("infers dates only for the supported storage format", () => {
    const preview = buildImportPreview(
      {
        fields: ["Due"],
        rows: [{ Due: "2026-04-01" }, { Due: "2026-05-15" }, { Due: "" }],
      },
      [],
    );

    expect(preview.newFields[0]).toMatchObject({
      name: "Due",
      inferredType: "date",
      selectedType: "date",
    });
  });

  it("infers numbers when all non-empty values parse as finite numbers", () => {
    const preview = buildImportPreview(
      {
        fields: ["Score"],
        rows: [{ Score: "10" }, { Score: 4.5 }, { Score: "" }],
      },
      [],
    );

    expect(preview.newFields[0]).toMatchObject({
      name: "Score",
      inferredType: "number",
      selectedType: "number",
    });
  });

  it("infers select fields with low distinct counts and preserves first-seen casing", () => {
    const preview = buildImportPreview(
      {
        fields: ["Status"],
        rows: [
          { Status: "Open" },
          { Status: "closed" },
          { Status: "OPEN" },
          { Status: "Closed" },
          { Status: "Open" },
          { Status: "closed" },
          { Status: "Open" },
          { Status: "closed" },
          { Status: "Open" },
          { Status: "closed" },
        ],
      },
      [],
    );

    expect(preview.newFields[0]).toEqual({
      name: "Status",
      inferredType: "select",
      selectedType: "select",
      inferredChoices: ["Open", "closed"],
      source: "inference",
      sourceOptions: null,
    });
  });

  it("falls back to text for all-empty columns", () => {
    const preview = buildImportPreview(
      {
        fields: ["Notes"],
        rows: [{ Notes: "" }, { Notes: null }, { Notes: undefined }],
      },
      [],
    );

    expect(preview.newFields[0]).toEqual({
      name: "Notes",
      inferredType: "text",
      selectedType: "text",
      inferredChoices: [],
      source: "inference",
      sourceOptions: null,
    });
  });

  it("falls back to text when some values do not match the candidate type", () => {
    const preview = buildImportPreview(
      {
        fields: ["Mixed"],
        rows: [{ Mixed: "10" }, { Mixed: "11" }, { Mixed: "oops" }],
      },
      [],
    );

    expect(preview.newFields[0]).toEqual({
      name: "Mixed",
      inferredType: "text",
      selectedType: "text",
      inferredChoices: [],
      source: "inference",
      sourceOptions: null,
    });
  });

  it("does not infer select when distinct values hit the ratio boundary", () => {
    const preview = buildImportPreview(
      {
        fields: ["Category"],
        rows: [
          { Category: "A" },
          { Category: "B" },
          { Category: "C" },
          { Category: "A" },
          { Category: "B" },
          { Category: "C" },
          { Category: "A" },
          { Category: "B" },
          { Category: "C" },
          { Category: "A" },
        ],
      },
      [],
    );

    expect(preview.newFields[0]).toEqual({
      name: "Category",
      inferredType: "text",
      selectedType: "text",
      inferredChoices: [],
      source: "inference",
      sourceOptions: null,
    });
  });

  it("infers select for a single repeated non-empty value", () => {
    const preview = buildImportPreview(
      {
        fields: ["Status"],
        rows: [{ Status: "Open" }, { Status: "Open" }, { Status: "Open" }],
      },
      [],
    );

    expect(preview.newFields[0]).toEqual({
      name: "Status",
      inferredType: "select",
      selectedType: "select",
      inferredChoices: ["Open"],
      source: "inference",
      sourceOptions: null,
    });
  });

  it("uses native JSON values as strong signals during inference", () => {
    const preview = buildImportPreview(
      {
        fields: ["Done", "Points"],
        rows: [
          { Done: true, Points: 1 },
          { Done: false, Points: 2 },
          { Done: null, Points: 3 },
        ],
      },
      [],
    );

    expect(preview.newFields).toEqual([
      {
        name: "Done",
        inferredType: "boolean",
        selectedType: "boolean",
        inferredChoices: [],
        source: "inference",
        sourceOptions: null,
      },
      {
        name: "Points",
        inferredType: "number",
        selectedType: "number",
        inferredChoices: [],
        source: "inference",
        sourceOptions: null,
      },
    ]);
  });
});

describe("parseImportContent - CSV edge cases", () => {
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

describe("parseImportContent - JSON edge cases", () => {
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

describe("serializeItemsToCsv - edge cases", () => {
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

describe("serializeItemsToJson - edge cases", () => {
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
