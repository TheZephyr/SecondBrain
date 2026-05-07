import { z } from "zod";
import { isSafeFieldName, normalizeFieldName } from "./fieldNames";

export const collectionNameSchema = z.string().trim().min(1).max(80);
export const viewNameSchema = z.string().trim().min(1).max(80);

export const fieldNameSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (!isSafeFieldName(value)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Field name must be 1-64 chars, use letters/numbers/spaces/_/-, and avoid dots or reserved names.",
      });
    }
  })
  .transform((value) => normalizeFieldName(value));

export const fieldDescriptionSchema = z
  .union([z.string().max(2000), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

export const positiveIntSchema = z.number().int().positive();
export const orderIndexSchema = z.number().int().min(0);
export const nonNegativeIntSchema = z.number().int().min(0);
export const backupRetentionSchema = z.number().int().min(0).max(999);
export const viewTypeSchema = z.enum(["grid", "kanban", "calendar"]);
export const viewIsDefaultSchema = z.union([z.literal(0), z.literal(1)]);
export const viewOrderSchema = nonNegativeIntSchema;
export const backupLabelSchema = z.enum(["startup", "manual", "pre_restore"]);
export const backupFileNameSchema = z
  .string()
  .regex(
    /^secondbrain_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(startup|manual|pre_restore)\.db$/,
    "Invalid backup file name.",
  );
export const fieldTypeSchema = z.enum([
  "text",
  "longtext",
  "number",
  "date",
  "select",
  "multiselect",
  "boolean",
  "url",
  "rating",
]);
export const MAX_BULK_DELETE_IDS = 1000;
export const MAX_BULK_PATCH_UPDATES = 500;

export const itemSortFieldSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!value.startsWith("data.")) {
      ctx.addIssue({
        code: "custom",
        message: "Sort field must start with data.",
      });
      return;
    }

    const fieldName = value.slice(5);
    if (!isSafeFieldName(fieldName)) {
      ctx.addIssue({
        code: "custom",
        message: "Sort field must target a safe field name.",
      });
    }
  });

export const ItemSortSpecSchema = z.object({
  field: itemSortFieldSchema,
  order: z.union([z.literal(1), z.literal(-1)]),
  emptyPlacement: z.enum(["first", "last"]).optional().default("last"),
});

export const viewConfigColumnKeySchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Column width key must be a positive integer field ID.");

export const ViewConfigSchema = z.object({
  columnWidths: z.record(viewConfigColumnKeySchema, z.number().int().min(60)),
  sort: z.array(ItemSortSpecSchema),
  cardTitleFieldId: positiveIntSchema.optional(),
  calendarDateField: z.string().trim().min(1).max(64).optional(),
  calendarDateFieldId: positiveIntSchema.optional(),
  groupingFieldId: positiveIntSchema.optional(),
  kanbanColumnOrder: z
    .array(z.string().trim().min(1))
    .superRefine((value, ctx) => {
      const trimmed = value.map((entry) => entry.trim());
      const unique = new Set(trimmed);
      if (unique.size !== trimmed.length) {
        ctx.addIssue({
          code: "custom",
          message: "Kanban column order must contain unique values.",
          path: ["kanbanColumnOrder"],
        });
      }
    })
    .optional(),
  selectedFieldIds: z.array(positiveIntSchema).default([]),
});

export const itemDataValueSchema = z.union([
  z.string(),
  z
    .number()
    .refine((n) => Number.isFinite(n), { message: "Number must be finite" }),
  z.null(),
]);

export const itemDataSchema = z.preprocess(
  (value, ctx) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Item data must be a plain object.",
      });
      return value;
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Item data must not use a custom prototype.",
      });
    }

    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!isSafeFieldName(key)) {
        ctx.addIssue({
          code: "custom",
          message: `Unsafe field name: ${key}`,
          path: [key],
        });
      }
    }

    return value;
  },
  z.record(z.string(), itemDataValueSchema),
);

export const NewCollectionInputSchema = z.object({
  name: collectionNameSchema,
  icon: z.string().optional().nullable(),
});

export const NewViewInputSchema = z.object({
  collectionId: positiveIntSchema,
  name: viewNameSchema,
  type: viewTypeSchema.optional().default("grid"),
  isDefault: viewIsDefaultSchema.optional().default(0),
  order: viewOrderSchema.optional(),
});

export const UpdateViewInputSchema = z.object({
  id: positiveIntSchema,
  name: viewNameSchema,
});

export const UpdateViewConfigInputSchema = z.object({
  viewId: positiveIntSchema,
  config: ViewConfigSchema,
});

export const UpdateCollectionInputSchema = z.object({
  id: positiveIntSchema,
  name: collectionNameSchema,
  icon: z.string().optional().nullable(),
});

export const NewFieldInputSchema = z.object({
  collectionId: positiveIntSchema,
  name: fieldNameSchema,
  type: fieldTypeSchema,
  description: fieldDescriptionSchema.optional(),
  options: z.string().nullable(),
  orderIndex: orderIndexSchema.optional(),
});

export const UpdateFieldInputSchema = z.object({
  id: positiveIntSchema,
  name: fieldNameSchema,
  type: fieldTypeSchema,
  description: fieldDescriptionSchema.optional(),
  options: z.string().nullable(),
  orderIndex: orderIndexSchema.optional(),
});

export const FieldConversionInputSchema = z.object({
  fieldId: positiveIntSchema,
  targetType: fieldTypeSchema,
  targetOptions: z.string().nullable(),
});

export const GetNumberFieldRangeInputSchema = z.object({
  collectionId: positiveIntSchema,
  fieldName: fieldNameSchema,
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
        code: "custom",
        message: "Field order updates must contain unique field IDs.",
        path: ["fieldOrders"],
      });
    }

    const orderIndexes = value.fieldOrders.map((entry) => entry.orderIndex);
    const uniqueOrderIndexes = new Set(orderIndexes);
    if (uniqueOrderIndexes.size !== orderIndexes.length) {
      ctx.addIssue({
        code: "custom",
        message: "Field order updates must contain unique order indices.",
        path: ["fieldOrders"],
      });
      return;
    }

    const sorted = [...orderIndexes].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i) {
        ctx.addIssue({
          code: "custom",
          message:
            "Field order indices must be contiguous and start at 0 (0..n-1).",
          path: ["fieldOrders"],
        });
        break;
      }
    }
  });

export const ViewOrderUpdateSchema = z.object({
  id: positiveIntSchema,
  order: z.number().int().min(1),
});

export const ReorderViewsInputSchema = z
  .object({
    collectionId: positiveIntSchema,
    viewOrders: z.array(ViewOrderUpdateSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const ids = value.viewOrders.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "View order updates must contain unique view IDs.",
        path: ["viewOrders"],
      });
    }

    const orders = value.viewOrders.map((entry) => entry.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      ctx.addIssue({
        code: "custom",
        message: "View order updates must contain unique order indices.",
        path: ["viewOrders"],
      });
      return;
    }

    const sorted = [...orders].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        ctx.addIssue({
          code: "custom",
          message:
            "View order indices must be contiguous and start at 1 (1..n).",
          path: ["viewOrders"],
        });
        break;
      }
    }
  });

export const ItemOrderUpdateSchema = z.object({
  id: positiveIntSchema,
  order: nonNegativeIntSchema,
});

export const ReorderItemsInputSchema = z
  .object({
    collectionId: positiveIntSchema,
    itemOrders: z.array(ItemOrderUpdateSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const ids = value.itemOrders.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Item reorder payload must contain unique item IDs.",
        path: ["itemOrders"],
      });
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
        code: "custom",
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
        code: "custom",
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
          code: "custom",
          message: "Field collectionId must match import collectionId.",
          path: ["newFields", index, "collectionId"],
        });
      }
    });

    value.items.forEach((item, index) => {
      if (item.collectionId !== value.collectionId) {
        ctx.addIssue({
          code: "custom",
          message: "Item collectionId must match import collectionId.",
          path: ["items", index, "collectionId"],
        });
      }
    });
  });

export const GetItemsInputSchema = z.object({
  collectionId: positiveIntSchema,
  limit: z.number().int().min(1).max(200).default(50),
  offset: nonNegativeIntSchema.default(0),
  search: z.string().trim().max(200).optional().default(""),
  sort: z.array(ItemSortSpecSchema).optional().default([]),
});

export const UpdateBackupSettingsInputSchema = z.object({
  automaticBackupsEnabled: z.boolean(),
  automaticBackupsLimit: backupRetentionSchema,
  manualBackupsLimit: backupRetentionSchema,
});

export const FULL_ARCHIVE_VERSION = 1;

export const fullArchiveTypeSchema = z.literal("full_archive");
export const archiveFilePathSchema = z.string().trim().min(1);

export const FullArchiveExportInputSchema = z.object({
  description: z.string().max(5000).default(""),
});

export const fullArchiveItemValueSchema = z.union([
  z.string(),
  z
    .number()
    .refine((n) => Number.isFinite(n), { message: "Number must be finite" }),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);

export const fullArchiveItemDataSchema = z.preprocess(
  (value, ctx) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Archive item data must be a plain object.",
      });
      return value;
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Archive item data must not use a custom prototype.",
      });
    }

    return value;
  },
  z.record(z.string(), fullArchiveItemValueSchema),
);

export const FullArchiveFieldSchema = z
  .object({
    name: z.string().trim().min(1).max(256),
    type: z.string().trim().min(1).max(64),
    orderIndex: orderIndexSchema,
    options: z.record(z.string(), z.unknown()).nullable(),
  })
  .passthrough();

export const FullArchiveSortSpecSchema = z.object({
  field: z.string().trim().min(1).max(256),
  order: z.union([z.literal(1), z.literal(-1)]),
  emptyPlacement: z.enum(["first", "last"]).optional().default("last"),
});

export const FullArchiveGridViewConfigSchema = z
  .object({
    columnWidths: z.record(z.string(), z.number().int().min(60)),
    sort: z.array(FullArchiveSortSpecSchema),
    selectedFields: z.array(z.string().trim().min(1)),
  })
  .passthrough();

export const FullArchiveKanbanViewConfigSchema = z
  .object({
    cardTitleField: z.string().trim().min(1).nullable().optional(),
    groupingField: z.string().trim().min(1).nullable(),
    columnOrder: z.array(z.string().trim().min(1)),
    selectedFields: z.array(z.string().trim().min(1)),
  })
  .passthrough();

export const FullArchiveCalendarViewConfigSchema = z
  .object({
    dateField: z.string().trim().min(1).nullable(),
    selectedFields: z.array(z.string().trim().min(1)),
  })
  .passthrough();

export const FullArchiveViewSchema = z
  .object({
    name: z.string().trim().min(1).max(256),
    type: z.string().trim().min(1).max(64),
    isDefault: z.boolean(),
    order: nonNegativeIntSchema,
    config: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export const FullArchiveItemSchema = z
  .object({
    order: nonNegativeIntSchema,
    data: fullArchiveItemDataSchema,
  })
  .passthrough();

export const FullArchiveCollectionStatsSchema = z
  .object({
    fieldCount: nonNegativeIntSchema,
    itemCount: nonNegativeIntSchema,
  })
  .passthrough();

export const FullArchiveCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(256),
    exportedAt: z.string().trim().min(1),
    stats: FullArchiveCollectionStatsSchema,
    fields: z.array(FullArchiveFieldSchema),
    views: z.array(FullArchiveViewSchema),
    items: z.array(FullArchiveItemSchema),
  })
  .passthrough();

export const FullArchiveStatsSchema = z
  .object({
    collectionCount: nonNegativeIntSchema,
    totalFieldCount: nonNegativeIntSchema,
    totalItemCount: nonNegativeIntSchema,
  })
  .passthrough();

export const FullArchiveFileSchema = z
  .object({
    type: fullArchiveTypeSchema,
    version: z.number().int().min(1),
    appVersion: z.string().trim().min(1),
    exportedAt: z.string().trim().min(1),
    description: z.string(),
    stats: FullArchiveStatsSchema,
    collections: z.array(FullArchiveCollectionSchema),
  })
  .passthrough();
