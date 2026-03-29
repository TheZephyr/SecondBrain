import { app, BrowserWindow, ipcMain, dialog } from "electron";
import type {
  IpcMainInvokeEvent,
  SaveDialogOptions,
  OpenDialogOptions,
} from "electron";
import path from "path";
import type { IpcResult, IpcError } from "../src/types/ipc";
import { AppError } from "./db/worker-manager";
import { tryCreateStartupBackup } from "./lib/backup-utils";
import {
  registerBackupIpcHandlers,
  maybeCreateStartupBackup,
} from "./ipc/backup";
import {
  registerArchiveIpcHandlers,
  setMainWindow as setArchiveMainWindow,
} from "./ipc/archive";
import {
  setDbPath,
  startDbWorker,
  stopDbWorker,
  setAppIsQuitting,
} from "./db/worker-manager";
import { registerDbIpcHandlers } from "./ipc/db";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;

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

  setArchiveMainWindow(mainWindow);
}

async function initDatabase(): Promise<boolean> {
  try {
    const dbPath = path.join(app.getPath("userData"), "secondbrain.db");
    setDbPath(dbPath);
    await tryCreateStartupBackup(maybeCreateStartupBackup);
    await startDbWorker(dbPath);
    return true;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    const { dialog } = await import("electron");
    dialog.showErrorBox(
      "Database Error",
      "Failed to initialize the database. The app will now exit.",
    );
    app.exit(1);
    return false;
  }
}

app.whenReady().then(async () => {
  const ready = await initDatabase();
  if (!ready) return;

  createWindow();

  registerDbIpcHandlers();
  registerBackupIpcHandlers();
  registerArchiveIpcHandlers();

  handleIpc(
    "export:showSaveDialog",
    async (_event, options: SaveDialogOptions) => {
      if (!mainWindow)
        throw new AppError("UNKNOWN", "Main window not available.");
      const result = await dialog.showSaveDialog(mainWindow, options);
      return result.canceled ? null : (result.filePath ?? null);
    },
  );

  handleIpc(
    "import:showOpenDialog",
    async (_event, options: OpenDialogOptions) => {
      if (!mainWindow)
        throw new AppError("UNKNOWN", "Main window not available.");
      const result = await dialog.showOpenDialog(mainWindow, options);
      return result.canceled || result.filePaths.length === 0
        ? null
        : result.filePaths[0];
    },
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  setAppIsQuitting(true);
  void stopDbWorker("Application shutting down.");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
