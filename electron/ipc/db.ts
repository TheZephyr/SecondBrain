import { shell } from "electron";
import type {
  ItemData,
  GetItemsInput,
  NewCollectionInput,
  NewViewInput,
  UpdateViewInput,
  UpdateViewConfigInput,
  ReorderViewsInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  ReorderFieldsInput,
  NewItemInput,
  UpdateItemInput,
  InsertItemAtInput,
  DuplicateItemInput,
  MoveItemInput,
  BulkDeleteItemsInput,
  BulkPatchItemsInput,
  ImportCollectionInput,
  ReorderItemsInput,
} from "../../src/types/models";
import { AppError } from "../db/worker-manager";
import {
  NewCollectionInputSchema,
  NewViewInputSchema,
  UpdateViewInputSchema,
  UpdateViewConfigInputSchema,
  ReorderViewsInputSchema,
  UpdateCollectionInputSchema,
  NewFieldInputSchema,
  UpdateFieldInputSchema,
  ReorderFieldsInputSchema,
  NewItemInputSchema,
  UpdateItemInputSchema,
  InsertItemAtInputSchema,
  DuplicateItemInputSchema,
  MoveItemInputSchema,
  BulkDeleteItemsInputSchema,
  BulkPatchItemsInputSchema,
  ImportCollectionInputSchema,
  GetItemsInputSchema,
  itemDataSchema,
  ReorderItemsInputSchema,
  positiveIntSchema,
} from "../../src/validation/schemas";
import {
  invokeDbWorker,
  DB_BULK_TIMEOUT_MS,
  DB_IMPORT_TIMEOUT_MS,
} from "../db/worker-manager";
import fs from "fs";
import { parseOrThrow, handleIpc } from "./utils";

function parsePositiveInt(data: unknown, context: string): number {
  const parsed = positiveIntSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Invalid integer.",
      JSON.stringify({ context, issues: parsed.error.issues }),
    );
  }
  return parsed.data;
}

// ==================== COLLECTIONS ====================
handleIpc("db:getCollections", async () => {
  return invokeDbWorker({ type: "getCollections" });
});

handleIpc("db:getCollectionItemCounts", async () => {
  return invokeDbWorker({ type: "getCollectionItemCounts" });
});

handleIpc("db:addCollection", async (_, collection: NewCollectionInput) => {
  const input = parseOrThrow(
    NewCollectionInputSchema,
    collection,
    "db:addCollection",
  );

  return invokeDbWorker({ type: "addCollection", input });
});

handleIpc(
  "db:updateCollection",
  async (_, collection: UpdateCollectionInput) => {
    const input = parseOrThrow(
      UpdateCollectionInputSchema,
      collection,
      "db:updateCollection",
    );

    return invokeDbWorker({ type: "updateCollection", input });
  },
);

handleIpc("db:deleteCollection", async (_, id) => {
  const collectionId = parsePositiveInt(id, "db:deleteCollection");
  return invokeDbWorker({ type: "deleteCollection", id: collectionId });
});

// ==================== VIEWS ====================
handleIpc("db:getViews", async (_, collectionId: number) => {
  const parsedCollectionId = parsePositiveInt(collectionId, "db:getViews");
  return invokeDbWorker({ type: "getViews", collectionId: parsedCollectionId });
});

handleIpc("db:addView", async (_, view: NewViewInput) => {
  const input = parseOrThrow(NewViewInputSchema, view, "db:addView");
  return invokeDbWorker({ type: "addView", input });
});

handleIpc("db:updateView", async (_, view: UpdateViewInput) => {
  const input = parseOrThrow(UpdateViewInputSchema, view, "db:updateView");
  return invokeDbWorker({ type: "updateView", input });
});

handleIpc("db:deleteView", async (_, id) => {
  const viewId = parsePositiveInt(id, "db:deleteView");
  return invokeDbWorker({ type: "deleteView", id: viewId });
});

handleIpc("db:getViewConfig", async (_, viewId: number) => {
  const parsedViewId = parsePositiveInt(viewId, "db:getViewConfig");
  return invokeDbWorker({ type: "getViewConfig", viewId: parsedViewId });
});

handleIpc("db:updateViewConfig", async (_, payload: UpdateViewConfigInput) => {
  const input = parseOrThrow(
    UpdateViewConfigInputSchema,
    payload,
    "db:updateViewConfig",
  );
  return invokeDbWorker({ type: "updateViewConfig", input });
});

handleIpc("db:reorderViews", async (_, payload: ReorderViewsInput) => {
  const input = parseOrThrow(
    ReorderViewsInputSchema,
    payload,
    "db:reorderViews",
  );
  return invokeDbWorker({ type: "reorderViews", input });
});

// ==================== FIELDS ====================
handleIpc("db:getFields", async (_, collectionId: number) => {
  const parsedCollectionId = parsePositiveInt(collectionId, "db:getFields");
  return invokeDbWorker({
    type: "getFields",
    collectionId: parsedCollectionId,
  });
});

handleIpc("db:addField", async (_, field: NewFieldInput) => {
  const input = parseOrThrow(NewFieldInputSchema, field, "db:addField");
  return invokeDbWorker({ type: "addField", input });
});

handleIpc("db:updateField", async (_, field: UpdateFieldInput) => {
  const input = parseOrThrow(UpdateFieldInputSchema, field, "db:updateField");
  return invokeDbWorker({ type: "updateField", input });
});

handleIpc("db:reorderFields", async (_, payload: ReorderFieldsInput) => {
  const input = parseOrThrow(
    ReorderFieldsInputSchema,
    payload,
    "db:reorderFields",
  );
  return invokeDbWorker({ type: "reorderFields", input });
});

handleIpc("db:deleteField", async (_, id) => {
  const fieldId = parsePositiveInt(id, "db:deleteField");
  return invokeDbWorker({ type: "deleteField", id: fieldId });
});

// ==================== ITEMS ====================
type ItemRow = {
  id: number;
  collection_id: number;
  order: number;
  data: string;
  created_at?: string;
  updated_at?: string;
};

handleIpc("db:getItems", async (_, input: GetItemsInput) => {
  const parsedInput = parseOrThrow(GetItemsInputSchema, input, "db:getItems");
  const result = await invokeDbWorker<{
    items: ItemRow[];
    total: number;
    limit: number;
    offset: number;
  }>({
    type: "getItems",
    input: parsedInput,
  });

  const parsedItems = result.items.map((item) => {
    let rawData: unknown;
    try {
      rawData = JSON.parse(item.data);
    } catch (error) {
      throw new AppError(
        "DATA_CORRUPT",
        "Failed to parse item data.",
        error instanceof Error ? error.message : String(error),
      );
    }

    const parsedData = itemDataSchema.safeParse(rawData);
    if (!parsedData.success) {
      throw new AppError(
        "DATA_CORRUPT",
        "Failed to parse item data.",
        JSON.stringify({
          itemId: item.id,
          issues: parsedData.error.issues,
        }),
      );
    }

    return {
      ...item,
      data: parsedData.data as ItemData,
    };
  });

  return {
    ...result,
    items: parsedItems,
  };
});

handleIpc("db:addItem", async (_, item: NewItemInput) => {
  const input = parseOrThrow(NewItemInputSchema, item, "db:addItem");
  return invokeDbWorker({ type: "addItem", input });
});

handleIpc("db:insertItemAt", async (_, payload: InsertItemAtInput) => {
  const input = parseOrThrow(
    InsertItemAtInputSchema,
    payload,
    "db:insertItemAt",
  );
  return invokeDbWorker({ type: "insertItemAt", input });
});

handleIpc("db:duplicateItem", async (_, payload: DuplicateItemInput) => {
  const input = parseOrThrow(
    DuplicateItemInputSchema,
    payload,
    "db:duplicateItem",
  );
  return invokeDbWorker({ type: "duplicateItem", input });
});

handleIpc("db:moveItem", async (_, payload: MoveItemInput) => {
  const input = parseOrThrow(MoveItemInputSchema, payload, "db:moveItem");
  return invokeDbWorker({ type: "moveItem", input });
});

handleIpc("db:updateItem", async (_, item: UpdateItemInput) => {
  const input = parseOrThrow(UpdateItemInputSchema, item, "db:updateItem");
  return invokeDbWorker({ type: "updateItem", input });
});

handleIpc("db:deleteItem", async (_, id) => {
  const itemId = parsePositiveInt(id, "db:deleteItem");
  return invokeDbWorker({ type: "deleteItem", id: itemId });
});

handleIpc("db:reorderItems", async (_, payload: ReorderItemsInput) => {
  const input = parseOrThrow(
    ReorderItemsInputSchema,
    payload,
    "db:reorderItems",
  );
  return invokeDbWorker<boolean>(
    { type: "reorderItems", input },
    { timeoutMs: DB_BULK_TIMEOUT_MS },
  );
});

handleIpc("db:bulkDeleteItems", async (_, payload: BulkDeleteItemsInput) => {
  const input = parseOrThrow(
    BulkDeleteItemsInputSchema,
    payload,
    "db:bulkDeleteItems",
  );
  return invokeDbWorker(
    { type: "bulkDeleteItems", input },
    { timeoutMs: DB_BULK_TIMEOUT_MS },
  );
});

handleIpc("db:bulkPatchItems", async (_, payload: BulkPatchItemsInput) => {
  const input = parseOrThrow(
    BulkPatchItemsInputSchema,
    payload,
    "db:bulkPatchItems",
  );
  return invokeDbWorker(
    { type: "bulkPatchItems", input },
    { timeoutMs: DB_BULK_TIMEOUT_MS },
  );
});

// ==================== IMPORT (TRANSACTIONAL) ====================
handleIpc("db:importCollection", async (_, payload: ImportCollectionInput) => {
  const input = parseOrThrow(
    ImportCollectionInputSchema,
    payload,
    "db:importCollection",
  );

  return invokeDbWorker(
    {
      type: "importCollection",
      input,
    },
    {
      timeoutMs: DB_IMPORT_TIMEOUT_MS,
    },
  );
});

// ==================== EXPORT ====================
handleIpc("export:writeFile", async (_, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, "utf-8");
    return true;
  } catch (error) {
    throw new AppError(
      "FS_WRITE_FAILED",
      "Failed to write file.",
      error instanceof Error ? error.stack : undefined,
    );
  }
});

// ==================== IMPORT ====================
handleIpc("import:readFile", async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    throw new AppError(
      "FS_READ_FAILED",
      "Failed to read file.",
      error instanceof Error ? error.stack : undefined,
    );
  }
});

// ==================== EXTERNAL ====================
handleIpc("openExternal", async (_, url: string) => {
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    throw new AppError("VALIDATION_FAILED", "Invalid URL.");
  }

  await shell.openExternal(url);
  return;
});

// Export a registration function for consistency
export function registerDbIpcHandlers() {
  // All handlers are registered at module load time via handleIpc calls above
  // This function exists for explicit registration if needed
}
