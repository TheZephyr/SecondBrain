import { describe, it, expect } from "vitest";
import {
  BulkDeleteItemsInputSchema,
  BulkPatchItemsInputSchema,
  GetItemsInputSchema,
  ImportCollectionInputSchema,
  NewFieldInputSchema,
  ReorderFieldsInputSchema,
  ReorderViewsInputSchema,
  UpdateViewConfigInputSchema,
  ViewConfigSchema,
  itemDataSchema,
} from "../schemas";

describe("validation schemas", () => {
  it("rejects invalid field names", () => {
    const result = NewFieldInputSchema.safeParse({
      collectionId: 1,
      name: "bad.name",
      type: "text",
      options: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unsafe keys in item data", () => {
    const data = Object.create(null) as Record<string, unknown>;
    data["__proto__"] = "bad";
    const result = itemDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects non-primitive item values", () => {
    const objectResult = itemDataSchema.safeParse({
      Title: { nested: true },
    });
    const arrayResult = itemDataSchema.safeParse({
      Title: [1, 2, 3],
    });

    expect(objectResult.success).toBe(false);
    expect(arrayResult.success).toBe(false);
  });

  it("accepts valid import payloads", () => {
    const result = ImportCollectionInputSchema.safeParse({
      collectionId: 1,
      mode: "append",
      newFields: [
        {
          collectionId: 1,
          name: "Title",
          type: "text",
          options: null,
          orderIndex: 0,
        },
      ],
      items: [
        {
          collectionId: 1,
          data: { Title: "Hello" },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects import payloads with mismatched field collectionId", () => {
    const result = ImportCollectionInputSchema.safeParse({
      collectionId: 1,
      mode: "append",
      newFields: [
        {
          collectionId: 2,
          name: "Title",
          type: "text",
          options: null,
          orderIndex: 0,
        },
      ],
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects import payloads with mismatched item collectionId", () => {
    const result = ImportCollectionInputSchema.safeParse({
      collectionId: 1,
      mode: "replace",
      newFields: [],
      items: [
        {
          collectionId: 2,
          data: { Title: "Hello" },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("applies defaults for paginated getItems input", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
      expect(result.data.search).toBe("");
      expect(result.data.sort).toEqual([]);
    }
  });

  it("accepts limit of 200 for getItems input", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      limit: 200,
      offset: 0,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid paginated getItems input", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      limit: 0,
      offset: -1,
      sort: [{ field: "created_at", order: 2 }],
    });

    expect(result.success).toBe(false);
  });

  it("trims search and accepts valid sort fields for getItems input", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      search: "  hello world  ",
      sort: [{ field: "data.Title", order: -1 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBe("hello world");
      expect(result.data.sort).toEqual([{ field: "data.Title", order: -1 }]);
    }
  });

  it("accepts valid reorder fields payload", () => {
    const result = ReorderFieldsInputSchema.safeParse({
      collectionId: 1,
      fieldOrders: [
        { id: 10, orderIndex: 0 },
        { id: 11, orderIndex: 1 },
        { id: 12, orderIndex: 2 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects reorder fields payload with duplicate field IDs", () => {
    const result = ReorderFieldsInputSchema.safeParse({
      collectionId: 1,
      fieldOrders: [
        { id: 10, orderIndex: 0 },
        { id: 10, orderIndex: 1 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects reorder fields payload with non-contiguous order indices", () => {
    const result = ReorderFieldsInputSchema.safeParse({
      collectionId: 1,
      fieldOrders: [
        { id: 10, orderIndex: 0 },
        { id: 11, orderIndex: 2 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects bulk delete payload with duplicate item IDs", () => {
    const result = BulkDeleteItemsInputSchema.safeParse({
      collectionId: 1,
      itemIds: [1, 1, 2],
    });

    expect(result.success).toBe(false);
  });

  it("rejects bulk patch payload with duplicate item IDs", () => {
    const result = BulkPatchItemsInputSchema.safeParse({
      collectionId: 1,
      updates: [
        { id: 1, patch: { Title: "A" } },
        { id: 1, patch: { Title: "B" } },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects bulk patch payload with empty patch object", () => {
    const result = BulkPatchItemsInputSchema.safeParse({
      collectionId: 1,
      updates: [
        { id: 1, patch: {} },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid view config", () => {
    const result = ViewConfigSchema.safeParse({
      columnWidths: {
        1: 120,
        9: 300,
      },
      sort: [
        { field: "data.Title", order: 1 },
        { field: "data.Year", order: -1 },
      ],
      calendarDateFieldId: 7,
      selectedFieldIds: [1, 3, 5],
    });

    expect(result.success).toBe(true);
  });

  it("rejects view config with invalid column width", () => {
    const result = ViewConfigSchema.safeParse({
      columnWidths: {
        1: 59,
      },
      sort: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid update view config payload", () => {
    const result = UpdateViewConfigInputSchema.safeParse({
      viewId: 0,
      config: {
        columnWidths: {
          bad: 120,
        },
        sort: [{ field: "Title", order: 1 }],
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid reorder views payload", () => {
    const result = ReorderViewsInputSchema.safeParse({
      collectionId: 3,
      viewOrders: [
        { id: 10, order: 1 },
        { id: 11, order: 2 },
      ],
    });

    expect(result.success).toBe(true);
  });
});
