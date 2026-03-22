import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import type {
  IpcMainInvokeEvent,
  SaveDialogOptions,
  OpenDialogOptions,
} from "electron";
import path from "path";
import fs from "fs";
import { Worker } from "worker_threads";
import Database from "better-sqlite3";
import type { ZodType } from "zod";
import type {
  BackupEntry,
  BackupLabel,
  BackupSettings,
  FullArchiveDatabaseSummary,
  FullArchiveExportInput,
  FullArchiveFile,
  FullArchiveExportResult,
  FullArchivePreview,
  FullArchiveRestoreReport,
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
  BulkMutationResult,
  ImportCollectionInput,
  ReorderItemsInput,
  UpdateBackupSettingsInput,
} from "../src/types/models";
import type { IpcError, IpcErrorCode, IpcResult } from "../src/types/ipc";
import type {
  DbWorkerOperation,
  DbWorkerRequest,
  DbWorkerResponse,
} from "./db-worker-protocol";
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
  backupFileNameSchema,
  archiveFilePathSchema,
  FullArchiveExportInputSchema,
  UpdateBackupSettingsInputSchema,
} from "../src/validation/schemas";
import {
  buildFullArchiveFileName,
  buildFullArchivePreviewSummary,
  parseFullArchiveContent,
} from "../src/utils/fullArchive";
import {
  buildBackupFileName,
  ensureBackupDirectory,
  getBackupRetentionLimit,
  listBackups as listBackupsFromDisk,
  loadBackupSettings,
  partitionBackups,
  pruneBackupSet,
  saveBackupSettings,
  tryCreateStartupBackup,
} from "./backup-utils";

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
const DB_BULK_TIMEOUT_MS = 30_000;
const DB_ARCHIVE_TIMEOUT_MS = 180_000;

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
    await tryCreateStartupBackup(maybeCreateStartupBackup);
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

function requireDbPath(): string {
  if (!dbPath) {
    throw new AppError("DB_NOT_READY", "Database path not initialized.");
  }
  return dbPath;
}

function requireUserDataPath(): string {
  if (!app.isReady()) {
    throw new AppError("UNKNOWN", "Application is not ready.");
  }
  return app.getPath("userData");
}

async function checkpointDatabaseFile(targetDbPath: string): Promise<void> {
  if (!(await fs.promises.stat(targetDbPath).catch(() => null))) {
    return;
  }

  const tempDb = new Database(targetDbPath);
  try {
    tempDb.pragma("busy_timeout = 5000");
    tempDb.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    tempDb.close();
  }
}

async function removeDbSidecars(targetDbPath: string): Promise<void> {
  await Promise.all(
    [`${targetDbPath}-wal`, `${targetDbPath}-shm`].map((filePath) =>
      fs.promises.unlink(filePath).catch(() => undefined),
    ),
  );
}

async function copyDatabaseToBackup(
  label: BackupLabel,
  excludeFromPruning?: string[],
): Promise<BackupEntry> {
  const liveDbPath = requireDbPath();
  const userDataPath = requireUserDataPath();

  if (!(await fs.promises.stat(liveDbPath).catch(() => null))) {
    throw new AppError("FS_READ_FAILED", "Database file does not exist.");
  }

  await stopDbWorker(`Creating ${label} backup.`);
  
  try {
    await checkpointDatabaseFile(liveDbPath);

    const backupDirectory = await ensureBackupDirectory(userDataPath);
    const fileName = buildBackupFileName(label);
    const destinationPath = path.join(backupDirectory, fileName);
    await fs.promises.copyFile(liveDbPath, destinationPath);

    const backups = await listBackupsFromDisk(userDataPath);
    const created = backups.find((backup) => backup.fileName === fileName);
    if (!created) {
      throw new AppError("FS_READ_FAILED", "Backup file was not created.");
    }

    const settings = await loadBackupSettings(userDataPath);
    const limit = getBackupRetentionLimit(settings, label);
    const buckets = partitionBackups(backups);
    const excludeSet = new Set(excludeFromPruning ?? []);
    if (label === "startup") {
      const filtered = buckets.automatic.filter(
        (b) => !excludeSet.has(b.fileName),
      );
      await pruneBackupSet(filtered, limit);
    } else {
      const filtered = buckets.manual.filter((b) => !excludeSet.has(b.fileName));
      await pruneBackupSet(filtered, limit);
    }

    return created;
  } finally {
    // Always attempt to restart the database worker, even if an error occurred
    try {
      await startDbWorker(liveDbPath);
    } catch (error) {
      console.error(`[Backup] Failed to restart database worker after ${label} backup:`, error);
      // Re-throw the original error if we had one, otherwise throw the restart error
      throw error;
    }
  }
}

async function maybeCreateStartupBackup(): Promise<void> {
  const liveDbPath = requireDbPath();
  const userDataPath = requireUserDataPath();
  const settings = await loadBackupSettings(userDataPath);

  if (!settings.automaticBackupsEnabled) {
    return;
  }
  if (!(await fs.promises.stat(liveDbPath).catch(() => null))) {
    return;
  }

  await checkpointDatabaseFile(liveDbPath);
  const backupDirectory = await ensureBackupDirectory(userDataPath);
  const fileName = buildBackupFileName("startup");
  await fs.promises.copyFile(liveDbPath, path.join(backupDirectory, fileName));

  const backups = await listBackupsFromDisk(userDataPath);
  await pruneBackupSet(
    partitionBackups(backups).automatic,
    settings.automaticBackupsLimit,
  );
}

async function restoreBackupFromFileName(fileName: string): Promise<boolean> {
  const userDataPath = requireUserDataPath();
  const liveDbPath = requireDbPath();
  const backups = await listBackupsFromDisk(userDataPath);
  const backup = backups.find((entry) => entry.fileName === fileName);
  if (!backup) {
    throw new AppError("FS_READ_FAILED", "Backup file not found.");
  }

  await copyDatabaseToBackup("pre_restore", [backup.fileName]);
  await stopDbWorker("Restore backup requested.");
  await checkpointDatabaseFile(backup.filePath);
  await removeDbSidecars(liveDbPath);
  await fs.promises.copyFile(backup.filePath, liveDbPath);
  await removeDbSidecars(liveDbPath);

  app.relaunch();
  app.exit(0);
  return true;
}

async function readArchiveFromFilePath(filePath: string) {
  let content: string;
  try {
    content = await fs.promises.readFile(filePath, "utf-8");
  } catch (error) {
    throw new AppError(
      "FS_READ_FAILED",
      "Failed to read archive file.",
      serializeDetails(error),
    );
  }

  try {
    return parseFullArchiveContent(content);
  } catch (error) {
    throw new AppError(
      "VALIDATION_FAILED",
      error instanceof Error ? error.message : "Invalid archive file.",
      serializeDetails({ filePath }),
    );
  }
}

async function exportFullArchiveToDisk(
  input: FullArchiveExportInput,
): Promise<FullArchiveExportResult | null> {
  if (!mainWindow) {
    throw new AppError("UNKNOWN", "Main window not available.");
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Full Archive",
    defaultPath: buildFullArchiveFileName(),
    filters: [
      { name: "JSON Files", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const archive = await invokeDbWorker<FullArchiveFile>({
    type: "exportFullArchive",
    input: {
      appVersion: app.getVersion(),
      description: input.description,
    },
  });

  try {
    await fs.promises.writeFile(
      result.filePath,
      `${JSON.stringify(archive, null, 2)}\n`,
      "utf-8",
    );
  } catch (error) {
    throw new AppError(
      "FS_WRITE_FAILED",
      "Failed to write archive file.",
      serializeDetails(error),
    );
  }

  return {
    filePath: result.filePath,
    stats: archive.stats,
  };
}

async function previewFullArchiveRestore(): Promise<FullArchivePreview | null> {
  if (!mainWindow) {
    throw new AppError("UNKNOWN", "Main window not available.");
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select Full Archive",
    filters: [
      { name: "JSON Files", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const archive = await readArchiveFromFilePath(filePath);
  const currentDbSummary = await invokeDbWorker<FullArchiveDatabaseSummary>({
    type: "getArchiveDatabaseSummary",
  });

  return buildFullArchivePreviewSummary(filePath, archive, currentDbSummary);
}

async function restoreFullArchiveFromFilePath(
  filePath: string,
): Promise<FullArchiveRestoreReport> {
  const archive = await readArchiveFromFilePath(filePath);
  const backup = await copyDatabaseToBackup("pre_restore");
  const report = await invokeDbWorker<Omit<FullArchiveRestoreReport, "preRestoreBackupPath">>(
    {
      type: "restoreFullArchive",
      input: archive,
    },
    {
      timeoutMs: DB_ARCHIVE_TIMEOUT_MS,
    },
  );

  await restartDbWorker("Full archive restore completed.");

  return {
    ...report,
    preRestoreBackupPath: backup.filePath,
  };
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
  return invokeDbWorker<BulkMutationResult>(
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
  return invokeDbWorker<BulkMutationResult>(
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

// ==================== FULL ARCHIVE ====================
handleIpc(
  "archive:exportFull",
  async (_, payload: FullArchiveExportInput) => {
    const input = parseOrThrow(
      FullArchiveExportInputSchema,
      payload,
      "archive:exportFull",
    );
    return exportFullArchiveToDisk(input);
  },
);

handleIpc("archive:previewRestore", async () => {
  return previewFullArchiveRestore();
});

handleIpc("archive:restore", async (_, filePath: string) => {
  const parsedFilePath = parseOrThrow(
    archiveFilePathSchema,
    filePath,
    "archive:restore",
  );
  return restoreFullArchiveFromFilePath(parsedFilePath);
});

// ==================== BACKUPS ====================
handleIpc("backup:getSettings", async () => {
  return loadBackupSettings(requireUserDataPath());
});

handleIpc(
  "backup:updateSettings",
  async (_, payload: UpdateBackupSettingsInput) => {
    const input = parseOrThrow(
      UpdateBackupSettingsInputSchema,
      payload,
      "backup:updateSettings",
    );
    return saveBackupSettings(requireUserDataPath(), input);
  },
);

handleIpc("backup:list", async () => {
  return listBackupsFromDisk(requireUserDataPath());
});

handleIpc("backup:createManual", async () => {
  return copyDatabaseToBackup("manual");
});

handleIpc("backup:restore", async (_, fileName: string) => {
  const parsedFileName = parseOrThrow(
    backupFileNameSchema,
    fileName,
    "backup:restore",
  );
  return restoreBackupFromFileName(parsedFileName);
});

handleIpc("backup:delete", async (_, fileName: string) => {
  const parsedFileName = parseOrThrow(
    backupFileNameSchema,
    fileName,
    "backup:delete",
  );
  const backupDirectory = await ensureBackupDirectory(requireUserDataPath());
  await fs.promises.unlink(path.join(backupDirectory, parsedFileName));
  return true;
});

handleIpc("backup:openFolder", async () => {
  const backupDirectory = await ensureBackupDirectory(requireUserDataPath());
  await shell.openPath(backupDirectory);
  return true;
});

// ==================== EXTERNAL ====================
handleIpc("openExternal", async (_, url: string) => {
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    throw new AppError("VALIDATION_FAILED", "Invalid URL.");
  }

  await shell.openExternal(url);
  return;
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
