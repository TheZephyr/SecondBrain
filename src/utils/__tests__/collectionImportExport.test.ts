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
      data: {
        Title: "Dune",
        Author: "Frank",
      },
    },
    {
      id: 2,
      collection_id: 1,
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
