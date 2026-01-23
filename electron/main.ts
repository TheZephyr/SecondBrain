import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'

let mainWindow: BrowserWindow | null = null
let db: Database.Database | null = null

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Open DevTools after a delay to avoid focus issues
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        mainWindow?.webContents.openDevTools()
      }, 500)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  db = new Database(dbPath)

  // Create collections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

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
  `)

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
  `)
}

// ==================== COLLECTIONS ====================
ipcMain.handle('db:getCollections', () => {
  if (!db) return []
  const stmt = db.prepare('SELECT * FROM collections ORDER BY created_at ASC')
  return stmt.all()
})

ipcMain.handle('db:addCollection', (_, collection) => {
  if (!db) return null
  
  const stmt = db.prepare('INSERT INTO collections (name, icon) VALUES (?, ?)')
  const info = stmt.run(collection.name, collection.icon || '📁')
  
  return { id: info.lastInsertRowid, name: collection.name, icon: collection.icon }
})

ipcMain.handle('db:updateCollection', (_, collection) => {
  if (!db) return false
  
  const stmt = db.prepare('UPDATE collections SET name = ?, icon = ? WHERE id = ?')
  stmt.run(collection.name, collection.icon, collection.id)
  
  return true
})

ipcMain.handle('db:deleteCollection', (_, id) => {
  if (!db) return false
  
  db.prepare('DELETE FROM collections WHERE id = ?').run(id)
  db.prepare('DELETE FROM fields WHERE collection_id = ?').run(id)
  db.prepare('DELETE FROM items WHERE collection_id = ?').run(id)
  
  return true
})

// ==================== FIELDS ====================
ipcMain.handle('db:getFields', (_, collectionId) => {
  if (!db) return []
  
  const stmt = db.prepare('SELECT * FROM fields WHERE collection_id = ? ORDER BY order_index ASC')
  return stmt.all(collectionId)
})

ipcMain.handle('db:addField', (_, field) => {
  if (!db) return null
  
  const stmt = db.prepare(
    'INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)'
  )
  const info = stmt.run(
    field.collectionId,
    field.name,
    field.type,
    field.options || null,
    field.orderIndex || 0
  )
  
  return { id: info.lastInsertRowid, ...field }
})

ipcMain.handle('db:updateField', (_, field) => {
  if (!db) return false
  
  const stmt = db.prepare(
    'UPDATE fields SET name = ?, type = ?, options = ?, order_index = ? WHERE id = ?'
  )
  stmt.run(field.name, field.type, field.options || null, field.orderIndex || 0, field.id)
  
  return true
})

ipcMain.handle('db:deleteField', (_, id) => {
  if (!db) return false
  
  db.prepare('DELETE FROM fields WHERE id = ?').run(id)
  
  return true
})

// ==================== ITEMS ====================
ipcMain.handle('db:getItems', (_, collectionId) => {
  if (!db) return []
  
  const stmt = db.prepare('SELECT * FROM items WHERE collection_id = ? ORDER BY created_at DESC')
  const items = stmt.all(collectionId)
  
  return items.map((item: any) => ({
    ...item,
    data: JSON.parse(item.data)
  }))
})

ipcMain.handle('db:addItem', (_, item) => {
  if (!db) return null
  
  const dataJson = JSON.stringify(item.data)
  const stmt = db.prepare('INSERT INTO items (collection_id, data) VALUES (?, ?)')
  const info = stmt.run(item.collectionId, dataJson)
  
  return { id: info.lastInsertRowid, collection_id: item.collectionId, data: item.data }
})

ipcMain.handle('db:updateItem', (_, item) => {
  if (!db) return false
  
  const dataJson = JSON.stringify(item.data)
  const stmt = db.prepare('UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  stmt.run(dataJson, item.id)
  
  return true
})

ipcMain.handle('db:deleteItem', (_, id) => {
  if (!db) return false
  
  db.prepare('DELETE FROM items WHERE id = ?').run(id)
  
  return true
})

app.whenReady().then(() => {
  initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (db) db.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})