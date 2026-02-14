import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, handleOperation, initDatabase } from "../db-worker";
import type {
  Collection,
  Field,
  ImportCollectionInput,
  NewCollectionInput,
  NewFieldInput,
  NewItemInput,
} from "../../src/types/models";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ItemRow = { id: number; collection_id: number; data: string };

type GetItemsResult = {
  items: ItemRow[];
  total: number;
  limit: number;
  offset: number;
};

function setupInMemoryDb() {
  closeDatabase();
  initDatabase(":memory:");
}

function addCollection(input: NewCollectionInput): Collection {
  return handleOperation({ type: "addCollection", input }) as Collection;
}

function addField(input: NewFieldInput): { id: number } & NewFieldInput {
  return handleOperation({ type: "addField", input }) as {
    id: number;
  } & NewFieldInput;
}

function addItem(
  input: NewItemInput,
): { id: number; collection_id: number; data: Record<string, unknown> } {
  return handleOperation({ type: "addItem", input }) as {
    id: number;
    collection_id: number;
    data: Record<string, unknown>;
  };
}

function getFields(collectionId: number): Field[] {
  return handleOperation({ type: "getFields", collectionId }) as Field[];
}

function getItems(collectionId: number): GetItemsResult {
  return handleOperation({
    type: "getItems",
    input: {
      collectionId,
      limit: 1000,
      offset: 0,
      search: "",
      sort: [],
    },
  }) as GetItemsResult;
}

function runImport(input: ImportCollectionInput): boolean {
  return handleOperation({
    type: "importCollection",
    input,
  }) as boolean;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  closeDatabase();
});

describe("importCollection – append mode", () => {
  it("adds new items without touching existing ones", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books", icon: "book" });
    addItem({ collectionId: col.id, data: { Title: "Existing" } });

    runImport({
      collectionId: col.id,
      mode: "append",
      newFields: [],
      items: [
        { collectionId: col.id, data: { Title: "Imported A" } },
        { collectionId: col.id, data: { Title: "Imported B" } },
      ],
    });

    const result = getItems(col.id);
    expect(result.total).toBe(3);
    const titles = result.items.map((i) => JSON.parse(i.data).Title).sort();
    expect(titles).toEqual(["Existing", "Imported A", "Imported B"]);
  });

  it("creates new fields alongside imported items", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books", icon: "book" });
    addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });

    runImport({
      collectionId: col.id,
      mode: "append",
      newFields: [
        {
          collectionId: col.id,
          name: "Author",
          type: "text",
          options: null,
          orderIndex: 1,
        },
      ],
      items: [
        {
          collectionId: col.id,
          data: { Title: "Dune", Author: "Frank Herbert" },
        },
      ],
    });

    const fields = getFields(col.id);
    expect(fields.map((f) => f.name).sort()).toEqual(["Author", "Title"]);

    const result = getItems(col.id);
    expect(result.total).toBe(1);
    const itemData = JSON.parse(result.items[0].data);
    expect(itemData.Author).toBe("Frank Herbert");
  });
});

describe("importCollection – replace mode", () => {
  it("deletes existing items and inserts new ones", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books", icon: "book" });
    addItem({ collectionId: col.id, data: { Title: "Old Item" } });

    runImport({
      collectionId: col.id,
      mode: "replace",
      newFields: [],
      items: [
        { collectionId: col.id, data: { Title: "New A" } },
        { collectionId: col.id, data: { Title: "New B" } },
      ],
    });

    const result = getItems(col.id);
    expect(result.total).toBe(2);
    const titles = result.items.map((i) => JSON.parse(i.data).Title).sort();
    expect(titles).toEqual(["New A", "New B"]);
  });

  it("preserves existing fields while replacing items", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books", icon: "book" });
    addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addItem({ collectionId: col.id, data: { Title: "Old" } });

    runImport({
      collectionId: col.id,
      mode: "replace",
      newFields: [],
      items: [{ collectionId: col.id, data: { Title: "Replaced" } }],
    });

    const fields = getFields(col.id);
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe("Title");
  });

  it("does not affect items in other collections", () => {
    setupInMemoryDb();
    const col1 = addCollection({ name: "A", icon: "a" });
    const col2 = addCollection({ name: "B", icon: "b" });
    addItem({ collectionId: col1.id, data: { X: "keep" } });
    addItem({ collectionId: col2.id, data: { Y: "also keep" } });

    runImport({
      collectionId: col1.id,
      mode: "replace",
      newFields: [],
      items: [{ collectionId: col1.id, data: { X: "new" } }],
    });

    const col2Items = getItems(col2.id);
    expect(col2Items.total).toBe(1);
    expect(JSON.parse(col2Items.items[0].data).Y).toBe("also keep");
  });
});

describe("importCollection – edge cases", () => {
  it("handles empty import (0 items, 0 new fields) without error", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books", icon: "book" });
    addItem({ collectionId: col.id, data: { Title: "Existing" } });

    runImport({
      collectionId: col.id,
      mode: "append",
      newFields: [],
      items: [],
    });

    const result = getItems(col.id);
    expect(result.total).toBe(1);
  });

  it("handles empty replace (clears all items)", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books", icon: "book" });
    addItem({ collectionId: col.id, data: { Title: "A" } });
    addItem({ collectionId: col.id, data: { Title: "B" } });

    runImport({
      collectionId: col.id,
      mode: "replace",
      newFields: [],
      items: [],
    });

    const result = getItems(col.id);
    expect(result.total).toBe(0);
  });

  it("imports multiple new fields with correct order indices", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Books", icon: "book" });

    runImport({
      collectionId: col.id,
      mode: "append",
      newFields: [
        {
          collectionId: col.id,
          name: "Title",
          type: "text",
          options: null,
          orderIndex: 0,
        },
        {
          collectionId: col.id,
          name: "Year",
          type: "number",
          options: null,
          orderIndex: 1,
        },
        {
          collectionId: col.id,
          name: "Genre",
          type: "select",
          options: "Fiction,Non-fiction",
          orderIndex: 2,
        },
      ],
      items: [],
    });

    const fields = getFields(col.id);
    expect(fields).toHaveLength(3);
    expect(fields[0].name).toBe("Title");
    expect(fields[0].order_index).toBe(0);
    expect(fields[1].name).toBe("Year");
    expect(fields[1].order_index).toBe(1);
    expect(fields[2].name).toBe("Genre");
    expect(fields[2].order_index).toBe(2);
    expect(fields[2].options).toBe("Fiction,Non-fiction");
  });

  it("imports items with varying data shapes", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Mixed", icon: "folder" });

    runImport({
      collectionId: col.id,
      mode: "append",
      newFields: [],
      items: [
        { collectionId: col.id, data: { Title: "Full", Rating: 5 } },
        { collectionId: col.id, data: { Title: "Partial" } },
        { collectionId: col.id, data: { Rating: 10 } },
      ],
    });

    const result = getItems(col.id);
    expect(result.total).toBe(3);
  });
});
