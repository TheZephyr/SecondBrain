import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, handleOperation, initDatabase } from "../db-worker";
import type {
  Collection,
  Field,
  NewCollectionInput,
  NewFieldInput,
  NewItemInput,
} from "../../src/types/models";

type ItemRow = {
  id: number;
  data: string;
};

function setupInMemoryDb() {
  closeDatabase();
  initDatabase(":memory:");
}

function addCollection(input: NewCollectionInput): Collection {
  return handleOperation({ type: "addCollection", input }) as Collection;
}

function addField(input: NewFieldInput): { id: number } & NewFieldInput {
  return handleOperation({ type: "addField", input }) as { id: number } & NewFieldInput;
}

function addItem(input: NewItemInput): { id: number } {
  return handleOperation({ type: "addItem", input }) as { id: number };
}

function getFields(collectionId: number): Field[] {
  return handleOperation({ type: "getFields", collectionId }) as Field[];
}

function getRawItems(collectionId: number): ItemRow[] {
  const result = handleOperation({
    type: "getItems",
    input: {
      collectionId,
      limit: 50,
      offset: 0,
      search: "",
      sort: [],
    },
  }) as { items: ItemRow[] };

  return result.items;
}

afterEach(() => {
  closeDatabase();
});

describe("db-worker transactional multi-step operations", () => {
  it("rolls back reorderFields when payload contains invalid field IDs", () => {
    setupInMemoryDb();
    const collection = addCollection({ name: "Books" });
    const fieldA = addField({
      collectionId: collection.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    const fieldB = addField({
      collectionId: collection.id,
      name: "Author",
      type: "text",
      options: null,
      orderIndex: 1,
    });
    const fieldC = addField({
      collectionId: collection.id,
      name: "Year",
      type: "number",
      options: null,
      orderIndex: 2,
    });

    expect(() =>
      handleOperation({
        type: "reorderFields",
        input: {
          collectionId: collection.id,
          fieldOrders: [
            { id: fieldA.id, orderIndex: 0 },
            { id: 999_999, orderIndex: 1 },
            { id: fieldC.id, orderIndex: 2 },
          ],
        },
      }),
    ).toThrow();

    const fieldsAfterFailure = getFields(collection.id);
    expect(
      fieldsAfterFailure.map((field) => ({
        id: field.id,
        order_index: field.order_index,
      })),
    ).toEqual([
      { id: fieldA.id, order_index: 0 },
      { id: fieldB.id, order_index: 1 },
      { id: fieldC.id, order_index: 2 },
    ]);
  });

  it("rolls back bulkDeleteItems when request includes IDs outside the collection", () => {
    setupInMemoryDb();
    const collection = addCollection({ name: "Movies" });
    const item1 = addItem({ collectionId: collection.id, data: { Title: "A" } });
    const item2 = addItem({ collectionId: collection.id, data: { Title: "B" } });
    const item3 = addItem({ collectionId: collection.id, data: { Title: "C" } });

    expect(() =>
      handleOperation({
        type: "bulkDeleteItems",
        input: {
          collectionId: collection.id,
          itemIds: [item1.id, item2.id, 999_999],
        },
      }),
    ).toThrow();

    const itemsAfterFailure = getRawItems(collection.id);
    expect(itemsAfterFailure.map((item) => item.id).sort((a, b) => a - b)).toEqual(
      [item1.id, item2.id, item3.id].sort((a, b) => a - b),
    );
  });

  it("rolls back bulkPatchItems when one requested ID is invalid", () => {
    setupInMemoryDb();
    const collection = addCollection({ name: "Notes" });
    const item1 = addItem({
      collectionId: collection.id,
      data: { Title: "Original", Status: "New" },
    });
    const item2 = addItem({
      collectionId: collection.id,
      data: { Title: "Second", Status: "New" },
    });

    expect(() =>
      handleOperation({
        type: "bulkPatchItems",
        input: {
          collectionId: collection.id,
          updates: [
            { id: item1.id, patch: { Status: "Updated" } },
            { id: 999_999, patch: { Status: "Broken" } },
          ],
        },
      }),
    ).toThrow();

    const itemsAfterFailure = getRawItems(collection.id);
    const item1AfterFailure = itemsAfterFailure.find((item) => item.id === item1.id);
    const item2AfterFailure = itemsAfterFailure.find((item) => item.id === item2.id);

    expect(item1AfterFailure).toBeDefined();
    expect(item2AfterFailure).toBeDefined();
    expect(JSON.parse(item1AfterFailure!.data)).toEqual({
      Title: "Original",
      Status: "New",
    });
    expect(JSON.parse(item2AfterFailure!.data)).toEqual({
      Title: "Second",
      Status: "New",
    });
  });
});
