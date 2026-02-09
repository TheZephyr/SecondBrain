import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type {
  ItemData,
  NewCollectionInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  NewItemInput,
  UpdateItemInput,
} from "../src/types/models";

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: false,
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

function initDatabase() {
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
}

// ==================== COLLECTIONS ====================
ipcMain.handle("db:getCollections", () => {
  if (!db) return [];
  const stmt = db.prepare("SELECT * FROM collections ORDER BY created_at ASC");
  return stmt.all();
});

ipcMain.handle("db:addCollection", (_, collection: NewCollectionInput) => {
  if (!db) return null;

  const stmt = db.prepare("INSERT INTO collections (name, icon) VALUES (?, ?)");
  const info = stmt.run(collection.name, collection.icon || "📁");

  return {
    id: info.lastInsertRowid,
    name: collection.name,
    icon: collection.icon,
  };
});

ipcMain.handle("db:updateCollection", (_, collection: UpdateCollectionInput) => {
  if (!db) return false;

  const stmt = db.prepare(
    "UPDATE collections SET name = ?, icon = ? WHERE id = ?",
  );
  stmt.run(collection.name, collection.icon, collection.id);

  return true;
});

ipcMain.handle("db:deleteCollection", (_, id) => {
  if (!db) return false;

  db.prepare("DELETE FROM collections WHERE id = ?").run(id);
  db.prepare("DELETE FROM fields WHERE collection_id = ?").run(id);
  db.prepare("DELETE FROM items WHERE collection_id = ?").run(id);

  return true;
});

// ==================== FIELDS ====================
ipcMain.handle("db:getFields", (_, collectionId: number) => {
  if (!db) return [];

  const stmt = db.prepare(
    "SELECT * FROM fields WHERE collection_id = ? ORDER BY order_index ASC",
  );
  return stmt.all(collectionId);
});

ipcMain.handle("db:addField", (_, field: NewFieldInput) => {
  if (!db) return null;

  const stmt = db.prepare(
    "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)",
  );
  const info = stmt.run(
    field.collectionId,
    field.name,
    field.type,
    field.options || null,
    field.orderIndex || 0,
  );

  return { id: info.lastInsertRowid, ...field };
});

ipcMain.handle("db:updateField", (_, field: UpdateFieldInput) => {
  if (!db) return false;

  const stmt = db.prepare(
    "UPDATE fields SET name = ?, type = ?, options = ?, order_index = ? WHERE id = ?",
  );
  stmt.run(
    field.name,
    field.type,
    field.options || null,
    field.orderIndex || 0,
    field.id,
  );

  return true;
});

ipcMain.handle("db:deleteField", (_, id) => {
  if (!db) return false;

  db.prepare("DELETE FROM fields WHERE id = ?").run(id);

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

ipcMain.handle("db:getItems", (_, collectionId: number) => {
  if (!db) return [];

  const stmt = db.prepare(
    "SELECT * FROM items WHERE collection_id = ? ORDER BY created_at DESC",
  );
  const items = stmt.all(collectionId) as ItemRow[];

  return items.map((item) => ({
    ...item,
    data: JSON.parse(item.data) as ItemData,
  }));
});

ipcMain.handle("db:addItem", (_, item: NewItemInput) => {
  if (!db) return null;

  const dataJson = JSON.stringify(item.data);
  const stmt = db.prepare(
    "INSERT INTO items (collection_id, data) VALUES (?, ?)",
  );
  const info = stmt.run(item.collectionId, dataJson);

  return {
    id: info.lastInsertRowid,
    collection_id: item.collectionId,
    data: item.data,
  };
});

ipcMain.handle("db:updateItem", (_, item: UpdateItemInput) => {
  if (!db) return false;

  const dataJson = JSON.stringify(item.data);
  const stmt = db.prepare(
    "UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  );
  stmt.run(dataJson, item.id);

  return true;
});

ipcMain.handle("db:deleteItem", (_, id) => {
  if (!db) return false;

  db.prepare("DELETE FROM items WHERE id = ?").run(id);

  return true;
});

// ==================== EXPORT ====================
ipcMain.handle("export:showSaveDialog", async (_, options) => {
  if (!mainWindow) return null;

  const result = await dialog.showSaveDialog(mainWindow, options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

ipcMain.handle("export:writeFile", async (_, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  } catch (error) {
    console.error("Error writing file:", error);
    return false;
  }
});

// ==================== IMPORT ====================
ipcMain.handle("import:showOpenDialog", async (_, options) => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("import:readFile", async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
});

app.whenReady().then(() => {
  initDatabase();
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
