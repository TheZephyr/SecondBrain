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
  
  // Find the correct path to sql-wasm.wasm
  const wasmPath = isDev
    ? path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    : path.join(__dirname, 'sql-wasm.wasm')
  
  // Initialize SQL.js with the wasm file location
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (file === 'sql-wasm.wasm') {
        return wasmPath
      }
      return file
    }
  })
  
  // Check if database file exists
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // Create all tables
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      release_date TEXT,
      genre TEXT,
      rating INTEGER,
      status TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      publication_year INTEGER,
      genre TEXT,
      pages INTEGER,
      rating INTEGER,
      status TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      director TEXT,
      release_year INTEGER,
      genre TEXT,
      duration INTEGER,
      rating INTEGER,
      status TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

function execToArray(query: string) {
  const result = db.exec(query)
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

// ==================== GAMES IPC HANDLERS ====================
ipcMain.handle('db:getGames', () => {
  if (!db) return []
  return execToArray('SELECT * FROM games ORDER BY title')
})

ipcMain.handle('db:addGame', (_, game) => {
  if (!db) return null
  
  db.run(
    `INSERT INTO games (title, release_date, genre, rating, status, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [game.title, game.releaseDate, game.genre, game.rating, game.status, game.note]
  )
  
  const result = db.exec('SELECT last_insert_rowid() as id')
  const newId = result[0].values[0][0]
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return { id: newId, ...game }
})

ipcMain.handle('db:updateGame', (_, game) => {
  if (!db) return false
  
  db.run(
    `UPDATE games 
     SET title = ?, release_date = ?, genre = ?, rating = ?, status = ?, note = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [game.title, game.releaseDate, game.genre, game.rating, game.status, game.note, game.id]
  )
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

ipcMain.handle('db:deleteGame', (_, id) => {
  if (!db) return false
  
  db.run('DELETE FROM games WHERE id = ?', [id])
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

// ==================== BOOKS IPC HANDLERS ====================
ipcMain.handle('db:getBooks', () => {
  if (!db) return []
  return execToArray('SELECT * FROM books ORDER BY title')
})

ipcMain.handle('db:addBook', (_, book) => {
  if (!db) return null
  
  db.run(
    `INSERT INTO books (title, author, publication_year, genre, pages, rating, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [book.title, book.author, book.publicationYear, book.genre, book.pages, book.rating, book.status, book.note]
  )
  
  const result = db.exec('SELECT last_insert_rowid() as id')
  const newId = result[0].values[0][0]
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return { id: newId, ...book }
})

ipcMain.handle('db:updateBook', (_, book) => {
  if (!db) return false
  
  db.run(
    `UPDATE books 
     SET title = ?, author = ?, publication_year = ?, genre = ?, pages = ?, rating = ?, status = ?, note = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [book.title, book.author, book.publicationYear, book.genre, book.pages, book.rating, book.status, book.note, book.id]
  )
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

ipcMain.handle('db:deleteBook', (_, id) => {
  if (!db) return false
  
  db.run('DELETE FROM books WHERE id = ?', [id])
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

// ==================== MOVIES IPC HANDLERS ====================
ipcMain.handle('db:getMovies', () => {
  if (!db) return []
  return execToArray('SELECT * FROM movies ORDER BY title')
})

ipcMain.handle('db:addMovie', (_, movie) => {
  if (!db) return null
  
  db.run(
    `INSERT INTO movies (title, director, release_year, genre, duration, rating, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [movie.title, movie.director, movie.releaseYear, movie.genre, movie.duration, movie.rating, movie.status, movie.note]
  )
  
  const result = db.exec('SELECT last_insert_rowid() as id')
  const newId = result[0].values[0][0]
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return { id: newId, ...movie }
})

ipcMain.handle('db:updateMovie', (_, movie) => {
  if (!db) return false
  
  db.run(
    `UPDATE movies 
     SET title = ?, director = ?, release_year = ?, genre = ?, duration = ?, rating = ?, status = ?, note = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [movie.title, movie.director, movie.releaseYear, movie.genre, movie.duration, movie.rating, movie.status, movie.note, movie.id]
  )
  
  const dbPath = path.join(app.getPath('userData'), 'secondbrain.db')
  saveDatabase(dbPath)
  
  return true
})

ipcMain.handle('db:deleteMovie', (_, id) => {
  if (!db) return false
  
  db.run('DELETE FROM movies WHERE id = ?', [id])
  
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