import { app, BrowserWindow, ipcMain, dialog } from "electron";
import type {
  IpcMainInvokeEvent,
  SaveDialogOptions,
  OpenDialogOptions,
} from "electron";
import path from "path";
import fs from "fs";
import { Worker } from "worker_threads";
import type { ZodType } from "zod";
import type {
  ItemData,
  GetItemsInput,
  NewCollectionInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  NewItemInput,
  UpdateItemInput,
  ImportCollectionInput,
} from "../src/types/models";
import type { IpcError, IpcErrorCode, IpcResult } from "../src/types/ipc";
import type {
  DbWorkerOperation,
  DbWorkerRequest,
  DbWorkerResponse,
} from "./db-worker-protocol";
import {
  NewCollectionInputSchema,
  UpdateCollectionInputSchema,
  NewFieldInputSchema,
  UpdateFieldInputSchema,
  NewItemInputSchema,
  UpdateItemInputSchema,
  ImportCollectionInputSchema,
  GetItemsInputSchema,
  itemDataSchema,
  positiveIntSchema,
} from "../src/validation/schemas";

let mainWindow: BrowserWindow | null = null;
let dbWorker: Worker | null = null;
let dbInitialized = false;
let nextDbRequestId = 1;
let dbPath: string | null = null;
let restartingDbWorker = false;
let appIsQuitting = false;

type PendingDbRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  operation: DbWorkerOperation["type"];
};

const pendingDbRequests = new Map<number, PendingDbRequest>();

const isDev = process.env.NODE_ENV === "development";
const DB_REQUEST_TIMEOUT_MS = 10_000;
const DB_IMPORT_TIMEOUT_MS = 120_000;

class AppError extends Error {
  code: IpcErrorCode;
  details?: string;

  constructor(code: IpcErrorCode, message: string, details?: string) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

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

function toIpcError(error: unknown, context?: string): IpcError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      context,
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error.";
  const details =
    error instanceof Error
      ? serializeDetails(error.stack)
      : serializeDetails(error);
  const code: IpcErrorCode = context?.startsWith("db:")
    ? "DB_QUERY_FAILED"
    : "UNKNOWN";

  return {
    code,
    message,
    details,
    context,
  };
}

function parseOrThrow<T>(
  schema: ZodType<T>,
  data: unknown,
  context: string,
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Invalid input.",
      serializeDetails({ context, issues: parsed.error.issues }),
    );
  }

  return parsed.data;
}

function parsePositiveInt(data: unknown, context: string): number {
  return parseOrThrow(positiveIntSchema, data, context);
}

function handleIpc<T, A extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: A) => T | Promise<T>,
) {
  ipcMain.handle(channel, async (event, ...args: A) => {
    try {
      const data = await handler(event, ...args);
      return { ok: true, data } satisfies IpcResult<T>;
    } catch (error) {
      const ipcError = toIpcError(error, channel);
      console.error(`[IPC:${channel}]`, error);
      return { ok: false, error: ipcError } satisfies IpcResult<T>;
    }
  });
}

type DbInvokeOptions = {
  timeoutMs?: number;
  allowWhenNotReady?: boolean;
  restartOnTimeout?: boolean;
};

function failPendingDbRequests(error: AppError) {
  for (const [requestId, pending] of pendingDbRequests.entries()) {
    clearTimeout(pending.timer);
    pendingDbRequests.delete(requestId);
    pending.reject(error);
  }
}

function handleDbWorkerMessage(message: DbWorkerResponse) {
  const pending = pendingDbRequests.get(message.id);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingDbRequests.delete(message.id);

  if (message.ok) {
    pending.resolve(message.data);
    return;
  }

  pending.reject(
    new AppError(
      "DB_QUERY_FAILED",
      message.error.message,
      message.error.details,
    ),
  );
}

async function stopDbWorker(reason?: string): Promise<void> {
  const worker = dbWorker;
  if (!worker) {
    return;
  }

  dbWorker = null;
  dbInitialized = false;

  worker.removeAllListeners("message");
  worker.removeAllListeners("error");
  worker.removeAllListeners("exit");

  failPendingDbRequests(
    new AppError("DB_NOT_READY", "Database worker stopped.", reason),
  );

  try {
    await worker.terminate();
  } catch (error) {
    console.error("[DB Worker] Failed to terminate worker:", error);
  }
}

async function restartDbWorker(reason: string): Promise<void> {
  if (restartingDbWorker || appIsQuitting || !dbPath || !app.isReady()) {
    return;
  }

  restartingDbWorker = true;

  try {
    console.error(`[DB Worker] Restarting worker: ${reason}`);
    await startDbWorker(dbPath);
  } catch (error) {
    console.error("[DB Worker] Failed to restart worker:", error);
  } finally {
    restartingDbWorker = false;
  }
}

function handleDbWorkerExit(worker: Worker, code: number) {
  if (dbWorker !== worker) {
    return;
  }

  dbWorker = null;
  dbInitialized = false;

  const details = `Worker exited with code ${code}.`;
  failPendingDbRequests(
    new AppError("DB_NOT_READY", "Database worker stopped.", details),
  );

  if (!appIsQuitting) {
    void restartDbWorker(details);
  }
}

function invokeDbWorker<T>(
  operation: DbWorkerOperation,
  options: DbInvokeOptions = {},
): Promise<T> {
  const worker = dbWorker;
  if (!worker || (!dbInitialized && !options.allowWhenNotReady)) {
    throw new AppError("DB_NOT_READY", "Database not initialized.");
  }

  const requestId = nextDbRequestId++;
  const timeoutMs = options.timeoutMs ?? DB_REQUEST_TIMEOUT_MS;
  const restartOnTimeout = options.restartOnTimeout ?? true;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const pending = pendingDbRequests.get(requestId);
      if (!pending) {
        return;
      }

      pendingDbRequests.delete(requestId);
      pending.reject(
        new AppError(
          "DB_QUERY_FAILED",
          "Database request timed out.",
          serializeDetails({ operation: pending.operation, timeoutMs }),
        ),
      );

      if (restartOnTimeout) {
        void restartDbWorker(`Request timed out for ${pending.operation}`);
      }
    }, timeoutMs);

    pendingDbRequests.set(requestId, {
      resolve: (value) => resolve(value as T),
      reject,
      timer,
      operation: operation.type,
    });

    const request: DbWorkerRequest = {
      id: requestId,
      operation,
    };

    try {
      worker.postMessage(request);
    } catch (error) {
      clearTimeout(timer);
      pendingDbRequests.delete(requestId);
      reject(
        new AppError(
          "DB_QUERY_FAILED",
          "Failed to dispatch database request.",
          serializeDetails(error),
        ),
      );
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    // Open DevTools after a delay to avoid focus issues
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        mainWindow?.webContents.openDevTools();
      }, 500);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startDbWorker(pathToDb: string): Promise<void> {
  await stopDbWorker("Database worker restarting.");

  const workerPath = path.join(__dirname, "db-worker.js");
  const worker = new Worker(workerPath);

  dbWorker = worker;
  dbInitialized = false;

  worker.on("message", (message: DbWorkerResponse) => {
    handleDbWorkerMessage(message);
  });
  worker.on("error", (error) => {
    console.error("[DB Worker Error]", error);
  });
  worker.on("exit", (code) => {
    handleDbWorkerExit(worker, code);
  });

  try {
    await invokeDbWorker<boolean>(
      {
        type: "init",
        dbPath: pathToDb,
      },
      {
        timeoutMs: DB_IMPORT_TIMEOUT_MS,
        allowWhenNotReady: true,
        restartOnTimeout: false,
      },
    );
    dbInitialized = true;
  } catch (error) {
    await stopDbWorker("Database initialization failed.");
    throw error;
  }
}

async function initDatabase(): Promise<boolean> {
  try {
    dbPath = path.join(app.getPath("userData"), "secondbrain.db");
    await startDbWorker(dbPath);
    return true;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    dialog.showErrorBox(
      "Database Error",
      "Failed to initialize the database. The app will now exit.",
    );
    app.exit(1);
    return false;
  }
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

handleIpc("db:deleteField", async (_, id) => {
  const fieldId = parsePositiveInt(id, "db:deleteField");
  return invokeDbWorker({ type: "deleteField", id: fieldId });
});

// ==================== ITEMS ====================
type ItemRow = {
  id: number;
  collection_id: number;
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
        serializeDetails({
          itemId: item.id,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    const parsedData = itemDataSchema.safeParse(rawData);
    if (!parsedData.success) {
      throw new AppError(
        "DATA_CORRUPT",
        "Failed to parse item data.",
        serializeDetails({
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

handleIpc("db:updateItem", async (_, item: UpdateItemInput) => {
  const input = parseOrThrow(UpdateItemInputSchema, item, "db:updateItem");
  return invokeDbWorker({ type: "updateItem", input });
});

handleIpc("db:deleteItem", async (_, id) => {
  const itemId = parsePositiveInt(id, "db:deleteItem");
  return invokeDbWorker({ type: "deleteItem", id: itemId });
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
handleIpc("export:showSaveDialog", async (_, options: SaveDialogOptions) => {
  if (!mainWindow) {
    throw new AppError("UNKNOWN", "Main window not available.");
  }

  const result = await dialog.showSaveDialog(mainWindow, options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

handleIpc("export:writeFile", async (_, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, "utf-8");
    return true;
  } catch (error) {
    throw new AppError(
      "FS_WRITE_FAILED",
      "Failed to write file.",
      serializeDetails(error),
    );
  }
});

// ==================== IMPORT ====================
handleIpc("import:showOpenDialog", async (_, options: OpenDialogOptions) => {
  if (!mainWindow) {
    throw new AppError("UNKNOWN", "Main window not available.");
  }

  const result = await dialog.showOpenDialog(mainWindow, options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

handleIpc("import:readFile", async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    throw new AppError(
      "FS_READ_FAILED",
      "Failed to read file.",
      serializeDetails(error),
    );
  }
});

app.whenReady().then(async () => {
  const ready = await initDatabase();
  if (!ready) {
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  appIsQuitting = true;
  void stopDbWorker("Application shutting down.");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
