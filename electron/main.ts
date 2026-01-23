import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import initSqlJs from 'sql.js'

let mainWindow: BrowserWindow | null = null
let db: any = null
let SQL: any = null

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  
  const wasmPath = isDev
    ? path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    : path.join(__dirname, 'sql-wasm.wasm')
  
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (file === 'sql-wasm.wasm') {
        return wasmPath
      }
      return file
    }
  })
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // Create collections table
  db.run(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📁',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create fields table
  db.run(`
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
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `)
  
  saveDatabase(dbPath)
}

function saveDatabase(dbPath: string) {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

function execToArray(query: string, params: any[] = []) {
  const result = db.exec(query, params)
  if (result.length === 0) return []
  
  const columns = result[0].columns
  const values = result[0].values
  
  return values.map((row: any[]) => {
    const obj: any = {}
    columns.forEach((col: string, index: number) => {
      obj[col] = row[index]
    })
    return obj
  })
}

// ==================== COLLECTIONS ====================
ipcMain.handle('db:getCollections', () => {
  if (!db) return []
  return execToArray('SELECT * FROM collections ORDER BY created_at ASC')
})

ipcMain.handle('db:addCollection', (_, collection) => {
  if (!db) return null
  
  db.run(
    'INSERT INTO collections (name, icon) VALUES (?, ?)',
    [collection.name, collection.icon || '📁']
  )
  
  const result = db.exec('SELECT last_insert_rowid() as id')
  const newId = result[0].values[0][0]
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return { id: newId, name: collection.name, icon: collection.icon }
})

ipcMain.handle('db:updateCollection', (_, collection) => {
  if (!db) return false
  
  db.run(
    'UPDATE collections SET name = ?, icon = ? WHERE id = ?',
    [collection.name, collection.icon, collection.id]
  )
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

ipcMain.handle('db:deleteCollection', (_, id) => {
  if (!db) return false
  
  db.run('DELETE FROM collections WHERE id = ?', [id])
  db.run('DELETE FROM fields WHERE collection_id = ?', [id])
  db.run('DELETE FROM items WHERE collection_id = ?', [id])
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

// ==================== FIELDS ====================
ipcMain.handle('db:getFields', (_, collectionId) => {
  if (!db) return []
  const stmt = db.prepare('SELECT * FROM fields WHERE collection_id = ? ORDER BY order_index ASC')
  stmt.bind([collectionId])
  
  const fields = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    fields.push(row)
  }
  stmt.free()
  
  return fields
})

ipcMain.handle('db:addField', (_, field) => {
  if (!db) return null
  
  db.run(
    'INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)',
    [field.collectionId, field.name, field.type, field.options || null, field.orderIndex || 0]
  )
  
  const result = db.exec('SELECT last_insert_rowid() as id')
  const newId = result[0].values[0][0]
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return { id: newId, ...field }
})

ipcMain.handle('db:updateField', (_, field) => {
  if (!db) return false
  
  db.run(
    'UPDATE fields SET name = ?, type = ?, options = ?, order_index = ? WHERE id = ?',
    [field.name, field.type, field.options || null, field.orderIndex || 0, field.id]
  )
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

ipcMain.handle('db:deleteField', (_, id) => {
  if (!db) return false
  
  db.run('DELETE FROM fields WHERE id = ?', [id])
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

// ==================== ITEMS ====================
ipcMain.handle('db:getItems', (_, collectionId) => {
  if (!db) return []
  const stmt = db.prepare('SELECT * FROM items WHERE collection_id = ? ORDER BY created_at DESC')
  stmt.bind([collectionId])
  
  const items = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    items.push({
      ...row,
      data: JSON.parse(row.data)
    })
  }
  stmt.free()
  
  return items
})

ipcMain.handle('db:addItem', (_, item) => {
  if (!db) return null
  
  const dataJson = JSON.stringify(item.data)
  
  db.run(
    'INSERT INTO items (collection_id, data) VALUES (?, ?)',
    [item.collectionId, dataJson]
  )
  
  const result = db.exec('SELECT last_insert_rowid() as id')
  const newId = result[0].values[0][0]
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return { id: newId, collection_id: item.collectionId, data: item.data }
})

ipcMain.handle('db:updateItem', (_, item) => {
  if (!db) return false
  
  const dataJson = JSON.stringify(item.data)
  
  db.run(
    'UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [dataJson, item.id]
  )
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

ipcMain.handle('db:deleteItem', (_, id) => {
  if (!db) return false
  
  db.run('DELETE FROM items WHERE id = ?', [id])
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

app.whenReady().then(async () => {
  await initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (db) {
    const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
    saveDatabase(dbPath)
    db.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})