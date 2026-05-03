import Database from "better-sqlite3";
import type {
  BulkDeleteItemsInput,
  BulkMutationResult,
  BulkPatchItemsInput,
  GetItemsInput,
  GetNumberFieldRangeInput,
  ImportCollectionInput,
  InsertItemAtInput,
  ItemData,
  DuplicateItemInput,
  MoveItemInput,
  NumberFieldRange,
  ReorderItemsInput,
} from "../../src/types/models";
import { itemDataSchema } from "../../src/validation/schemas";
import {
  buildSearchQueryContext,
  getFieldTypeMap,
  getItemSortClause,
  toNumber,
} from "./query-utils";

type TotalRow = { total: number | bigint };
type MaxItemOrderRow = { maxOrder: number | bigint | null };
type IdRow = { id: number };
type ItemDataRow = { id: number; data: string };
type ItemOrderRow = { id: number; order: number | bigint };
type ItemRow = {
  id: number;
  collection_id: number;
  data: string;
  order: number | bigint;
};
type NumberRangeRow = {
  minValue: number | null;
  maxValue: number | null;
  count: number | bigint;
};

const SQLITE_IN_CLAUSE_CHUNK_SIZE = 400;

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

function buildInClausePlaceholders(length: number): string {
  return new Array(length).fill("?").join(", ");
}

function getMissingIds(
  requestedIds: number[],
  existingIds: Set<number>,
): number[] {
  return requestedIds.filter((id) => !existingIds.has(id));
}

function getNextItemOrderIndex(
  database: Database.Database,
  collectionId: number,
): number {
  const row = database
    .prepare(
      'SELECT COALESCE(MAX("order"), 0) AS maxOrder FROM items WHERE collection_id = ?',
    )
    .get(collectionId) as MaxItemOrderRow | undefined;

  const maxOrder = row?.maxOrder ?? 0;
  return toNumber(maxOrder) + 1;
}

export function runImport(
  database: Database.Database,
  input: ImportCollectionInput,
) {
  const importTransaction = database.transaction(
    (data: ImportCollectionInput) => {
      if (data.mode === "replace") {
        database
          .prepare("DELETE FROM items WHERE collection_id = ?")
          .run(data.collectionId);
      }

      if (data.newFields.length > 0) {
        const insertField = database.prepare(
          "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)",
        );
        for (const field of data.newFields) {
          insertField.run(
            field.collectionId,
            field.name,
            field.type,
            field.options ?? null,
            field.orderIndex ?? 0,
          );
        }
      }

      if (data.items.length > 0) {
        let nextOrder = getNextItemOrderIndex(database, data.collectionId);
        const insertItem = database.prepare(
          'INSERT INTO items (collection_id, data, "order") VALUES (?, ?, ?)',
        );
        for (const item of data.items) {
          insertItem.run(
            item.collectionId,
            JSON.stringify(item.data),
            nextOrder,
          );
          nextOrder += 1;
        }
      }
    },
  );

  importTransaction(input);
}

function getExistingItemIds(
  database: Database.Database,
  collectionId: number,
  itemIds: number[],
): Set<number> {
  const existingIds = new Set<number>();
  for (const chunk of chunkArray(itemIds, SQLITE_IN_CLAUSE_CHUNK_SIZE)) {
    const placeholders = buildInClausePlaceholders(chunk.length);
    const sql = `
      SELECT id
      FROM items
      WHERE collection_id = ?
        AND id IN (${placeholders})
    `;
    const rows = database.prepare(sql).all(collectionId, ...chunk) as IdRow[];
    for (const row of rows) {
      existingIds.add(row.id);
    }
  }
  return existingIds;
}

export function bulkDeleteItems(
  database: Database.Database,
  input: BulkDeleteItemsInput,
): BulkMutationResult {
  const bulkDeleteTransaction = database.transaction(
    (payload: BulkDeleteItemsInput) => {
      const existingIds = getExistingItemIds(
        database,
        payload.collectionId,
        payload.itemIds,
      );
      const missingIds = getMissingIds(payload.itemIds, existingIds);
      if (missingIds.length > 0) {
        throw new Error(
          `Bulk delete failed. Invalid item IDs for collection ${payload.collectionId}: ${missingIds.join(", ")}`,
        );
      }

      let affectedCount = 0;
      for (const chunk of chunkArray(
        payload.itemIds,
        SQLITE_IN_CLAUSE_CHUNK_SIZE,
      )) {
        const placeholders = buildInClausePlaceholders(chunk.length);
        const sql = `
          DELETE FROM items
          WHERE collection_id = ?
            AND id IN (${placeholders})
        `;
        const info = database.prepare(sql).run(payload.collectionId, ...chunk);
        affectedCount += toNumber(info.changes);
      }

      return { affectedCount };
    },
  );

  return bulkDeleteTransaction(input);
}

export function reorderItems(
  database: Database.Database,
  input: ReorderItemsInput,
): boolean {
  const reorderItemsTransaction = database.transaction(
    (payload: ReorderItemsInput) => {
      const existingIds = getExistingItemIds(
        database,
        payload.collectionId,
        payload.itemOrders.map((entry) => entry.id),
      );
      const missingIds = getMissingIds(
        payload.itemOrders.map((entry) => entry.id),
        existingIds,
      );
      if (missingIds.length > 0) {
        throw new Error(
          `Item reorder payload contains invalid item IDs for collection ${payload.collectionId}: ${missingIds.join(", ")}`,
        );
      }

      const updateItemOrder = database.prepare(
        'UPDATE items SET "order" = ? WHERE id = ? AND collection_id = ?',
      );
      for (const entry of payload.itemOrders) {
        const info = updateItemOrder.run(
          entry.order,
          entry.id,
          payload.collectionId,
        );
        if (toNumber(info.changes) !== 1) {
          throw new Error(
            `Failed to reorder item ${entry.id} in collection ${payload.collectionId}.`,
          );
        }
      }
    },
  );

  reorderItemsTransaction(input);
  return true;
}

function getItemsDataByIds(
  database: Database.Database,
  collectionId: number,
  itemIds: number[],
): Map<number, string> {
  const itemDataById = new Map<number, string>();
  for (const chunk of chunkArray(itemIds, SQLITE_IN_CLAUSE_CHUNK_SIZE)) {
    const placeholders = buildInClausePlaceholders(chunk.length);
    const sql = `
      SELECT id, data
      FROM items
      WHERE collection_id = ?
        AND id IN (${placeholders})
    `;
    const rows = database
      .prepare(sql)
      .all(collectionId, ...chunk) as ItemDataRow[];
    for (const row of rows) {
      itemDataById.set(row.id, row.data);
    }
  }
  return itemDataById;
}

function parseStoredItemDataOrThrow(
  rawData: string,
  itemId: number,
): ItemData {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawData);
  } catch (error) {
    throw new Error(
      `Bulk patch failed. Item ${itemId} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsedData = itemDataSchema.safeParse(parsedJson);
  if (!parsedData.success) {
    throw new Error(
      `Bulk patch failed. Item ${itemId} contains invalid data structure.`,
    );
  }

  return parsedData.data as ItemData;
}

export function bulkPatchItems(
  database: Database.Database,
  input: BulkPatchItemsInput,
): BulkMutationResult {
  const bulkPatchTransaction = database.transaction(
    (payload: BulkPatchItemsInput) => {
      const itemIds = payload.updates.map((entry) => entry.id);
      const itemDataById = getItemsDataByIds(
        database,
        payload.collectionId,
        itemIds,
      );
      const missingIds = getMissingIds(itemIds, new Set(itemDataById.keys()));
      if (missingIds.length > 0) {
        throw new Error(
          `Bulk patch failed. Invalid item IDs for collection ${payload.collectionId}: ${missingIds.join(", ")}`,
        );
      }

      const updateItem = database.prepare(
        "UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND collection_id = ?",
      );

      for (const update of payload.updates) {
        const currentRawData = itemDataById.get(update.id);
        if (!currentRawData) {
          throw new Error(
            `Bulk patch failed. Item ${update.id} is missing from collection ${payload.collectionId}.`,
          );
        }

        const currentData = parseStoredItemDataOrThrow(
          currentRawData,
          update.id,
        );
        const mergedData: ItemData = {
          ...currentData,
          ...update.patch,
        };
        const mergedParse = itemDataSchema.safeParse(mergedData);
        if (!mergedParse.success) {
          throw new Error(
            `Bulk patch failed. Item ${update.id} merged data is invalid.`,
          );
        }

        const info = updateItem.run(
          JSON.stringify(mergedParse.data),
          update.id,
          payload.collectionId,
        );
        if (toNumber(info.changes) !== 1) {
          throw new Error(
            `Bulk patch failed. Unable to update item ${update.id} in collection ${payload.collectionId}.`,
          );
        }
      }

      return { affectedCount: payload.updates.length };
    },
  );

  return bulkPatchTransaction(input);
}

export function getItems(
  database: Database.Database,
  input: GetItemsInput,
  ftsEnabled: boolean,
) {
  const fieldTypeMap = getFieldTypeMap(database, input.collectionId);
  const { joinClause, whereClause, params, defaultOrderClause } =
    buildSearchQueryContext(input, fieldTypeMap, ftsEnabled);
  const sortClauses = getItemSortClause(input.sort, fieldTypeMap);
  const orderByClause =
    sortClauses.length > 0
      ? `${sortClauses.join(", ")}, i."order" ASC, i.id ASC`
      : defaultOrderClause;

  const rowsSql = `
    SELECT i.*
    FROM items i
    ${joinClause}
    WHERE ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT ? OFFSET ?
  `;

  const items = database
    .prepare(rowsSql)
    .all(...params, input.limit, input.offset);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM items i
    ${joinClause}
    WHERE ${whereClause}
  `;

  const totalRow = database.prepare(countSql).get(...params) as TotalRow;

  return {
    items,
    total: toNumber(totalRow.total),
    limit: input.limit,
    offset: input.offset,
  };
}

export function getNumberFieldRange(
  database: Database.Database,
  input: GetNumberFieldRangeInput,
): NumberFieldRange {
  const jsonPath = `$."${input.fieldName}"`;
  const row = database
    .prepare(
      `
      SELECT
        MIN(CAST(json_extract(data, ?) AS REAL)) AS minValue,
        MAX(CAST(json_extract(data, ?) AS REAL)) AS maxValue,
        COUNT(*) AS count
      FROM items
      WHERE collection_id = ?
        AND json_type(data, ?) IN ('integer', 'real')
      `,
    )
    .get(jsonPath, jsonPath, input.collectionId, jsonPath) as
    | NumberRangeRow
    | undefined;

  return {
    min: row?.minValue ?? null,
    max: row?.maxValue ?? null,
    count: row?.count ? toNumber(row.count) : 0,
  };
}

export function addItem(
  database: Database.Database,
  input: { collectionId: number; data: ItemData },
) {
  const dataJson = JSON.stringify(input.data);
  const info = database
    .prepare(
      'INSERT INTO items (collection_id, data, "order") VALUES (?, ?, (SELECT COALESCE(MAX("order"), 0) + 1 FROM items WHERE collection_id = ?))',
    )
    .run(input.collectionId, dataJson, input.collectionId);

  return {
    id: Number(info.lastInsertRowid),
    collection_id: input.collectionId,
    order: getNextItemOrderIndex(database, input.collectionId) - 1,
    data: input.data,
  };
}

export function insertItemAt(
  database: Database.Database,
  input: InsertItemAtInput,
) {
  const tx = database.transaction((payload: InsertItemAtInput) => {
    const targetOrder =
      payload.afterOrder === null ? 0 : payload.afterOrder + 1;
    database
      .prepare(
        'UPDATE items SET "order" = "order" + 1 WHERE collection_id = ? AND "order" >= ?',
      )
      .run(payload.collectionId, targetOrder);

    const info = database
      .prepare(
        'INSERT INTO items (collection_id, data, "order") VALUES (?, ?, ?)',
      )
      .run(payload.collectionId, JSON.stringify({}), targetOrder);

    return {
      id: Number(info.lastInsertRowid),
      collection_id: payload.collectionId,
      order: targetOrder,
      data: {},
    };
  });

  return tx(input);
}

export function duplicateItem(
  database: Database.Database,
  input: DuplicateItemInput,
) {
  const tx = database.transaction((payload: DuplicateItemInput) => {
    const source = database
      .prepare(
        'SELECT id, collection_id, data, "order" FROM items WHERE id = ? AND collection_id = ?',
      )
      .get(payload.itemId, payload.collectionId) as ItemRow | undefined;

    if (!source) {
      throw new Error(
        `Duplicate failed. Item ${payload.itemId} not found in collection ${payload.collectionId}.`,
      );
    }

    const targetOrder = toNumber(source.order) + 1;
    database
      .prepare(
        'UPDATE items SET "order" = "order" + 1 WHERE collection_id = ? AND "order" >= ?',
      )
      .run(payload.collectionId, targetOrder);

    const info = database
      .prepare(
        'INSERT INTO items (collection_id, data, "order") VALUES (?, ?, ?)',
      )
      .run(payload.collectionId, source.data, targetOrder);

    return {
      id: Number(info.lastInsertRowid),
      collection_id: payload.collectionId,
      order: targetOrder,
      data: JSON.parse(source.data) as ItemData,
    };
  });

  return tx(input);
}

export function moveItem(database: Database.Database, input: MoveItemInput) {
  const tx = database.transaction((payload: MoveItemInput) => {
    const source = database
      .prepare(
        'SELECT id, "order" FROM items WHERE id = ? AND collection_id = ?',
      )
      .get(payload.itemId, payload.collectionId) as ItemOrderRow | undefined;

    if (!source) {
      throw new Error(
        `Move failed. Item ${payload.itemId} not found in collection ${payload.collectionId}.`,
      );
    }

    const sourceOrder = toNumber(source.order);
    const neighbor = database
      .prepare(
        payload.direction === "up"
          ? 'SELECT id, "order" FROM items WHERE collection_id = ? AND "order" < ? ORDER BY "order" DESC, id DESC LIMIT 1'
          : 'SELECT id, "order" FROM items WHERE collection_id = ? AND "order" > ? ORDER BY "order" ASC, id ASC LIMIT 1',
      )
      .get(payload.collectionId, sourceOrder) as ItemOrderRow | undefined;

    if (!neighbor) {
      throw new Error(
        `Move failed. Item ${payload.itemId} is already at the ${payload.direction === "up" ? "top" : "bottom"} of collection ${payload.collectionId}.`,
      );
    }

    const neighborOrder = toNumber(neighbor.order);
    database
      .prepare(
        'UPDATE items SET "order" = CASE WHEN id = ? THEN ? WHEN id = ? THEN ? ELSE "order" END WHERE collection_id = ? AND id IN (?, ?)',
      )
      .run(
        source.id,
        neighborOrder,
        neighbor.id,
        sourceOrder,
        payload.collectionId,
        source.id,
        neighbor.id,
      );

    return true;
  });

  return tx(input);
}

export function updateItem(
  database: Database.Database,
  input: { id: number; data: ItemData },
) {
  const dataJson = JSON.stringify(input.data);
  database
    .prepare(
      "UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(dataJson, input.id);

  return true;
}

export function deleteItem(database: Database.Database, itemId: number) {
  database.prepare("DELETE FROM items WHERE id = ?").run(itemId);
  return true;
}
