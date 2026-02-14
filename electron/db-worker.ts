import Database from "better-sqlite3";
import { parentPort } from "worker_threads";
import type {
  BulkDeleteItemsInput,
  BulkMutationResult,
  BulkPatchItemsInput,
  GetItemsInput,
  ImportCollectionInput,
  ItemData,
  ItemSortSpec,
  ReorderFieldsInput,
} from "../src/types/models";
import { itemDataSchema } from "../src/validation/schemas";
import type {
  DbWorkerError,
  DbWorkerOperation,
  DbWorkerRequest,
  DbWorkerResponse,
} from "./db-worker-protocol";

let db: Database.Database | null = null;
let ftsEnabled = false;
const SQLITE_IN_CLAUSE_CHUNK_SIZE = 400;
const FIELD_ORDER_UNIQUE_INDEX = "idx_fields_collection_order_unique";

type CountRow = { count: number | bigint };
type TotalRow = { total: number | bigint };
type MaxOrderRow = { maxOrderIndex: number | bigint | null };
type IdRow = { id: number };
type ItemDataRow = { id: number; data: string };

function serializeDetails(details: unknown): string | undefined {
  if (!details) return undefined;
  if (typeof details === "string") return details;
  if (details instanceof Error) {
    return details.stack || details.message;
  }
  try {
    return JSON.stringify(details);
  } catch {
    return "Unable to serialize error details.";
  }
}

function toWorkerError(error: unknown): DbWorkerError {
  const message =
    error instanceof Error ? error.message : "Unknown database error.";
  const details =
    error instanceof Error
      ? serializeDetails(error.stack)
      : serializeDetails(error);

  return { message, details };
}

function requireDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized.");
  }

  return db;
}

function toNumber(value: number | bigint | undefined): number {
  if (value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

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

function getMissingIds(requestedIds: number[], existingIds: Set<number>): number[] {
  return requestedIds.filter((id) => !existingIds.has(id));
}

function getNextFieldOrderIndex(
  database: Database.Database,
  collectionId: number,
): number {
  const row = database
    .prepare(
      "SELECT MAX(order_index) AS maxOrderIndex FROM fields WHERE collection_id = ?",
    )
    .get(collectionId) as MaxOrderRow | undefined;

  const maxOrderIndex =
    row?.maxOrderIndex === null || row?.maxOrderIndex === undefined
      ? -1
      : toNumber(row.maxOrderIndex);
  return maxOrderIndex + 1;
}

function hasIndex(database: Database.Database, indexName: string): boolean {
  const row = database
    .prepare(
      "SELECT 1 AS found FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1",
    )
    .get(indexName) as { found: number } | undefined;

  return Boolean(row?.found);
}

function normalizeFieldOrderIndices(database: Database.Database): void {
  const collectionRows = database
    .prepare(
      "SELECT DISTINCT collection_id AS id FROM fields ORDER BY collection_id ASC",
    )
    .all() as IdRow[];
  const selectFieldIds = database.prepare(
    "SELECT id FROM fields WHERE collection_id = ? ORDER BY order_index ASC, id ASC",
  );
  const updateFieldOrder = database.prepare(
    "UPDATE fields SET order_index = ? WHERE id = ?",
  );

  for (const collectionRow of collectionRows) {
    const fieldRows = selectFieldIds.all(collectionRow.id) as IdRow[];
    for (let index = 0; index < fieldRows.length; index++) {
      updateFieldOrder.run(index, fieldRows[index].id);
    }
  }
}

function ensureFieldOrderIntegrity(database: Database.Database): void {
  if (hasIndex(database, FIELD_ORDER_UNIQUE_INDEX)) {
    return;
  }

  const migrateFieldOrder = database.transaction(() => {
    normalizeFieldOrderIndices(database);
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${FIELD_ORDER_UNIQUE_INDEX}
      ON fields(collection_id, order_index)
    `);
  });

  migrateFieldOrder();
}

function ensureReorderPayloadMatchesCollection(
  database: Database.Database,
  input: ReorderFieldsInput,
) {
  const fieldRows = database
    .prepare(
      "SELECT id FROM fields WHERE collection_id = ? ORDER BY order_index ASC, id ASC",
    )
    .all(input.collectionId) as IdRow[];

  if (fieldRows.length !== input.fieldOrders.length) {
    throw new Error(
      "Field reorder payload must include every field in the collection exactly once.",
    );
  }

  const existingIds = new Set(fieldRows.map((row) => row.id));
  const payloadIds = input.fieldOrders.map((entry) => entry.id);
  const payloadUniqueIds = new Set(payloadIds);
  if (payloadUniqueIds.size !== payloadIds.length) {
    throw new Error("Field reorder payload contains duplicate field IDs.");
  }

  const invalidIds: number[] = [];
  for (const payloadId of payloadUniqueIds) {
    if (!existingIds.has(payloadId)) {
      invalidIds.push(payloadId);
    }
  }

  if (invalidIds.length > 0) {
    throw new Error(
      `Field reorder payload contains IDs outside the collection: ${invalidIds.join(", ")}`,
    );
  }

  const missingIds: number[] = [];
  for (const existingId of existingIds) {
    if (!payloadUniqueIds.has(existingId)) {
      missingIds.push(existingId);
    }
  }

  if (missingIds.length > 0) {
    throw new Error(
      `Field reorder payload is missing IDs from the collection: ${missingIds.join(", ")}`,
    );
  }
}

function reorderFields(
  database: Database.Database,
  input: ReorderFieldsInput,
): boolean {
  const reorderFieldsTransaction = database.transaction(
    (payload: ReorderFieldsInput) => {
      ensureReorderPayloadMatchesCollection(database, payload);

      const shiftAmount = payload.fieldOrders.length;
      database
        .prepare(
          "UPDATE fields SET order_index = order_index + ? WHERE collection_id = ?",
        )
        .run(shiftAmount, payload.collectionId);

      const updateFieldOrder = database.prepare(
        "UPDATE fields SET order_index = ? WHERE id = ? AND collection_id = ?",
      );

      for (const entry of payload.fieldOrders) {
        const info = updateFieldOrder.run(
          entry.orderIndex,
          entry.id,
          payload.collectionId,
        );
        if (toNumber(info.changes) !== 1) {
          throw new Error(
            `Failed to reorder field ${entry.id} in collection ${payload.collectionId}.`,
          );
        }
      }
    },
  );

  reorderFieldsTransaction(input);
  return true;
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

function bulkDeleteItems(
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

function parseStoredItemDataOrThrow(rawData: string, itemId: number): ItemData {
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

function bulkPatchItems(
  database: Database.Database,
  input: BulkPatchItemsInput,
): BulkMutationResult {
  const bulkPatchTransaction = database.transaction(
    (payload: BulkPatchItemsInput) => {
      const itemIds = payload.updates.map((entry) => entry.id);
      const itemDataById = getItemsDataByIds(database, payload.collectionId, itemIds);
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

        const currentData = parseStoredItemDataOrThrow(currentRawData, update.id);
        const mergedData: ItemData = {
          ...currentData,
          ...update.patch,
        };
        const mergedParse = itemDataSchema.safeParse(mergedData);
        if (!mergedParse.success) {
          throw new Error(`Bulk patch failed. Item ${update.id} merged data is invalid.`);
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

function tokenizeSearch(search: string | undefined): string[] {
  if (!search) return [];
  return search
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function escapeLikePattern(token: string): string {
  return token.replace(/([\\%_])/g, "\\$1");
}

function buildFtsMatchQuery(tokens: string[]): string {
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(" AND ");
}

function extractSortableFieldName(path: string): string | null {
  if (!path.startsWith("data.")) return null;
  const fieldName = path.slice(5).trim();
  if (!fieldName) return null;
  return fieldName;
}

function getItemSortClause(sort: ItemSortSpec[] | undefined): string[] {
  if (!sort || sort.length === 0) {
    return [];
  }

  const clauses: string[] = [];

  for (const spec of sort) {
    const fieldName = extractSortableFieldName(spec.field);
    if (!fieldName) {
      continue;
    }

    const direction = spec.order === -1 ? "DESC" : "ASC";
    const jsonPath = `$."${fieldName.replace(/"/g, '""')}"`;
    clauses.push(
      `json_extract(i.data, '${jsonPath}') COLLATE NOCASE ${direction}`,
    );
  }

  return clauses;
}

function rebuildItemFtsIndex(database: Database.Database) {
  const rebuildTransaction = database.transaction(() => {
    database.prepare("DELETE FROM items_fts").run();
    database
      .prepare(
        `
        INSERT INTO items_fts(rowid, content)
        SELECT
          i.id,
          COALESCE(
            (
              SELECT group_concat(CAST(value AS TEXT), ' ')
              FROM json_each(i.data)
              WHERE json_each.type IN ('text', 'integer', 'real')
            ),
            ''
          )
        FROM items i
        `,
      )
      .run();
  });

  rebuildTransaction();
}

function syncItemFtsIndex(database: Database.Database) {
  const itemCountRow = database
    .prepare("SELECT COUNT(*) AS count FROM items")
    .get() as CountRow;
  const ftsCountRow = database
    .prepare("SELECT COUNT(*) AS count FROM items_fts")
    .get() as CountRow;

  if (toNumber(itemCountRow.count) !== toNumber(ftsCountRow.count)) {
    rebuildItemFtsIndex(database);
  }
}

function tryEnableFts(database: Database.Database): boolean {
  try {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        content,
        tokenize = 'unicode61'
      )
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS items_fts_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, content)
        VALUES (
          new.id,
          COALESCE(
            (
              SELECT group_concat(CAST(value AS TEXT), ' ')
              FROM json_each(new.data)
              WHERE json_each.type IN ('text', 'integer', 'real')
            ),
            ''
          )
        );
      END;
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS items_fts_au AFTER UPDATE OF data ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.id;
        INSERT INTO items_fts(rowid, content)
        VALUES (
          new.id,
          COALESCE(
            (
              SELECT group_concat(CAST(value AS TEXT), ' ')
              FROM json_each(new.data)
              WHERE json_each.type IN ('text', 'integer', 'real')
            ),
            ''
          )
        );
      END;
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS items_fts_ad AFTER DELETE ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.id;
      END;
    `);

    syncItemFtsIndex(database);
    return true;
  } catch (error) {
    console.error(
      "[DB Worker] FTS unavailable. Falling back to LIKE search.",
      error,
    );
    return false;
  }
}

function buildSearchQueryContext(input: GetItemsInput): {
  joinClause: string;
  whereClause: string;
  params: unknown[];
  defaultOrderClause: string;
} {
  const whereParts: string[] = ["i.collection_id = ?"];
  const params: unknown[] = [input.collectionId];
  let joinClause = "";
  let defaultOrderClause = "i.created_at DESC, i.id DESC";
  const searchTokens = tokenizeSearch(input.search);

  if (searchTokens.length === 0) {
    return {
      joinClause,
      whereClause: whereParts.join(" AND "),
      params,
      defaultOrderClause,
    };
  }

  if (ftsEnabled) {
    joinClause = "JOIN items_fts fts ON fts.rowid = i.id";
    whereParts.push("fts.content MATCH ?");
    params.push(buildFtsMatchQuery(searchTokens));
    defaultOrderClause = "bm25(items_fts) ASC, i.created_at DESC, i.id DESC";
    return {
      joinClause,
      whereClause: whereParts.join(" AND "),
      params,
      defaultOrderClause,
    };
  }

  for (const token of searchTokens) {
    whereParts.push(`
      EXISTS (
        SELECT 1
        FROM json_each(i.data) je
        WHERE je.type IN ('text', 'integer', 'real')
          AND LOWER(CAST(je.value AS TEXT)) LIKE ? ESCAPE '\\'
      )
    `);
    params.push(`%${escapeLikePattern(token.toLowerCase())}%`);
  }

  return {
    joinClause,
    whereClause: whereParts.join(" AND "),
    params,
    defaultOrderClause,
  };
}

function getItems(database: Database.Database, input: GetItemsInput) {
  const { joinClause, whereClause, params, defaultOrderClause } =
    buildSearchQueryContext(input);
  const sortClauses = getItemSortClause(input.sort);
  const orderByClause =
    sortClauses.length > 0
      ? `${sortClauses.join(", ")}, i.created_at DESC, i.id DESC`
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

export function initDatabase(dbPath: string): boolean {
  if (db) {
    db.close();
  }

  db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'folder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      options TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `);
  ensureFieldOrderIntegrity(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_collection_created_at_id
    ON items (collection_id, created_at DESC, id DESC)
  `);

  ftsEnabled = tryEnableFts(db);

  return true;
}

function runImport(database: Database.Database, input: ImportCollectionInput) {
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
        const insertItem = database.prepare(
          "INSERT INTO items (collection_id, data) VALUES (?, ?)",
        );
        for (const item of data.items) {
          insertItem.run(item.collectionId, JSON.stringify(item.data));
        }
      }
    },
  );

  importTransaction(input);
}

export function handleOperation(operation: DbWorkerOperation): unknown {
  switch (operation.type) {
    case "init": {
      return initDatabase(operation.dbPath);
    }
    case "getCollections": {
      const database = requireDb();
      return database
        .prepare("SELECT * FROM collections ORDER BY created_at ASC")
        .all();
    }
    case "getCollectionItemCounts": {
      const database = requireDb();
      return database
        .prepare(
          "SELECT collection_id AS collectionId, COUNT(*) AS itemCount FROM items GROUP BY collection_id",
        )
        .all();
    }
    case "addCollection": {
      const database = requireDb();
      const stmt = database.prepare(
        "INSERT INTO collections (name, icon) VALUES (?, ?)",
      );
      const info = stmt.run(
        operation.input.name,
        operation.input.icon || "folder",
      );

      return {
        id: Number(info.lastInsertRowid),
        name: operation.input.name,
        icon: operation.input.icon,
      };
    }
    case "updateCollection": {
      const database = requireDb();
      database
        .prepare("UPDATE collections SET name = ?, icon = ? WHERE id = ?")
        .run(operation.input.name, operation.input.icon, operation.input.id);

      return true;
    }
    case "deleteCollection": {
      const database = requireDb();
      const deleteCollection = database.transaction((collectionId: number) => {
        database
          .prepare("DELETE FROM collections WHERE id = ?")
          .run(collectionId);
      });

      deleteCollection(operation.id);
      return true;
    }
    case "getFields": {
      const database = requireDb();
      return database
        .prepare(
          "SELECT * FROM fields WHERE collection_id = ? ORDER BY order_index ASC",
        )
        .all(operation.collectionId);
    }
    case "addField": {
      const database = requireDb();
      const orderIndex =
        operation.input.orderIndex ??
        getNextFieldOrderIndex(database, operation.input.collectionId);
      const info = database
        .prepare(
          "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          operation.input.collectionId,
          operation.input.name,
          operation.input.type,
          operation.input.options || null,
          orderIndex,
        );

      return {
        id: Number(info.lastInsertRowid),
        ...operation.input,
        orderIndex,
      };
    }
    case "updateField": {
      const database = requireDb();
      database
        .prepare(
          "UPDATE fields SET name = ?, type = ?, options = ?, order_index = ? WHERE id = ?",
        )
        .run(
          operation.input.name,
          operation.input.type,
          operation.input.options || null,
          operation.input.orderIndex || 0,
          operation.input.id,
        );

      return true;
    }
    case "reorderFields": {
      const database = requireDb();
      return reorderFields(database, operation.input);
    }
    case "deleteField": {
      const database = requireDb();
      database.prepare("DELETE FROM fields WHERE id = ?").run(operation.id);
      return true;
    }
    case "getItems": {
      const database = requireDb();
      return getItems(database, operation.input);
    }
    case "addItem": {
      const database = requireDb();
      const dataJson = JSON.stringify(operation.input.data);
      const info = database
        .prepare("INSERT INTO items (collection_id, data) VALUES (?, ?)")
        .run(operation.input.collectionId, dataJson);

      return {
        id: Number(info.lastInsertRowid),
        collection_id: operation.input.collectionId,
        data: operation.input.data,
      };
    }
    case "updateItem": {
      const database = requireDb();
      const dataJson = JSON.stringify(operation.input.data);
      database
        .prepare(
          "UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .run(dataJson, operation.input.id);

      return true;
    }
    case "deleteItem": {
      const database = requireDb();
      database.prepare("DELETE FROM items WHERE id = ?").run(operation.id);
      return true;
    }
    case "bulkDeleteItems": {
      const database = requireDb();
      return bulkDeleteItems(database, operation.input);
    }
    case "bulkPatchItems": {
      const database = requireDb();
      return bulkPatchItems(database, operation.input);
    }
    case "importCollection": {
      const database = requireDb();
      runImport(database, operation.input);
      return true;
    }
    default: {
      const exhaustiveCheck: never = operation;
      return exhaustiveCheck;
    }
  }
}

export function processRequest(request: DbWorkerRequest): DbWorkerResponse {
  try {
    return {
      id: request.id,
      ok: true,
      data: handleOperation(request.operation),
    };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: toWorkerError(error),
    };
  }
}

const workerPort = parentPort;

if (workerPort) {
  workerPort.on("message", (request: DbWorkerRequest) => {
    const response = processRequest(request);
    workerPort.postMessage(response);
  });
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

process.on("exit", () => {
  closeDatabase();
});
