import { z } from "zod";
import { isSafeFieldName, normalizeFieldName } from "./fieldNames";

export const collectionNameSchema = z.string().trim().min(1).max(80);
export const viewNameSchema = z.string().trim().min(1).max(80);

export const fieldNameSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (!isSafeFieldName(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Field name must be 1-64 chars, use letters/numbers/spaces/_/-, and avoid dots or reserved names.",
      });
    }
  })
  .transform((value) => normalizeFieldName(value));

export const positiveIntSchema = z.number().int().positive();
export const orderIndexSchema = z.number().int().min(0);
export const nonNegativeIntSchema = z.number().int().min(0);
export const viewTypeSchema = z.enum(["grid"]);
export const viewIsDefaultSchema = z.union([z.literal(0), z.literal(1)]);
export const viewOrderSchema = nonNegativeIntSchema;
export const MAX_BULK_DELETE_IDS = 1000;
export const MAX_BULK_PATCH_UPDATES = 500;

export const itemSortFieldSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!value.startsWith("data.")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sort field must start with data.",
      });
      return;
    }

    const fieldName = value.slice(5);
    if (!isSafeFieldName(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sort field must target a safe field name.",
      });
    }
  });

export const ItemSortSpecSchema = z.object({
  field: itemSortFieldSchema,
  order: z.union([z.literal(1), z.literal(-1)]),
});

export const itemDataValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.null(),
]);

export const itemDataSchema = z.preprocess((value, ctx) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Item data must be a plain object.",
    });
    return value;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Item data must not use a custom prototype.",
    });
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!isSafeFieldName(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsafe field name: ${key}`,
        path: [key],
      });
    }
  }

  return value;
}, z.record(z.string(), itemDataValueSchema));

export const NewCollectionInputSchema = z.object({
  name: collectionNameSchema
});

export const NewViewInputSchema = z.object({
  collectionId: positiveIntSchema,
  name: viewNameSchema,
  type: viewTypeSchema.optional().default("grid"),
  isDefault: viewIsDefaultSchema.optional().default(0),
  order: viewOrderSchema.optional(),
});

export const UpdateCollectionInputSchema = z.object({
  id: positiveIntSchema,
  name: collectionNameSchema
});

export const NewFieldInputSchema = z.object({
  collectionId: positiveIntSchema,
  name: fieldNameSchema,
  type: z.enum(["text", "textarea", "number", "date", "select"]),
  options: z.string().nullable(),
  orderIndex: orderIndexSchema.optional(),
});

export const UpdateFieldInputSchema = z.object({
  id: positiveIntSchema,
  name: fieldNameSchema,
  type: z.enum(["text", "textarea", "number", "date", "select"]),
  options: z.string().nullable(),
  orderIndex: orderIndexSchema.optional(),
});

export const FieldOrderUpdateSchema = z.object({
  id: positiveIntSchema,
  orderIndex: orderIndexSchema,
});

export const ReorderFieldsInputSchema = z
  .object({
    collectionId: positiveIntSchema,
    fieldOrders: z.array(FieldOrderUpdateSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const ids = value.fieldOrders.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Field order updates must contain unique field IDs.",
        path: ["fieldOrders"],
      });
    }

    const orderIndexes = value.fieldOrders.map((entry) => entry.orderIndex);
    const uniqueOrderIndexes = new Set(orderIndexes);
    if (uniqueOrderIndexes.size !== orderIndexes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Field order updates must contain unique order indices.",
        path: ["fieldOrders"],
      });
      return;
    }

    const sorted = [...orderIndexes].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Field order indices must be contiguous and start at 0 (0..n-1).",
          path: ["fieldOrders"],
        });
        break;
      }
    }
  });

export const NewItemInputSchema = z.object({
  collectionId: positiveIntSchema,
  data: itemDataSchema,
});

export const UpdateItemInputSchema = z.object({
  id: positiveIntSchema,
  data: itemDataSchema,
});

export const InsertItemAtInputSchema = z.object({
  collectionId: positiveIntSchema,
  afterOrder: z.union([nonNegativeIntSchema, z.null()]),
});

export const DuplicateItemInputSchema = z.object({
  collectionId: positiveIntSchema,
  itemId: positiveIntSchema,
});

export const MoveItemInputSchema = z.object({
  collectionId: positiveIntSchema,
  itemId: positiveIntSchema,
  direction: z.enum(["up", "down"]),
});

export const BulkDeleteItemsInputSchema = z
  .object({
    collectionId: positiveIntSchema,
    itemIds: z.array(positiveIntSchema).min(1).max(MAX_BULK_DELETE_IDS),
  })
  .superRefine((value, ctx) => {
    const uniqueIds = new Set(value.itemIds);
    if (uniqueIds.size !== value.itemIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bulk delete item IDs must be unique.",
        path: ["itemIds"],
      });
    }
  });

export const BulkPatchItemUpdateSchema = z.object({
  id: positiveIntSchema,
  patch: itemDataSchema.refine(
    (value) => Object.keys(value).length > 0,
    "Bulk patch item update must include at least one field.",
  ),
});

export const BulkPatchItemsInputSchema = z
  .object({
    collectionId: positiveIntSchema,
    updates: z
      .array(BulkPatchItemUpdateSchema)
      .min(1)
      .max(MAX_BULK_PATCH_UPDATES),
  })
  .superRefine((value, ctx) => {
    const ids = value.updates.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bulk patch updates must contain unique item IDs.",
        path: ["updates"],
      });
    }
  });

export const ImportCollectionInputSchema = z
  .object({
    collectionId: positiveIntSchema,
    mode: z.enum(["append", "replace"]),
    newFields: z.array(NewFieldInputSchema),
    items: z.array(NewItemInputSchema),
  })
  .superRefine((value, ctx) => {
    value.newFields.forEach((field, index) => {
      if (field.collectionId !== value.collectionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Field collectionId must match import collectionId.",
          path: ["newFields", index, "collectionId"],
        });
      }
    });

    value.items.forEach((item, index) => {
      if (item.collectionId !== value.collectionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Item collectionId must match import collectionId.",
          path: ["items", index, "collectionId"],
        });
      }
    });
  });

export const GetItemsInputSchema = z.object({
  collectionId: positiveIntSchema,
  limit: z.number().int().min(1).max(100).default(50),
  offset: nonNegativeIntSchema.default(0),
  search: z.string().trim().max(200).optional().default(""),
  sort: z.array(ItemSortSpecSchema).max(3).optional().default([]),
});
