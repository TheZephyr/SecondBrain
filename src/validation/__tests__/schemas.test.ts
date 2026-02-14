import { describe, it, expect } from "vitest";
import {
  GetItemsInputSchema,
  ImportCollectionInputSchema,
  NewFieldInputSchema,
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
});
