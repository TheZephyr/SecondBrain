import { ipcMain, dialog, app } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import path from "path";
import fs from "fs";
import { ZodType } from "zod";
import type {
  FullArchiveExportInput,
  FullArchiveFile,
  FullArchivePreview,
  FullArchiveRestoreReport,
  FullArchiveDatabaseSummary,
} from "../src/types/models";
import type { IpcResult, IpcError } from "../src/types/ipc";
import { AppError } from "./db-worker-manager";
import {
  buildFullArchiveFileName,
  parseFullArchiveContent,
  buildFullArchivePreviewSummary,
} from "../src/utils/fullArchive";
import {
  archiveFilePathSchema,
  FullArchiveExportInputSchema,
} from "../src/validation/schemas";
import { invokeDbWorker, restartDbWorker } from "./db-worker-manager";

// Import worker manager functions
import {
  stopDbWorker,
  startDbWorker,
  requireDbPath,
} from "./db-worker-manager";

// Helper: parse or throw
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
      JSON.stringify({ context, issues: parsed.error.issues }),
    );
  }
  return parsed.data;
}

// Generic IPC handler wrapper
function handleIpc<T, A extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: A) => T | Promise<T>,
) {
  ipcMain.handle(channel, async (event, ...args: A) => {
    try {
      const data = await handler(event, ...args);
      return { ok: true, data } satisfies IpcResult<T>;
    } catch (error) {
      const ipcError: IpcError =
        error instanceof AppError
          ? { code: error.code, message: error.message, details: error.details }
          : { code: "UNKNOWN", message: "Unknown error." };
      console.error(`[IPC:${channel}]`, error);
      return { ok: false, error: ipcError } satisfies IpcResult<T>;
    }
  });
}

// Archive-specific helper functions (moved from main.ts)
async function readArchiveFromFilePath(filePath: string) {
  let content: string;
  try {
    content = await fs.promises.readFile(filePath, "utf-8");
  } catch (error) {
    throw new AppError(
      "FS_READ_FAILED",
      "Failed to read archive file.",
      error instanceof Error ? error.stack : undefined,
    );
  }

  try {
    return parseFullArchiveContent(content);
  } catch (error) {
    throw new AppError(
      "VALIDATION_FAILED",
      error instanceof Error ? error.message : "Invalid archive file.",
      JSON.stringify({ filePath }),
    );
  }
}

async function exportFullArchiveToDisk(
  input: FullArchiveExportInput,
): Promise<{ filePath: string; stats: FullArchiveFile["stats"] } | null> {
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
      error instanceof Error ? error.stack : undefined,
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

  // We stop the worker before performing the restore operation
  await stopDbWorker("Full archive restore in progress.");

  try {
    const report = await invokeDbWorker<
      Omit<FullArchiveRestoreReport, "preRestoreBackupPath">
    >(
      {
        type: "restoreFullArchive",
        input: archive,
      },
      {
        timeoutMs: 180_000,
      },
    );

    return {
      ...report,
      preRestoreBackupPath: backup.filePath,
    };
  } finally {
    // Always attempt to restart the worker, even if an error occurred
    // The app will relaunch on success, but if there's an error we need to recover
    try {
      await restartDbWorker("Full archive restore completed.");
    } catch (error) {
      console.error(
        "[Archive] Failed to restart database worker after full archive restore:",
        error,
      );
      // If restart fails, we can't do much - the error will propagate
    }
  }
}

// Checkpoint and sidecar helpers (moved from main.ts)
async function checkpointDatabaseFile(targetDbPath: string): Promise<void> {
  if (!(await fs.promises.stat(targetDbPath).catch(() => null))) {
    return;
  }

  const tempDb = new (require("better-sqlite3").default)(targetDbPath);
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

// Import backup module for copyDatabaseToBackup
import { copyDatabaseToBackup } from "./ipc-backup";

// Main window reference (will be set by main.ts)
let mainWindow: any = null;

export function setMainWindow(window: any) {
  mainWindow = window;
}

// Register all archive IPC handlers
export function registerArchiveIpcHandlers() {
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
}
