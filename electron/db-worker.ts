import Database from "better-sqlite3";
import { parentPort } from "worker_threads";
import type {
  DbWorkerError,
  DbWorkerOperation,
  DbWorkerRequest,
  DbWorkerResponse,
} from "./db-worker-protocol";
import {
  exportFullArchive as buildFullArchiveExport,
  getArchiveDatabaseSummary,
  restoreFullArchive as runFullArchiveRestore,
} from "./full-archive";

import { initDatabaseConnection } from "./db-init";
import {
  getCollections,
  getCollectionItemCounts,
  addCollection,
  updateCollection,
  deleteCollection,
} from "./db-collections";
import {
  getFields,
  addField,
  updateField,
  reorderFields,
  deleteField,
} from "./db-fields";
import {
  getItems,
  addItem,
  insertItemAt,
  duplicateItem,
  moveItem,
  updateItem,
  deleteItem,
  reorderItems,
  bulkDeleteItems,
  bulkPatchItems,
  runImport,
} from "./db-items";
import {
  getViews,
  addView,
  updateView,
  deleteView,
  getViewConfig,
  updateViewConfig,
  reorderViews,
} from "./db-views";

let db: Database.Database | null = null;
let ftsEnabled = false;

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

export function initDatabase(dbPath: string): boolean {
  if (db) {
    db.close();
  }
  const initResult = initDatabaseConnection(dbPath);
  db = initResult.db;
  ftsEnabled = initResult.ftsEnabled;
  return true;
}

export function handleOperation(operation: DbWorkerOperation): unknown {
  switch (operation.type) {
    case "init": {
      return initDatabase(operation.dbPath);
    }
    case "getCollections": {
      return getCollections(requireDb());
    }
    case "getCollectionItemCounts": {
      return getCollectionItemCounts(requireDb());
    }
    case "addCollection": {
      return addCollection(requireDb(), operation.input);
    }
    case "updateCollection": {
      return updateCollection(requireDb(), operation.input);
    }
    case "deleteCollection": {
      return deleteCollection(requireDb(), operation.id);
    }
    case "getViews": {
      return getViews(requireDb(), operation.collectionId);
    }
    case "addView": {
      return addView(requireDb(), operation.input);
    }
    case "updateView": {
      return updateView(requireDb(), operation.input);
    }
    case "deleteView": {
      return deleteView(requireDb(), operation.id);
    }
    case "getViewConfig": {
      return getViewConfig(requireDb(), operation.viewId);
    }
    case "updateViewConfig": {
      return updateViewConfig(requireDb(), operation.input);
    }
    case "reorderViews": {
      return reorderViews(requireDb(), operation.input);
    }
    case "getFields": {
      return getFields(requireDb(), operation.collectionId);
    }
    case "addField": {
      return addField(requireDb(), operation.input);
    }
    case "updateField": {
      return updateField(requireDb(), operation.input);
    }
    case "reorderFields": {
      return reorderFields(requireDb(), operation.input);
    }
    case "deleteField": {
      return deleteField(requireDb(), operation.id);
    }
    case "getItems": {
      return getItems(requireDb(), operation.input, ftsEnabled);
    }
    case "addItem": {
      return addItem(requireDb(), operation.input);
    }
    case "insertItemAt": {
      return insertItemAt(requireDb(), operation.input);
    }
    case "duplicateItem": {
      return duplicateItem(requireDb(), operation.input);
    }
    case "moveItem": {
      return moveItem(requireDb(), operation.input);
    }
    case "updateItem": {
      return updateItem(requireDb(), operation.input);
    }
    case "deleteItem": {
      return deleteItem(requireDb(), operation.id);
    }
    case "reorderItems": {
      return reorderItems(requireDb(), operation.input);
    }
    case "bulkDeleteItems": {
      return bulkDeleteItems(requireDb(), operation.input);
    }
    case "bulkPatchItems": {
      return bulkPatchItems(requireDb(), operation.input);
    }
    case "importCollection": {
      runImport(requireDb(), operation.input);
      return true;
    }
    case "getArchiveDatabaseSummary": {
      return getArchiveDatabaseSummary(requireDb());
    }
    case "exportFullArchive": {
      return buildFullArchiveExport(requireDb(), operation.input);
    }
    case "restoreFullArchive": {
      return runFullArchiveRestore(requireDb(), operation.input, ftsEnabled);
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
