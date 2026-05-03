import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initDatabaseConnection, tryEnableFts } from "../db/init";

type TempDb = {
  dir: string;
  dbPath: string;
};

const tempDbs: TempDb[] = [];
const openDbs: Database.Database[] = [];

function createTempDbPath(): TempDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secondbrain-db-init-"));
  const dbPath = path.join(dir, "test.db");

  const tempDb = { dir, dbPath };
  tempDbs.push(tempDb);
  return tempDb;
}

function trackDb(db: Database.Database): Database.Database {
  openDbs.push(db);
  return db;
}

function countSqliteMasterEntries(
  db: Database.Database,
  type: string,
  name: string,
): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = ? AND name = ?",
    )
    .get(type, name) as { count: number | bigint };

  return typeof row.count === "bigint" ? Number(row.count) : row.count;
}

function getSqliteMasterSql(
  db: Database.Database,
  type: string,
  name: string,
): string | undefined {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = ? AND name = ?")
    .get(type, name) as { sql: string | null } | undefined;

  return row?.sql ?? undefined;
}

afterEach(() => {
  vi.restoreAllMocks();

  while (openDbs.length > 0) {
    const db = openDbs.pop();
    db?.close();
  }

  while (tempDbs.length > 0) {
    const tempDb = tempDbs.pop();
    if (!tempDb) continue;
    fs.rmSync(tempDb.dir, { recursive: true, force: true });
  }
});

describe("db init", () => {
  it("creates the core schema, indexes, and FTS objects", () => {
    const { dbPath } = createTempDbPath();
    const { db, ftsEnabled } = initDatabaseConnection(dbPath);
    trackDb(db);

    expect(ftsEnabled).toBe(true);
    expect(countSqliteMasterEntries(db, "table", "collections")).toBe(1);
    expect(countSqliteMasterEntries(db, "table", "fields")).toBe(1);
    expect(countSqliteMasterEntries(db, "table", "views")).toBe(1);
    expect(countSqliteMasterEntries(db, "table", "items")).toBe(1);
    expect(countSqliteMasterEntries(db, "table", "items_fts")).toBe(1);
    expect(countSqliteMasterEntries(db, "trigger", "items_fts_ai")).toBe(1);
    expect(countSqliteMasterEntries(db, "trigger", "items_fts_au")).toBe(1);
    expect(countSqliteMasterEntries(db, "trigger", "items_fts_ad")).toBe(1);
    expect(
      countSqliteMasterEntries(
        db,
        "index",
        "idx_fields_collection_order_unique",
      ),
    ).toBe(1);
    expect(countSqliteMasterEntries(db, "index", "idx_items_collection_order")).toBe(
      1,
    );
    expect(
      countSqliteMasterEntries(db, "index", "idx_items_collection_created_at_id"),
    ).toBe(1);
    expect(getSqliteMasterSql(db, "index", "idx_fields_collection_order_unique")).toContain(
      "UNIQUE INDEX",
    );
  });

  it("rebuilds the FTS index when item and FTS counts drift", () => {
    const { dbPath } = createTempDbPath();
    const firstInit = initDatabaseConnection(dbPath);
    const firstDb = trackDb(firstInit.db);

    const collectionId = (
      firstDb.prepare("INSERT INTO collections (name) VALUES (?)").run("Books")
        .lastInsertRowid as number
    );
    firstDb
      .prepare(
        "INSERT INTO items (collection_id, data, \"order\") VALUES (?, ?, ?)",
      )
      .run(collectionId, JSON.stringify({ Title: "Dune", Author: "Frank Herbert" }), 0);
    firstDb
      .prepare(
        "INSERT INTO items (collection_id, data, \"order\") VALUES (?, ?, ?)",
      )
      .run(collectionId, JSON.stringify({ Title: "Foundation", Author: "Isaac Asimov" }), 1);

    expect(
      firstDb.prepare("SELECT COUNT(*) AS count FROM items").get() as {
        count: number | bigint;
      },
    ).toMatchObject({ count: 2 });
    expect(
      firstDb.prepare("SELECT COUNT(*) AS count FROM items_fts").get() as {
        count: number | bigint;
      },
    ).toMatchObject({ count: 2 });

    firstDb.prepare("DELETE FROM items_fts").run();
    expect(
      firstDb.prepare("SELECT COUNT(*) AS count FROM items_fts").get() as {
        count: number | bigint;
      },
    ).toMatchObject({ count: 0 });

    firstDb.close();
    openDbs.pop();

    const secondInit = initDatabaseConnection(dbPath);
    const secondDb = trackDb(secondInit.db);

    const itemCountRow = secondDb
      .prepare("SELECT COUNT(*) AS count FROM items")
      .get() as { count: number | bigint };
    const ftsCountRow = secondDb
      .prepare("SELECT COUNT(*) AS count FROM items_fts")
      .get() as { count: number | bigint };

    const itemCount =
      typeof itemCountRow.count === "bigint"
        ? Number(itemCountRow.count)
        : itemCountRow.count;
    const ftsCount =
      typeof ftsCountRow.count === "bigint" ? Number(ftsCountRow.count) : ftsCountRow.count;

    expect(itemCount).toBe(2);
    expect(ftsCount).toBe(2);

    const searchRow = secondDb
      .prepare("SELECT rowid FROM items_fts WHERE items_fts MATCH ?")
      .get('"Frank"') as { rowid: number } | undefined;
    expect(searchRow?.rowid).toBeGreaterThan(0);
  });

  it("adds the description column even when the database user_version is already set", () => {
    const { dbPath } = createTempDbPath();
    const seedDb = trackDb(new Database(dbPath));

    seedDb.exec(`
      CREATE TABLE collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'folder',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        options TEXT,
        order_index INTEGER DEFAULT 0
      );

      CREATE TABLE views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'grid',
        is_default INTEGER NOT NULL DEFAULT 0,
        "order" INTEGER NOT NULL DEFAULT 0,
        config TEXT DEFAULT NULL
      );

      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        "order" INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    seedDb.pragma("user_version = 1");
    seedDb.close();
    openDbs.pop();

    const { db } = initDatabaseConnection(dbPath);
    trackDb(db);

    const columns = db
      .prepare("PRAGMA table_info(fields)")
      .all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === "description")).toBe(true);
    expect(Number(db.pragma("user_version", { simple: true }))).toBe(2);
  });

  it("falls back cleanly when FTS setup fails", () => {
    const originalExec = Database.prototype.exec;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const execSpy = vi
      .spyOn(Database.prototype, "exec")
      .mockImplementation(function (
        this: Database.Database,
        sql: string,
      ): Database.Database {
        if (sql.includes("CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5")) {
          throw new Error("fts5 unavailable");
        }

        return originalExec.call(this, sql);
      });

    const { dbPath } = createTempDbPath();
    const result = initDatabaseConnection(dbPath);
    const db = trackDb(result.db);

    expect(execSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(result.ftsEnabled).toBe(false);
    expect(countSqliteMasterEntries(db, "table", "collections")).toBe(1);
    expect(countSqliteMasterEntries(db, "table", "items")).toBe(1);
    expect(countSqliteMasterEntries(db, "table", "items_fts")).toBe(0);
    expect(countSqliteMasterEntries(db, "trigger", "items_fts_ai")).toBe(0);
    expect(countSqliteMasterEntries(db, "trigger", "items_fts_au")).toBe(0);
    expect(countSqliteMasterEntries(db, "trigger", "items_fts_ad")).toBe(0);
  });

  it("tryEnableFts returns false when FTS creation throws", () => {
    const { dbPath } = createTempDbPath();
    const db = trackDb(new Database(dbPath));

    const originalExec = Database.prototype.exec;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Database.prototype, "exec").mockImplementation(function (
      this: Database.Database,
      sql: string,
    ): Database.Database {
      if (sql.includes("CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5")) {
        throw new Error("fts5 unavailable");
      }

      return originalExec.call(this, sql);
    });

    expect(tryEnableFts(db)).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});
