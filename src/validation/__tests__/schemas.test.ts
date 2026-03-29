import { describe, it, expect } from "vitest";
import {
  backupRetentionSchema,
  backupLabelSchema,
  backupFileNameSchema,
  itemSortFieldSchema,
  ItemSortSpecSchema,
  viewConfigColumnKeySchema,
  BulkDeleteItemsInputSchema,
  BulkPatchItemsInputSchema,
  GetItemsInputSchema,
  ImportCollectionInputSchema,
  NewFieldInputSchema,
  ReorderFieldsInputSchema,
  ReorderItemsInputSchema,
  ReorderViewsInputSchema,
  UpdateFieldInputSchema,
  UpdateViewConfigInputSchema,
  ViewConfigSchema,
  itemDataSchema,
  FullArchiveExportInputSchema,
  fullArchiveItemValueSchema,
  fullArchiveItemDataSchema,
  fieldNameSchema,
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

  it("accepts all new field types in NewFieldInputSchema", () => {
    const types = [
      "text",
      "longtext",
      "number",
      "date",
      "select",
      "multiselect",
      "boolean",
      "url",
      "rating",
    ] as const;

    for (const type of types) {
      const result = NewFieldInputSchema.safeParse({
        collectionId: 1,
        name: "Field",
        type,
        options: null,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects textarea in NewFieldInputSchema", () => {
    const result = NewFieldInputSchema.safeParse({
      collectionId: 1,
      name: "Legacy",
      type: "textarea",
      options: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all new field types in UpdateFieldInputSchema", () => {
    const types = [
      "text",
      "longtext",
      "number",
      "date",
      "select",
      "multiselect",
      "boolean",
      "url",
      "rating",
    ] as const;

    for (const type of types) {
      const result = UpdateFieldInputSchema.safeParse({
        id: 1,
        name: "Field",
        type,
        options: null,
      });
      expect(result.success).toBe(true);
    }
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
      groupingFieldId: 5,
      kanbanColumnOrder: ["Todo", "In Progress"],
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

  it("accepts valid reorder items payload", () => {
    const result = ReorderItemsInputSchema.safeParse({
      collectionId: 4,
      itemOrders: [
        { id: 100, order: 0 },
        { id: 101, order: 1 },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("fieldNameSchema", () => {
  it("transforms valid field name via normalizeFieldName", () => {
    const result = fieldNameSchema.safeParse("ValidName");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("ValidName");
    }
  });

  it("rejects field name that is unsafe", () => {
    const result = fieldNameSchema.safeParse("bad.name");
    expect(result.success).toBe(false);
  });
});

describe("backupRetentionSchema", () => {
  it("accepts 0", () => {
    expect(backupRetentionSchema.safeParse(0).success).toBe(true);
  });

  it("accepts max value 999", () => {
    expect(backupRetentionSchema.safeParse(999).success).toBe(true);
  });

  it("accepts a typical value", () => {
    expect(backupRetentionSchema.safeParse(10).success).toBe(true);
  });

  it("rejects negative values", () => {
    expect(backupRetentionSchema.safeParse(-1).success).toBe(false);
  });

  it("rejects values above 999", () => {
    expect(backupRetentionSchema.safeParse(1000).success).toBe(false);
  });

  it("rejects non-integer values", () => {
    expect(backupRetentionSchema.safeParse(1.5).success).toBe(false);
  });
});

describe("backupLabelSchema", () => {
  it("accepts startup", () => {
    expect(backupLabelSchema.safeParse("startup").success).toBe(true);
  });

  it("accepts manual", () => {
    expect(backupLabelSchema.safeParse("manual").success).toBe(true);
  });

  it("accepts pre_restore", () => {
    expect(backupLabelSchema.safeParse("pre_restore").success).toBe(true);
  });

  it("rejects unknown label", () => {
    expect(backupLabelSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("backupFileNameSchema", () => {
  it("accepts a valid startup backup filename", () => {
    expect(
      backupFileNameSchema.safeParse(
        "secondbrain_2026-03-28_10-30-00_startup.db",
      ).success,
    ).toBe(true);
  });

  it("accepts a valid manual backup filename", () => {
    expect(
      backupFileNameSchema.safeParse(
        "secondbrain_2026-03-28_10-30-00_manual.db",
      ).success,
    ).toBe(true);
  });

  it("accepts a valid pre_restore backup filename", () => {
    expect(
      backupFileNameSchema.safeParse(
        "secondbrain_2026-03-28_10-30-00_pre_restore.db",
      ).success,
    ).toBe(true);
  });

  it("rejects a filename with wrong prefix", () => {
    expect(
      backupFileNameSchema.safeParse(
        "wrongprefix_2026-03-28_10-30-00_startup.db",
      ).success,
    ).toBe(false);
  });

  it("rejects a filename with wrong extension", () => {
    expect(
      backupFileNameSchema.safeParse(
        "secondbrain_2026-03-28_10-30-00_startup.json",
      ).success,
    ).toBe(false);
  });

  it("rejects a filename with unknown label", () => {
    expect(
      backupFileNameSchema.safeParse(
        "secondbrain_2026-03-28_10-30-00_unknown.db",
      ).success,
    ).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(backupFileNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects a filename with malformed date segment", () => {
    expect(
      backupFileNameSchema.safeParse("secondbrain_26-3-28_10-30-00_startup.db")
        .success,
    ).toBe(false);
  });
});

describe("itemSortFieldSchema", () => {
  it("accepts a valid sort field", () => {
    expect(itemSortFieldSchema.safeParse("data.Title").success).toBe(true);
  });

  it("rejects a field that does not start with data.", () => {
    expect(itemSortFieldSchema.safeParse("Title").success).toBe(false);
  });

  it("rejects a field with data. prefix but unsafe field name", () => {
    expect(itemSortFieldSchema.safeParse("data.bad.name").success).toBe(false);
  });

  it("rejects a field with data. prefix but reserved field name", () => {
    expect(itemSortFieldSchema.safeParse("data.__proto__").success).toBe(false);
  });
});

describe("ItemSortSpecSchema", () => {
  it("accepts order 1", () => {
    expect(
      ItemSortSpecSchema.safeParse({ field: "data.Title", order: 1 }).success,
    ).toBe(true);
  });

  it("accepts order -1", () => {
    expect(
      ItemSortSpecSchema.safeParse({ field: "data.Title", order: -1 }).success,
    ).toBe(true);
  });

  it("rejects order 0", () => {
    expect(
      ItemSortSpecSchema.safeParse({ field: "data.Title", order: 0 }).success,
    ).toBe(false);
  });

  it("rejects order 2", () => {
    expect(
      ItemSortSpecSchema.safeParse({ field: "data.Title", order: 2 }).success,
    ).toBe(false);
  });
});

describe("viewConfigColumnKeySchema", () => {
  it("accepts a positive integer string", () => {
    expect(viewConfigColumnKeySchema.safeParse("1").success).toBe(true);
    expect(viewConfigColumnKeySchema.safeParse("42").success).toBe(true);
  });

  it("rejects zero", () => {
    expect(viewConfigColumnKeySchema.safeParse("0").success).toBe(false);
  });

  it("rejects a non-numeric string", () => {
    expect(viewConfigColumnKeySchema.safeParse("abc").success).toBe(false);
  });

  it("rejects a negative number string", () => {
    expect(viewConfigColumnKeySchema.safeParse("-1").success).toBe(false);
  });
});

describe("ViewConfigSchema", () => {
  it("defaults selectedFieldIds to empty array when omitted", () => {
    const result = ViewConfigSchema.safeParse({
      columnWidths: {},
      sort: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedFieldIds).toEqual([]);
    }
  });

  it("rejects duplicate values in kanbanColumnOrder", () => {
    const result = ViewConfigSchema.safeParse({
      columnWidths: {},
      sort: [],
      kanbanColumnOrder: ["Todo", "Todo", "Done"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid kanbanColumnOrder without duplicates", () => {
    const result = ViewConfigSchema.safeParse({
      columnWidths: {},
      sort: [],
      kanbanColumnOrder: ["Todo", "In Progress", "Done"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects column width below minimum of 60", () => {
    const result = ViewConfigSchema.safeParse({
      columnWidths: { 1: 59 },
      sort: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts column width exactly at 60", () => {
    const result = ViewConfigSchema.safeParse({
      columnWidths: { 1: 60 },
      sort: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("ReorderFieldsInputSchema - duplicate orderIndex", () => {
  it("rejects payload with duplicate order indices (triggers early return)", () => {
    const result = ReorderFieldsInputSchema.safeParse({
      collectionId: 1,
      fieldOrders: [
        { id: 10, orderIndex: 0 },
        { id: 11, orderIndex: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with duplicate field IDs regardless of order indices", () => {
    const result = ReorderFieldsInputSchema.safeParse({
      collectionId: 1,
      fieldOrders: [
        { id: 10, orderIndex: 0 },
        { id: 10, orderIndex: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with non-contiguous starting at non-zero", () => {
    const result = ReorderFieldsInputSchema.safeParse({
      collectionId: 1,
      fieldOrders: [
        { id: 10, orderIndex: 1 },
        { id: 11, orderIndex: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid single-entry payload", () => {
    const result = ReorderFieldsInputSchema.safeParse({
      collectionId: 1,
      fieldOrders: [{ id: 10, orderIndex: 0 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("ReorderViewsInputSchema - duplicate and non-contiguous orders", () => {
  it("rejects payload with duplicate order values (triggers early return)", () => {
    const result = ReorderViewsInputSchema.safeParse({
      collectionId: 1,
      viewOrders: [
        { id: 10, order: 1 },
        { id: 11, order: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with duplicate view IDs", () => {
    const result = ReorderViewsInputSchema.safeParse({
      collectionId: 1,
      viewOrders: [
        { id: 10, order: 1 },
        { id: 10, order: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with non-contiguous orders not starting at 1", () => {
    const result = ReorderViewsInputSchema.safeParse({
      collectionId: 1,
      viewOrders: [
        { id: 10, order: 2 },
        { id: 11, order: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects payload with order 0 (views must start at 1)", () => {
    const result = ReorderViewsInputSchema.safeParse({
      collectionId: 1,
      viewOrders: [{ id: 10, order: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid single view reorder starting at 1", () => {
    const result = ReorderViewsInputSchema.safeParse({
      collectionId: 1,
      viewOrders: [{ id: 10, order: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("ReorderItemsInputSchema", () => {
  it("rejects payload with duplicate item IDs", () => {
    const result = ReorderItemsInputSchema.safeParse({
      collectionId: 1,
      itemOrders: [
        { id: 1, order: 0 },
        { id: 1, order: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid reorder payload", () => {
    const result = ReorderItemsInputSchema.safeParse({
      collectionId: 1,
      itemOrders: [
        { id: 1, order: 0 },
        { id: 2, order: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty itemOrders", () => {
    const result = ReorderItemsInputSchema.safeParse({
      collectionId: 1,
      itemOrders: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("BulkDeleteItemsInputSchema", () => {
  it("rejects empty itemIds array", () => {
    const result = BulkDeleteItemsInputSchema.safeParse({
      collectionId: 1,
      itemIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts array at the max boundary of 1000", () => {
    const result = BulkDeleteItemsInputSchema.safeParse({
      collectionId: 1,
      itemIds: Array.from({ length: 1000 }, (_, i) => i + 1),
    });
    expect(result.success).toBe(true);
  });

  it("rejects array exceeding the max of 1000", () => {
    const result = BulkDeleteItemsInputSchema.safeParse({
      collectionId: 1,
      itemIds: Array.from({ length: 1001 }, (_, i) => i + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("BulkPatchItemsInputSchema", () => {
  it("accepts a valid batch at the max boundary of 500", () => {
    const result = BulkPatchItemsInputSchema.safeParse({
      collectionId: 1,
      updates: Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        patch: { Title: "X" },
      })),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a batch exceeding the max of 500", () => {
    const result = BulkPatchItemsInputSchema.safeParse({
      collectionId: 1,
      updates: Array.from({ length: 501 }, (_, i) => ({
        id: i + 1,
        patch: { Title: "X" },
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty updates array", () => {
    const result = BulkPatchItemsInputSchema.safeParse({
      collectionId: 1,
      updates: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("GetItemsInputSchema", () => {
  it("rejects limit above 200", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      limit: 201,
    });
    expect(result.success).toBe(false);
  });

  it("rejects search string exceeding 200 characters", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      search: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 sort entries", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      sort: [
        { field: "data.Title", order: 1 },
        { field: "data.Author", order: 1 },
        { field: "data.Year", order: 1 },
        { field: "data.Genre", order: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 3 sort entries", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      sort: [
        { field: "data.Title", order: 1 },
        { field: "data.Author", order: -1 },
        { field: "data.Year", order: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative offset", () => {
    const result = GetItemsInputSchema.safeParse({
      collectionId: 1,
      offset: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("ImportCollectionInputSchema - additional branches", () => {
  it("accepts a replace mode payload", () => {
    const result = ImportCollectionInputSchema.safeParse({
      collectionId: 1,
      mode: "replace",
      newFields: [],
      items: [{ collectionId: 1, data: { Title: "X" } }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown import mode", () => {
    const result = ImportCollectionInputSchema.safeParse({
      collectionId: 1,
      mode: "upsert",
      newFields: [],
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects when both field and item collectionIds mismatch", () => {
    const result = ImportCollectionInputSchema.safeParse({
      collectionId: 1,
      mode: "append",
      newFields: [
        { collectionId: 2, name: "Title", type: "text", options: null },
      ],
      items: [{ collectionId: 2, data: { Title: "X" } }],
    });
    expect(result.success).toBe(false);
  });
});

describe("FullArchiveExportInputSchema", () => {
  it("accepts an empty description", () => {
    const result = FullArchiveExportInputSchema.safeParse({ description: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a non-empty description", () => {
    const result = FullArchiveExportInputSchema.safeParse({
      description: "Monthly backup",
    });
    expect(result.success).toBe(true);
  });

  it("defaults description to empty string when omitted", () => {
    const result = FullArchiveExportInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("rejects description exceeding 5000 characters", () => {
    const result = FullArchiveExportInputSchema.safeParse({
      description: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description at exactly 5000 characters", () => {
    const result = FullArchiveExportInputSchema.safeParse({
      description: "a".repeat(5000),
    });
    expect(result.success).toBe(true);
  });
});

describe("fullArchiveItemValueSchema", () => {
  it("accepts a string value", () => {
    expect(fullArchiveItemValueSchema.safeParse("hello").success).toBe(true);
  });

  it("accepts a finite number", () => {
    expect(fullArchiveItemValueSchema.safeParse(42).success).toBe(true);
  });

  it("accepts a boolean", () => {
    expect(fullArchiveItemValueSchema.safeParse(true).success).toBe(true);
    expect(fullArchiveItemValueSchema.safeParse(false).success).toBe(true);
  });

  it("accepts null", () => {
    expect(fullArchiveItemValueSchema.safeParse(null).success).toBe(true);
  });

  it("accepts an array of strings", () => {
    expect(fullArchiveItemValueSchema.safeParse(["a", "b"]).success).toBe(true);
  });

  it("rejects a non-finite number", () => {
    expect(fullArchiveItemValueSchema.safeParse(Infinity).success).toBe(false);
    expect(fullArchiveItemValueSchema.safeParse(NaN).success).toBe(false);
  });

  it("rejects a plain object", () => {
    expect(fullArchiveItemValueSchema.safeParse({ a: 1 }).success).toBe(false);
  });
});

describe("fullArchiveItemDataSchema", () => {
  it("accepts a valid plain object", () => {
    const result = fullArchiveItemDataSchema.safeParse({
      Title: "Dune",
      Rating: 5,
      Done: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-object value (array)", () => {
    expect(fullArchiveItemDataSchema.safeParse([1, 2, 3]).success).toBe(false);
  });

  it("rejects null", () => {
    expect(fullArchiveItemDataSchema.safeParse(null).success).toBe(false);
  });

  it("rejects a primitive", () => {
    expect(fullArchiveItemDataSchema.safeParse("string").success).toBe(false);
  });

  it("rejects an object with a custom prototype", () => {
    class CustomProto {}
    expect(fullArchiveItemDataSchema.safeParse(new CustomProto()).success).toBe(
      false,
    );
  });

  it("accepts an empty object", () => {
    expect(fullArchiveItemDataSchema.safeParse({}).success).toBe(true);
  });
});
