import { dialog, app } from "electron";
import fs from "fs";
import type {
  FullArchiveExportInput,
  FullArchiveFile,
  FullArchivePreview,
  FullArchiveRestoreReport,
  FullArchiveDatabaseSummary,
} from "../../src/types/models";
import { AppError } from "../db/worker-manager";
import {
  buildFullArchiveFileName,
  parseFullArchiveContent,
  buildFullArchivePreviewSummary,
} from "../../src/utils/fullArchive";
import {
  archiveFilePathSchema,
  FullArchiveExportInputSchema,
} from "../../src/validation/schemas";
import { invokeDbWorker } from "../db/worker-manager";
import { copyDatabaseToBackup } from "./backup";
import type { BrowserWindow } from "electron";
import { parseOrThrow, handleIpc } from "./utils";

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

  try {
    const report = await invokeDbWorker<
      Omit<FullArchiveRestoreReport, "preRestoreBackupPath">
    >({ type: "restoreFullArchive", input: archive }, { timeoutMs: 180_000 });
    return { ...report, preRestoreBackupPath: backup.filePath };
  } catch (error) {
    console.error("[Archive] Full archive restore failed:", error);
    throw error;
  }
}

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow) {
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
