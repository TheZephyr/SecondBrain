import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, initDatabase } from "../db/worker";

type TempDb = { dbPath: string; dir: string };

const tempDbs: TempDb[] = [];

function createTempDbFile(): TempDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secondbrain-"));
  const dbPath = path.join(dir, "test.db");
  const db = new Database(dbPath);
  db.close();

  const temp = { dbPath, dir };
  tempDbs.push(temp);
  return temp;
}

afterEach(() => {
  closeDatabase();
  while (tempDbs.length > 0) {
    const temp = tempDbs.pop();
    if (!temp) continue;
    fs.rmSync(temp.dir, { recursive: true, force: true });
  }
});

describe("db initialization", () => {
  it("enables WAL journal mode on file-backed databases", () => {
    const { dbPath } = createTempDbFile();
    initDatabase(dbPath);

    const db = new Database(dbPath);
    const row = db.pragma("journal_mode", { simple: true }) as string;
    db.close();

    expect(row).toBe("wal");
  });

  it("is idempotent - initializing the same database twice does not throw", () => {
    const { dbPath } = createTempDbFile();
    expect(() => {
      initDatabase(dbPath);
      initDatabase(dbPath);
    }).not.toThrow();
  });
});
