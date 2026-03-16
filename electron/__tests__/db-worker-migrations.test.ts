import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, handleOperation, initDatabase } from "../db-worker";
import type { Field } from "../../src/types/models";

type TempDb = { dbPath: string; dir: string };

const tempDbs: TempDb[] = [];

function createLegacyDb(): TempDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secondbrain-"));
  const dbPath = path.join(dir, "legacy.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'folder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`
    CREATE TABLE fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      options TEXT,
      order_index INTEGER DEFAULT 0
    );
  `);

  db.prepare("INSERT INTO collections (id, name) VALUES (?, ?)").run(
    1,
    "Legacy",
  );
  db.prepare(
    "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)",
  ).run(1, "Body", "textarea", null, 0);
  db.prepare(
    "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (?, ?, ?, ?, ?)",
  ).run(1, "Status", "select", "Open, Closed", 1);

  db.exec("PRAGMA user_version = 4");
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

describe("db migration v5 (field options)", () => {
  it("converts textarea to longtext and select options to JSON", () => {
    const { dbPath } = createLegacyDb();
    initDatabase(dbPath);

    const fields = handleOperation({
      type: "getFields",
      collectionId: 1,
    }) as Field[];

    const byName = new Map(fields.map((field) => [field.name, field]));
    expect(byName.get("Body")?.type).toBe("longtext");
    expect(byName.get("Status")?.options).toBe(
      JSON.stringify({ choices: ["Open", "Closed"] }),
    );
  });

  it("is idempotent", () => {
    const { dbPath } = createLegacyDb();
    initDatabase(dbPath);
    initDatabase(dbPath);

    const fields = handleOperation({
      type: "getFields",
      collectionId: 1,
    }) as Field[];
    const status = fields.find((field) => field.name === "Status");
    expect(status?.options).toBe(
      JSON.stringify({ choices: ["Open", "Closed"] }),
    );
  });
});
