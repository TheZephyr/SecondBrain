import { app, BrowserWindow, ipcMain, dialog } from "electron";
import type {
  IpcMainInvokeEvent,
  SaveDialogOptions,
  OpenDialogOptions,
} from "electron";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type { ZodType } from "zod";
import type {
  ItemData,
  NewCollectionInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  NewItemInput,
  UpdateItemInput,
} from "../src/types/models";
import type { IpcError, IpcErrorCode, IpcResult } from "../src/types/ipc";
import {
  NewCollectionInputSchema,
  UpdateCollectionInputSchema,
  NewFieldInputSchema,
  UpdateFieldInputSchema,
  NewItemInputSchema,
  UpdateItemInputSchema,
  itemDataSchema,
  positiveIntSchema,
} from "../src/validation/schemas";

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

const isDev = process.env.NODE_ENV === "development";

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

function requireDb(): Database.Database {
  if (!db) {
    throw new AppError("DB_NOT_READY", "Database not initialized.");
  }

  return db;
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

function initDatabase(): boolean {
  try {
    const dbPath = path.join(app.getPath("userData"), "secondbrain.db");
    db = new Database(dbPath);

    // Create collections table
    db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Create fields table
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

    // Create items table
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
handleIpc("db:getCollections", () => {
  const database = requireDb();
  const stmt = database.prepare(
    "SELECT * FROM collections ORDER BY created_at ASC",
  );
  return stmt.all();
});

handleIpc("db:addCollection", (_, collection: NewCollectionInput) => {
  const database = requireDb();
  const input = parseOrThrow(
    NewCollectionInputSchema,
    collection,
    "db:addCollection",
  );

  const stmt = database.prepare(
    "INSERT INTO collections (name, icon) VALUES (?, ?)",
  );
  const info = stmt.run(input.name, input.icon || "📁");

  return {
    id: Number(info.lastInsertRowid),
    name: input.name,
    icon: input.icon,
  };
});

handleIpc("db:updateCollection", (_, collection: UpdateCollectionInput) => {
  const database = requireDb();
  const input = parseOrThrow(
    UpdateCollectionInputSchema,
    collection,
    "db:updateCollection",
  );

  const stmt = database.prepare(
    "UPDATE collections SET name = ?, icon = ? WHERE id = ?",
  );
  stmt.run(input.name, input.icon, input.id);

  return true;
});

handleIpc("db:deleteCollection", (_, id) => {
  const database = requireDb();
  const collectionId = parsePositiveInt(id, "db:deleteCollection");
  const deleteCollection = database.transaction((collectionId: number) => {
    database.prepare("DELETE FROM collections WHERE id = ?").run(collectionId);
    database
      .prepare("DELETE FROM fields WHERE collection_id = ?")
      .run(collectionId);
    database
      .prepare("DELETE FROM items WHERE collection_id = ?")
      .run(collectionId);
  });

  deleteCollection(collectionId);
  return true;
});

// ==================== FIELDS ====================
handleIpc("db:getFields", (_, collectionId: number) => {
  const database = requireDb();
  const parsedCollectionId = parsePositiveInt(collectionId, "db:getFields");
  const stmt = database.prepare(
    "SELECT * FROM fields WHERE collection_id = ? ORDER BY order_index ASC",
  );
  return stmt.all(parsedCollectionId);
});

handleIpc("db:addField", (_, field: NewFieldInput) => {
  const database = requireDb();
  const input = parseOrThrow(NewFieldInputSchema, field, "db:addField");
  const stmt = database.prepare(
    "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)",
  );
  const info = stmt.run(
    input.collectionId,
    input.name,
    input.type,
    input.options || null,
    input.orderIndex || 0,
  );

  return { id: Number(info.lastInsertRowid), ...input };
});

handleIpc("db:updateField", (_, field: UpdateFieldInput) => {
  const database = requireDb();
  const input = parseOrThrow(UpdateFieldInputSchema, field, "db:updateField");
  const stmt = database.prepare(
    "UPDATE fields SET name = ?, type = ?, options = ?, order_index = ? WHERE id = ?",
  );
  stmt.run(
    input.name,
    input.type,
    input.options || null,
    input.orderIndex || 0,
    input.id,
  );

  return true;
});

handleIpc("db:deleteField", (_, id) => {
  const database = requireDb();
  const fieldId = parsePositiveInt(id, "db:deleteField");
  database.prepare("DELETE FROM fields WHERE id = ?").run(fieldId);

  return true;
});

// ==================== ITEMS ====================
type ItemRow = {
  id: number;
  collection_id: number;
  data: string;
  created_at?: string;
  updated_at?: string;
};

handleIpc("db:getItems", (_, collectionId: number) => {
  const database = requireDb();
  const parsedCollectionId = parsePositiveInt(collectionId, "db:getItems");
  const stmt = database.prepare(
    "SELECT * FROM items WHERE collection_id = ? ORDER BY created_at DESC",
  );
  const items = stmt.all(parsedCollectionId) as ItemRow[];

  return items.map((item) => {
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
});

handleIpc("db:addItem", (_, item: NewItemInput) => {
  const database = requireDb();
  const input = parseOrThrow(NewItemInputSchema, item, "db:addItem");
  const dataJson = JSON.stringify(input.data);
  const stmt = database.prepare(
    "INSERT INTO items (collection_id, data) VALUES (?, ?)",
  );
  const info = stmt.run(input.collectionId, dataJson);

  return {
    id: Number(info.lastInsertRowid),
    collection_id: input.collectionId,
    data: input.data,
  };
});

handleIpc("db:updateItem", (_, item: UpdateItemInput) => {
  const database = requireDb();
  const input = parseOrThrow(UpdateItemInputSchema, item, "db:updateItem");
  const dataJson = JSON.stringify(input.data);
  const stmt = database.prepare(
    "UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  );
  stmt.run(dataJson, input.id);

  return true;
});

handleIpc("db:deleteItem", (_, id) => {
  const database = requireDb();
  const itemId = parsePositiveInt(id, "db:deleteItem");
  database.prepare("DELETE FROM items WHERE id = ?").run(itemId);

  return true;
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
    fs.writeFileSync(filePath, content, "utf-8");
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
    const content = fs.readFileSync(filePath, "utf-8");
    return content;
  } catch (error) {
    throw new AppError(
      "FS_READ_FAILED",
      "Failed to read file.",
      serializeDetails(error),
    );
  }
});

app.whenReady().then(() => {
  const ready = initDatabase();
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

app.on("window-all-closed", () => {
  if (db) db.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
