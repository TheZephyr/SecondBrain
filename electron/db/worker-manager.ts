import { Worker } from "worker_threads";
import { app } from "electron";
import { IpcErrorCode } from "../../src/types/ipc";
import {
  DbWorkerOperation,
  DbWorkerRequest,
  DbWorkerResponse,
} from "./worker-protocol";
import path from "path";

// AppError is defined here since it's used by the manager
export class AppError extends Error {
  code: IpcErrorCode;
  details?: string;

  constructor(code: IpcErrorCode, message: string, details?: string) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export type DbInvokeOptions = {
  timeoutMs?: number;
  allowWhenNotReady?: boolean;
  restartOnTimeout?: boolean;
};

// --- State managed by manager ---
let dbWorker: Worker | null = null;
let dbInitialized = false;
let nextDbRequestId = 1;
let dbPath: string | null = null;
let restartingDbWorker = false;
let appIsQuitting = false;
// --------------------------------

export const DB_REQUEST_TIMEOUT_MS = 10_000;
export const DB_IMPORT_TIMEOUT_MS = 120_000;
export const DB_BULK_TIMEOUT_MS = 30_000;
export const DB_ARCHIVE_TIMEOUT_MS = 180_000;

type PendingDbRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  operation: DbWorkerOperation["type"];
};

const pendingDbRequests = new Map<number, PendingDbRequest>();

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

export function toIpcError(error: unknown, context?: string) {
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

export function failPendingDbRequests(error: AppError) {
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

export async function stopDbWorker(reason?: string): Promise<void> {
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

export async function restartDbWorker(reason: string): Promise<void> {
  if (restartingDbWorker || appIsQuitting || !dbPath || !appIsReady()) {
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

export function invokeDbWorker<T>(
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

export function requireDbPath(): string {
  if (!dbPath) {
    throw new AppError("DB_NOT_READY", "Database path not initialized.");
  }
  return dbPath;
}

export function requireUserDataPath(): string {
  if (!appIsReady()) {
    throw new AppError("UNKNOWN", "Application is not ready.");
  }
  // @ts-ignore - app.getPath is available after app.isReady()
  return app.getPath("userData");
}

export function setDbPath(path: string) {
  dbPath = path;
}

export async function startDbWorker(pathToDb: string): Promise<void> {
  await stopDbWorker("Database worker restarting.");

  const workerPath = path.join(__dirname, "db-worker.js");
  const worker = new Worker(workerPath);

  dbWorker = worker;
  dbInitialized = false;

  worker.on("message", (message: DbWorkerResponse) => {
    handleDbWorkerMessage(message);
  });
  worker.on("error", (error: Error) => {
    console.error("[DB Worker Error]", error);
  });
  worker.on("exit", (code: number) => {
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

export function setAppIsQuitting(quitting: boolean) {
  appIsQuitting = quitting;
}

// Helper to check app readiness - we'll rely on main.ts to provide this context
function appIsReady(): boolean {
  // This is a simple check; in production we'd want a more robust way
  // Since we're in the main process, we can try to access app
  try {
    // @ts-ignore
    return typeof app !== "undefined" && app.isReady();
  } catch {
    return false;
  }
}
