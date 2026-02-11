import Database from "better-sqlite3";
import { parentPort } from "worker_threads";
import type { ImportCollectionInput } from "../src/types/models";
import type {
  DbWorkerError,
  DbWorkerOperation,
  DbWorkerRequest,
  DbWorkerResponse,
} from "./db-worker-protocol";

let db: Database.Database | null = null;

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
  const message = error instanceof Error ? error.message : "Unknown database error.";
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

  return true;
}

function runImport(database: Database.Database, input: ImportCollectionInput) {
  const importTransaction = database.transaction((data: ImportCollectionInput) => {
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
  });

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
      const info = stmt.run(operation.input.name, operation.input.icon || "folder");

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
        database.prepare("DELETE FROM collections WHERE id = ?").run(collectionId);
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
      return database
        .prepare(
          "SELECT * FROM items WHERE collection_id = ? ORDER BY created_at DESC",
        )
        .all(operation.collectionId);
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
