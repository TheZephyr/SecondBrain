import Database from "better-sqlite3";
import { toNumber } from "./db-query-utils";

type CountRow = { count: number | bigint };

export const FIELD_ORDER_UNIQUE_INDEX = "idx_fields_collection_order_unique";

export function rebuildItemFtsIndex(database: Database.Database) {
  const rebuildTransaction = database.transaction(() => {
    database.prepare("DELETE FROM items_fts").run();
    database
      .prepare(
        `
        INSERT INTO items_fts(rowid, content)
        SELECT
          i.id,
          COALESCE(
            (
              SELECT group_concat(CAST(value AS TEXT), ' ')
              FROM json_each(i.data)
              WHERE json_each.type IN ('text', 'integer', 'real')
            ),
            ''
          )
        FROM items i
        `,
      )
      .run();
  });

  rebuildTransaction();
}

export function syncItemFtsIndex(database: Database.Database) {
  const itemCountRow = database
    .prepare("SELECT COUNT(*) AS count FROM items")
    .get() as CountRow;
  const ftsCountRow = database
    .prepare("SELECT COUNT(*) AS count FROM items_fts")
    .get() as CountRow;

  if (toNumber(itemCountRow.count) !== toNumber(ftsCountRow.count)) {
    rebuildItemFtsIndex(database);
  }
}

export function tryEnableFts(database: Database.Database): boolean {
  try {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        content,
        tokenize = 'unicode61'
      )
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS items_fts_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, content)
        VALUES (
          new.id,
          COALESCE(
            (
              SELECT group_concat(CAST(value AS TEXT), ' ')
              FROM json_each(new.data)
              WHERE json_each.type IN ('text', 'integer', 'real')
            ),
            ''
          )
        );
      END;
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS items_fts_au AFTER UPDATE OF data ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.id;
        INSERT INTO items_fts(rowid, content)
        VALUES (
          new.id,
          COALESCE(
            (
              SELECT group_concat(CAST(value AS TEXT), ' ')
              FROM json_each(new.data)
              WHERE json_each.type IN ('text', 'integer', 'real')
            ),
            ''
          )
        );
      END;
    `);

    database.exec(`
      CREATE TRIGGER IF NOT EXISTS items_fts_ad AFTER DELETE ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.id;
      END;
    `);

    syncItemFtsIndex(database);
    return true;
  } catch (error) {
    console.error(
      "[DB Worker] FTS unavailable. Falling back to LIKE search.",
      error,
    );
    return false;
  }
}

export function initDatabaseConnection(dbPath: string): { db: Database.Database, ftsEnabled: boolean } {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  // 1. Collections Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'folder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Fields Table + Unique Order Index
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
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${FIELD_ORDER_UNIQUE_INDEX}
    ON fields(collection_id, order_index)
  `);

  // 3. Views Table (must be created here)
  db.exec(`
    CREATE TABLE IF NOT EXISTS views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'grid',
      is_default INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 0,
      config TEXT DEFAULT NULL,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `);

  // 4. Items Table (must include "order" column)
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      "order" INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `);
  // Add necessary item indexes (order index)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_collection_order
    ON items (collection_id, "order" ASC)
  `);
  
  // Keep existing created_at index
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_collection_created_at_id
    ON items (collection_id, created_at DESC, id DESC)
  `);

  // 5. Set final user version (must be set unconditionally)
  db.exec("PRAGMA user_version = 1");

  // 6. FTS setup
  const ftsEnabled = tryEnableFts(db);

  return { db, ftsEnabled };
}
