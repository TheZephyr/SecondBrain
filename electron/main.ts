import { app, BrowserWindow, ipcMain, dialog } from "electron";
import type {
  IpcMainInvokeEvent,
  SaveDialogOptions,
  OpenDialogOptions,
} from "electron";
import path from "path";
import { tryCreateStartupBackup } from "./lib/backup-utils";
import {
  registerBackupIpcHandlers,
  maybeCreateStartupBackup,
} from "./ipc/backup";
import { registerArchiveIpcHandlers } from "./ipc/archive";
import { setMainWindow as setArchiveMainWindow } from "./ipc/archive";
import {
  setDbPath,
  startDbWorker,
  stopDbWorker,
  setAppIsQuitting,
} from "./db/worker-manager";
import { registerDbIpcHandlers } from "./ipc/db";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;

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

  // Provide main window reference to archive module for dialogs
  setArchiveMainWindow(mainWindow);
}

async function initDatabase(): Promise<boolean> {
  try {
    const dbPath = path.join(app.getPath("userData"), "secondbrain.db");
    setDbPath(dbPath);

    // Create startup backup before starting worker
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
  if (!ready) {
    return;
  }

  createWindow();

  // Register all IPC handlers
  registerDbIpcHandlers();
  registerBackupIpcHandlers();
  registerArchiveIpcHandlers();

  // Register main-window-specific handlers that need dialog access
  ipcMain.handle(
    "export:showSaveDialog",
    async (event: IpcMainInvokeEvent, options: SaveDialogOptions) => {
      if (!mainWindow) {
        throw new Error("Main window not available");
      }
      const result = await dialog.showSaveDialog(mainWindow, options);
      if (result.canceled || !result.filePath) {
        return null;
      }
      return result.filePath;
    },
  );

  ipcMain.handle(
    "import:showOpenDialog",
    async (event: IpcMainInvokeEvent, options: OpenDialogOptions) => {
      if (!mainWindow) {
        throw new Error("Main window not available");
      }
      const result = await dialog.showOpenDialog(mainWindow, options);
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    },
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  setAppIsQuitting(true);
  void stopDbWorker("Application shutting down.");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
