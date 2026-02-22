import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, handleOperation, initDatabase } from "../db-worker";
import type {
  Collection,
  View,
  Field,
  NewCollectionInput,
  NewViewInput,
  NewFieldInput,
  NewItemInput,
  UpdateCollectionInput,
  UpdateFieldInput,
  UpdateItemInput,
} from "../../src/types/models";

// ---------------------------------------------------------------------------
// Helpers – thin wrappers around handleOperation to get typed return values
// ---------------------------------------------------------------------------

type ItemRow = { id: number; collection_id: number; data: string };

type GetItemsResult = {
  items: ItemRow[];
  total: number;
  limit: number;
  offset: number;
};

type CollectionItemCount = {
  collectionId: number;
  itemCount: number;
};

function setupInMemoryDb() {
  closeDatabase();
  initDatabase(":memory:");
}

function addCollection(input: NewCollectionInput): Collection {
  return handleOperation({ type: "addCollection", input }) as Collection;
}

function getCollections(): Collection[] {
  return handleOperation({ type: "getCollections" }) as Collection[];
}

function updateCollection(input: UpdateCollectionInput): boolean {
  return handleOperation({ type: "updateCollection", input }) as boolean;
}

function deleteCollection(id: number): boolean {
  return handleOperation({ type: "deleteCollection", id }) as boolean;
}

function getViews(collectionId: number): View[] {
  return handleOperation({ type: "getViews", collectionId }) as View[];
}

function addView(input: NewViewInput): View {
  return handleOperation({ type: "addView", input }) as View;
}

function getCollectionItemCounts(): CollectionItemCount[] {
  return handleOperation({
    type: "getCollectionItemCounts",
  }) as CollectionItemCount[];
}

function addField(
  input: NewFieldInput,
): { id: number } & NewFieldInput {
  return handleOperation({ type: "addField", input }) as {
    id: number;
  } & NewFieldInput;
}

function getFields(collectionId: number): Field[] {
  return handleOperation({ type: "getFields", collectionId }) as Field[];
}

function updateField(input: UpdateFieldInput): boolean {
  return handleOperation({ type: "updateField", input }) as boolean;
}

function deleteField(id: number): boolean {
  return handleOperation({ type: "deleteField", id }) as boolean;
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

function getItems(
  collectionId: number,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    sort?: { field: string; order: 1 | -1 }[];
  } = {},
): GetItemsResult {
  return handleOperation({
    type: "getItems",
    input: {
      collectionId,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      search: options.search ?? "",
      sort: options.sort ?? [],
    },
  }) as GetItemsResult;
}

function updateItem(input: UpdateItemInput): boolean {
  return handleOperation({ type: "updateItem", input }) as boolean;
}

function deleteItem(id: number): boolean {
  return handleOperation({ type: "deleteItem", id }) as boolean;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  closeDatabase();
});

// ======================== COLLECTIONS ========================

describe("collection CRUD", () => {
  it("adds and retrieves a collection", () => {
    setupInMemoryDb();
    const created = addCollection({ name: "Books" });

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("Books");

    const all = getCollections();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
    expect(all[0].name).toBe("Books");
  });

  it("returns collections in created_at ASC order", () => {
    setupInMemoryDb();
    const a = addCollection({ name: "A" });
    const b = addCollection({ name: "B" });
    const c = addCollection({ name: "C" });

    const all = getCollections();
    expect(all.map((col) => col.id)).toEqual([a.id, b.id, c.id]);
  });

  it("updates a collection name", () => {
    setupInMemoryDb();
    const created = addCollection({ name: "Old" });
    updateCollection({ id: created.id, name: "New" });

    const all = getCollections();
    expect(all[0].name).toBe("New");
  });

  it("deletes a collection and cascades to fields and items", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Temp" });
    addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    addItem({ collectionId: col.id, data: { Title: "Hello" } });

    deleteCollection(col.id);

    expect(getCollections()).toHaveLength(0);
    expect(getFields(col.id)).toHaveLength(0);
    expect(getItems(col.id).items).toHaveLength(0);
  });

  it("returns item counts grouped by collection", () => {
    setupInMemoryDb();
    const col1 = addCollection({ name: "A" });
    const col2 = addCollection({ name: "B" });
    addItem({ collectionId: col1.id, data: { X: "1" } });
    addItem({ collectionId: col1.id, data: { X: "2" } });
    addItem({ collectionId: col2.id, data: { Y: "1" } });

    const counts = getCollectionItemCounts();
    const map = new Map(counts.map((c) => [c.collectionId, c.itemCount]));

    expect(map.get(col1.id)).toBe(2);
    expect(map.get(col2.id)).toBe(1);
  });

  it("returns empty array when no collections exist", () => {
    setupInMemoryDb();
    expect(getCollections()).toEqual([]);
  });
});

// ======================== VIEWS ========================

describe("view CRUD", () => {
  it("creates a default view when a collection is added", () => {
    setupInMemoryDb();
    const created = addCollection({ name: "Notes" });

    const views = getViews(created.id);
    expect(views).toHaveLength(1);
    expect(views[0].name).toBe("Grid");
    expect(views[0].type).toBe("grid");
    expect(views[0].is_default).toBe(1);
    expect(views[0].order).toBe(0);
  });

  it("adds a view and returns it", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Views" });

    const created = addView({
      collectionId: col.id,
      name: "Alt Grid",
      type: "grid",
      isDefault: 0,
      order: 2,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.collection_id).toBe(col.id);
    expect(created.name).toBe("Alt Grid");
    expect(created.type).toBe("grid");
    expect(created.is_default).toBe(0);
    expect(created.order).toBe(2);
  });

  it('returns views sorted by "order" then id', () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Ordered" });

    addView({
      collectionId: col.id,
      name: "Second",
      type: "grid",
      isDefault: 0,
      order: 2,
    });
    addView({
      collectionId: col.id,
      name: "First",
      type: "grid",
      isDefault: 0,
      order: 1,
    });

    const views = getViews(col.id);
    expect(views.map((view) => view.name)).toEqual([
      "Grid",
      "First",
      "Second",
    ]);
  });
});

// ======================== FIELDS ========================

describe("field CRUD", () => {
  it("adds fields with auto-incrementing order_index", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });

    const f1 = addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
    });
    const f2 = addField({
      collectionId: col.id,
      name: "Author",
      type: "text",
      options: null,
    });

    const fields = getFields(col.id);
    expect(fields).toHaveLength(2);
    expect(fields[0].name).toBe("Title");
    expect(fields[0].order_index).toBe(0);
    expect(fields[1].name).toBe("Author");
    expect(fields[1].order_index).toBe(1);

    expect(f1.id).toBe(fields[0].id);
    expect(f2.id).toBe(fields[1].id);
  });

  it("adds a field with explicit orderIndex", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });

    addField({
      collectionId: col.id,
      name: "Explicit",
      type: "number",
      options: null,
      orderIndex: 5,
    });

    const fields = getFields(col.id);
    expect(fields[0].order_index).toBe(5);
  });

  it("updates a field", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    const field = addField({
      collectionId: col.id,
      name: "OldName",
      type: "text",
      options: null,
    });

    updateField({
      id: field.id,
      name: "NewName",
      type: "number",
      options: "opt",
    });

    const fields = getFields(col.id);
    expect(fields[0].name).toBe("NewName");
    expect(fields[0].type).toBe("number");
    expect(fields[0].options).toBe("opt");
  });

  it("deletes a field", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    const field = addField({
      collectionId: col.id,
      name: "Title",
      type: "text",
      options: null,
    });

    deleteField(field.id);

    expect(getFields(col.id)).toHaveLength(0);
  });

  it("reorders fields (happy path)", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    const f1 = addField({
      collectionId: col.id,
      name: "A",
      type: "text",
      options: null,
    });
    const f2 = addField({
      collectionId: col.id,
      name: "B",
      type: "text",
      options: null,
    });
    const f3 = addField({
      collectionId: col.id,
      name: "C",
      type: "text",
      options: null,
    });

    // Reverse the order: C=0, B=1, A=2
    handleOperation({
      type: "reorderFields",
      input: {
        collectionId: col.id,
        fieldOrders: [
          { id: f3.id, orderIndex: 0 },
          { id: f2.id, orderIndex: 1 },
          { id: f1.id, orderIndex: 2 },
        ],
      },
    });

    const fields = getFields(col.id);
    expect(fields.map((f) => f.name)).toEqual(["C", "B", "A"]);
  });

  it("returns fields sorted by order_index", () => {
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
    expect(fields.map((f) => f.name)).toEqual(["A", "M", "Z"]);
  });

  it("returns empty array for a collection with no fields", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Empty" });
    expect(getFields(col.id)).toEqual([]);
  });
});

// ======================== ITEMS ========================

describe("item CRUD", () => {
  it("adds and retrieves an item", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    const created = addItem({ collectionId: col.id, data: { Title: "Hello" } });

    expect(created.id).toBeGreaterThan(0);
    expect(created.data).toEqual({ Title: "Hello" });

    const result = getItems(col.id);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);

    const itemData = JSON.parse(result.items[0].data);
    expect(itemData.Title).toBe("Hello");
  });

  it("updates an item", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    const created = addItem({
      collectionId: col.id,
      data: { Title: "Original" },
    });

    updateItem({ id: created.id, data: { Title: "Modified" } });

    const result = getItems(col.id);
    const itemData = JSON.parse(result.items[0].data);
    expect(itemData.Title).toBe("Modified");
  });

  it("deletes an item", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    const created = addItem({ collectionId: col.id, data: { Title: "Gone" } });

    deleteItem(created.id);

    const result = getItems(col.id);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("returns items from the correct collection only", () => {
    setupInMemoryDb();
    const col1 = addCollection({ name: "A" });
    const col2 = addCollection({ name: "B" });
    addItem({ collectionId: col1.id, data: { X: "1" } });
    addItem({ collectionId: col2.id, data: { Y: "2" } });

    const result1 = getItems(col1.id);
    const result2 = getItems(col2.id);

    expect(result1.items).toHaveLength(1);
    expect(result2.items).toHaveLength(1);
    expect(JSON.parse(result1.items[0].data)).toEqual({ X: "1" });
    expect(JSON.parse(result2.items[0].data)).toEqual({ Y: "2" });
  });
});

// ======================== PAGINATION ========================

describe("getItems pagination", () => {
  it("respects limit and offset", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    for (let i = 0; i < 10; i++) {
      addItem({ collectionId: col.id, data: { Index: String(i) } });
    }

    const page1 = getItems(col.id, { limit: 3, offset: 0 });
    expect(page1.items).toHaveLength(3);
    expect(page1.total).toBe(10);
    expect(page1.limit).toBe(3);
    expect(page1.offset).toBe(0);

    const page2 = getItems(col.id, { limit: 3, offset: 3 });
    expect(page2.items).toHaveLength(3);
    expect(page2.total).toBe(10);

    // Page IDs should not overlap
    const page1Ids = page1.items.map((i) => i.id);
    const page2Ids = page2.items.map((i) => i.id);
    expect(page1Ids.filter((id) => page2Ids.includes(id))).toEqual([]);
  });

  it("returns fewer items when offset nears the end", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    for (let i = 0; i < 5; i++) {
      addItem({ collectionId: col.id, data: { N: String(i) } });
    }

    const result = getItems(col.id, { limit: 3, offset: 4 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(5);
  });

  it("returns empty items array for empty collection", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Empty" });

    const result = getItems(col.id);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ======================== SEARCH ========================

describe("getItems search", () => {
  it("filters items by search token (FTS or LIKE)", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addItem({ collectionId: col.id, data: { Title: "Apple Pie" } });
    addItem({ collectionId: col.id, data: { Title: "Banana Split" } });
    addItem({ collectionId: col.id, data: { Title: "Cherry Tart" } });

    const result = getItems(col.id, { search: "banana" });
    expect(result.total).toBe(1);
    const matchData = JSON.parse(result.items[0].data);
    expect(matchData.Title).toBe("Banana Split");
  });

  it("returns all items when search is empty", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addItem({ collectionId: col.id, data: { Title: "A" } });
    addItem({ collectionId: col.id, data: { Title: "B" } });

    const result = getItems(col.id, { search: "" });
    expect(result.total).toBe(2);
  });

  it("returns no results for non-matching search", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addItem({ collectionId: col.id, data: { Title: "Hello" } });

    const result = getItems(col.id, { search: "nonexistent" });
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("searches across multiple data fields", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addItem({
      collectionId: col.id,
      data: { Title: "Dune", Author: "Frank Herbert" },
    });
    addItem({
      collectionId: col.id,
      data: { Title: "Foundation", Author: "Isaac Asimov" },
    });

    const byAuthor = getItems(col.id, { search: "herbert" });
    expect(byAuthor.total).toBe(1);
    expect(JSON.parse(byAuthor.items[0].data).Title).toBe("Dune");

    const byTitle = getItems(col.id, { search: "foundation" });
    expect(byTitle.total).toBe(1);
    expect(JSON.parse(byTitle.items[0].data).Title).toBe("Foundation");
  });
});

// ======================== SORTING ========================

describe("getItems sorting", () => {
  it("sorts items by a data field ascending", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addField({
      collectionId: col.id,
      name: "Name",
      type: "text",
      options: null,
    });
    addItem({ collectionId: col.id, data: { Name: "Charlie" } });
    addItem({ collectionId: col.id, data: { Name: "Alice" } });
    addItem({ collectionId: col.id, data: { Name: "Bob" } });

    const result = getItems(col.id, {
      sort: [{ field: "data.Name", order: 1 }],
    });

    const names = result.items.map((i) => JSON.parse(i.data).Name);
    expect(names).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts items by a data field descending", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addField({
      collectionId: col.id,
      name: "Name",
      type: "text",
      options: null,
    });
    addItem({ collectionId: col.id, data: { Name: "Alice" } });
    addItem({ collectionId: col.id, data: { Name: "Charlie" } });
    addItem({ collectionId: col.id, data: { Name: "Bob" } });

    const result = getItems(col.id, {
      sort: [{ field: "data.Name", order: -1 }],
    });

    const names = result.items.map((i) => JSON.parse(i.data).Name);
    expect(names).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("sorts numerically when values are numbers", () => {
    setupInMemoryDb();
    const col = addCollection({ name: "Col" });
    addField({
      collectionId: col.id,
      name: "Rating",
      type: "number",
      options: null,
    });
    addItem({ collectionId: col.id, data: { Rating: 5 } });
    addItem({ collectionId: col.id, data: { Rating: 1 } });
    addItem({ collectionId: col.id, data: { Rating: 10 } });

    const result = getItems(col.id, {
      sort: [{ field: "data.Rating", order: 1 }],
    });

    const ratings = result.items.map((i) => JSON.parse(i.data).Rating);
    expect(ratings).toEqual([1, 5, 10]);
  });
});
