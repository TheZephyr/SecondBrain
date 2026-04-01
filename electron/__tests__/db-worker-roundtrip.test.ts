import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, handleOperation, initDatabase } from "../db/worker";
import {
  serializeItemsToCsv,
  serializeItemsToJson,
  parseImportContent,
  buildImportPreview,
} from "../../src/utils/collectionImportExport";
import type {
  Collection,
  Field,
  Item,
  NewCollectionInput,
  NewFieldInput,
  NewItemInput,
} from "../../src/types/models";

function setupInMemoryDb() {
  closeDatabase();
  initDatabase(":memory:");
}

function addCollection(input: NewCollectionInput): Collection {
  return handleOperation({ type: "addCollection", input }) as Collection;
}

function addField(input: NewFieldInput): Field & { id: number } {
  return handleOperation({ type: "addField", input }) as Field & { id: number };
}

function addItem(input: NewItemInput): { id: number } {
  return handleOperation({ type: "addItem", input }) as { id: number };
}

function getFields(collectionId: number): Field[] {
  return handleOperation({ type: "getFields", collectionId }) as Field[];
}

function getItems(collectionId: number): Item[] {
  const result = handleOperation({
    type: "getItems",
    input: { collectionId, limit: 1000, offset: 0, search: "", sort: [] },
  }) as { items: Item[] };
  return result.items.map((item) => ({
    ...item,
    data: typeof item.data === "string" ? JSON.parse(item.data) : item.data,
  }));
}

afterEach(() => {
  closeDatabase();
});

describe("CSV round-trip", () => {
  it("preserves all text field values after export and re-import", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books" });
    addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addField({
      collectionId: col.id,
      name: "Author",
      type: "text",
      options: null,
      orderIndex: 1,
    });
    addItem({
      collectionId: col.id,
      data: { Title: "Dune", Author: "Herbert" },
    });
    addItem({
      collectionId: col.id,
      data: { Title: 'He said "hi"', Author: "Someone" },
    });
    addItem({
      collectionId: col.id,
      data: { Title: "Empty author", Author: "" },
    });

    const fields = getFields(col.id);
    const items = getItems(col.id);

    const csv = serializeItemsToCsv(items, fields);
    const parsed = parseImportContent("csv", csv);

    expect(parsed.rows[0]?.Title).toBe("Dune");
    expect(parsed.rows[0]?.Author).toBe("Herbert");
    expect(parsed.rows[1]?.Title).toBe('He said "hi"');
    expect(parsed.rows[2]?.Author).toBe("");
  });

  it("preserves null values as empty string", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Notes" });
    addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addField({
      collectionId: col.id,
      name: "Body",
      type: "text",
      options: null,
      orderIndex: 1,
    });
    addItem({ collectionId: col.id, data: { Title: "Something", Body: null } });

    const fields = getFields(col.id);
    const items = getItems(col.id);
    const csv = serializeItemsToCsv(items, fields);
    const parsed = parseImportContent("csv", csv);

    expect(parsed.rows[0]?.Body).toBe("");
  });

  it("preserves field order across export and re-import", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addField({
      collectionId: col.id,
      name: "Z",
      type: "text",
      options: null,
      orderIndex: 2,
    });
    addField({
      collectionId: col.id,
      name: "A",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addField({
      collectionId: col.id,
      name: "M",
      type: "text",
      options: null,
      orderIndex: 1,
    });

    const fields = getFields(col.id);
    const items = getItems(col.id);
    const csv = serializeItemsToCsv(items, fields);
    const firstLine = csv.split("\n")[0];

    expect(firstLine).toBe('"A","M","Z"');
  });
});

describe("JSON round-trip", () => {
  it("preserves all values after export and re-import", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Tasks" });
    addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addField({
      collectionId: col.id,
      name: "Done",
      type: "text",
      options: null,
      orderIndex: 1,
    });
    addItem({
      collectionId: col.id,
      data: { Title: "Write tests", Done: "1" },
    });
    addItem({ collectionId: col.id, data: { Title: "Ship it", Done: "0" } });

    const fields = getFields(col.id);
    const items = getItems(col.id);
    const json = serializeItemsToJson(items, fields);
    const parsed = parseImportContent("json", json);

    expect(parsed.rows[0]?.Title).toBe("Write tests");
    expect(parsed.rows[0]?.Done).toBe("1");
    expect(parsed.rows[1]?.Done).toBe("0");
  });

  it("handles special characters in JSON export", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Special" });
    addField({
      collectionId: col.id,
      name: "Content",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addItem({
      collectionId: col.id,
      data: { Content: 'Line1\nLine2\t"quoted"' },
    });

    const fields = getFields(col.id);
    const items = getItems(col.id);
    const json = serializeItemsToJson(items, fields);
    const parsed = parseImportContent("json", json);

    expect(parsed.rows[0]?.Content).toBe('Line1\nLine2\t"quoted"');
  });

  it("preserves field schema and unused select choices in wrapped JSON export", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Tasks" });
    addField({
      collectionId: col.id,
      name: "Status",
      type: "select",
      options: JSON.stringify({ choices: ["Open", "Closed", "Paused"] }),
      orderIndex: 0,
    });
    addField({
      collectionId: col.id,
      name: "Due",
      type: "date",
      options: JSON.stringify({ format: "YYYY-MM-DD" }),
      orderIndex: 1,
    });
    addField({
      collectionId: col.id,
      name: "Score",
      type: "number",
      options: null,
      orderIndex: 2,
    });
    addItem({
      collectionId: col.id,
      data: { Status: "Open", Due: "2026-04-01", Score: 10 },
    });

    const fields = getFields(col.id);
    const items = getItems(col.id);
    const json = serializeItemsToJson(items, fields, { includeSchema: true });
    const parsed = parseImportContent("json", json);
    const preview = buildImportPreview(parsed, []);

    expect(parsed.fields).toEqual(["Status", "Due", "Score"]);
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
        name: "Score",
        inferredType: "number",
        selectedType: "number",
        inferredChoices: [],
        source: "schema",
        sourceOptions: {
          type: "number",
        },
      },
    ]);
  });
});

describe("import preview field matching", () => {
  it("correctly identifies matched and new fields case-insensitively", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addField({
      collectionId: col.id,
      name: "Author",
      type: "text",
      options: null,
      orderIndex: 1,
    });

    const fields = getFields(col.id);
    const parsed = parseImportContent(
      "csv",
      '"title","Author","NewField"\n"a","b","c"',
    );
    const preview = buildImportPreview(parsed, fields);

    expect(preview.matchedFields).toContain("title");
    expect(preview.matchedFields).toContain("Author");
    expect(preview.newFields).toContainEqual({
      name: "NewField",
      inferredType: "select",
      selectedType: "select",
      inferredChoices: ["c"],
      source: "inference",
      sourceOptions: null,
    });
    expect(preview.itemCount).toBe(1);
  });
});

describe("pagination boundary correctness", () => {
  it("returns exactly 100 items on page 0 when 100 exist", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Big" });
    for (let i = 0; i < 100; i++) {
      addItem({ collectionId: col.id, data: { n: String(i) } });
    }

    const result = handleOperation({
      type: "getItems",
      input: {
        collectionId: col.id,
        limit: 100,
        offset: 0,
        search: "",
        sort: [],
      },
    }) as { items: unknown[]; total: number };

    expect(result.items).toHaveLength(100);
    expect(result.total).toBe(100);
  });

  it("returns 1 item on page 1 when 101 items exist", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Big" });
    for (let i = 0; i < 101; i++) {
      addItem({ collectionId: col.id, data: { n: String(i) } });
    }

    const result = handleOperation({
      type: "getItems",
      input: {
        collectionId: col.id,
        limit: 100,
        offset: 100,
        search: "",
        sort: [],
      },
    }) as { items: unknown[]; total: number };

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(101);
  });

  it("returns no duplicates across two pages", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Big" });
    for (let i = 0; i < 150; i++) {
      addItem({ collectionId: col.id, data: { n: String(i) } });
    }

    const page1 = handleOperation({
      type: "getItems",
      input: {
        collectionId: col.id,
        limit: 100,
        offset: 0,
        search: "",
        sort: [],
      },
    }) as { items: { id: number }[] };

    const page2 = handleOperation({
      type: "getItems",
      input: {
        collectionId: col.id,
        limit: 100,
        offset: 100,
        search: "",
        sort: [],
      },
    }) as { items: { id: number }[] };

    const page1Ids = new Set(page1.items.map((i) => i.id));
    const overlap = page2.items.filter((i) => page1Ids.has(i.id));

    expect(overlap).toHaveLength(0);
    expect(page1.items).toHaveLength(100);
    expect(page2.items).toHaveLength(50);
  });
});

describe("import with all field types", () => {
  it("imports select, boolean, and number values without corrupting them", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Typed" });

    handleOperation({
      type: "importCollection",
      input: {
        collectionId: col.id,
        mode: "append",
        newFields: [
          {
            collectionId: col.id,
            name: "Status",
            type: "select",
            options: JSON.stringify({ choices: ["Open", "Done"] }),
            orderIndex: 0,
          },
          {
            collectionId: col.id,
            name: "Rating",
            type: "number",
            options: null,
            orderIndex: 1,
          },
          {
            collectionId: col.id,
            name: "Done",
            type: "boolean",
            options: null,
            orderIndex: 2,
          },
        ],
        items: [
          {
            collectionId: col.id,
            data: { Status: "Open", Rating: 4, Done: "1" },
          },
          {
            collectionId: col.id,
            data: { Status: "Done", Rating: 0, Done: "0" },
          },
          {
            collectionId: col.id,
            data: { Status: null, Rating: null, Done: "0" },
          },
        ],
      },
    });

    const items = getItems(col.id);
    expect(items[0]?.data.Status).toBe("Open");
    expect(items[0]?.data.Rating).toBe(4);
    expect(items[0]?.data.Done).toBe("1");
    expect(items[2]?.data.Status).toBeNull();
    expect(items[2]?.data.Rating).toBeNull();
  });
});
