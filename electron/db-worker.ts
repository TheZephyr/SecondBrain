import Database from "better-sqlite3";
import { parentPort } from "worker_threads";
import type {
  GetItemsInput,
  ImportCollectionInput,
  ItemSortSpec,
} from "../src/types/models";
import type {
  DbWorkerError,
  DbWorkerOperation,
  DbWorkerRequest,
  DbWorkerResponse,
} from "./db-worker-protocol";

let db: Database.Database | null = null;
let ftsEnabled = false;

type CountRow = { count: number | bigint };
type TotalRow = { total: number | bigint };

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

function initDatabase(dbPath: string): boolean {
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

function handleOperation(operation: DbWorkerOperation): unknown {
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
      const info = database
        .prepare(
          "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          operation.input.collectionId,
          operation.input.name,
          operation.input.type,
          operation.input.options || null,
          operation.input.orderIndex || 0,
        );

      return { id: Number(info.lastInsertRowid), ...operation.input };
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

function processRequest(request: DbWorkerRequest): DbWorkerResponse {
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

if (!workerPort) {
  throw new Error("db-worker must run in a Worker thread.");
}

workerPort.on("message", (request: DbWorkerRequest) => {
  const response = processRequest(request);
  workerPort.postMessage(response);
});

process.on("exit", () => {
  if (db) {
    db.close();
  }
});
