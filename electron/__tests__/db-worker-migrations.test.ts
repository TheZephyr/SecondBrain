import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, handleOperation, initDatabase } from "../db-worker";
import type { Field, ItemData } from "../../src/types/models";

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
  it("enables WAL journal mode on file-backed databases", () => {
    const { dbPath } = createTempDbFile();
    initDatabase(dbPath);

    const db = new Database(dbPath);
    const row = db.pragma("journal_mode", { simple: true }) as string;
    db.close();

    expect(row).toBe("wal");
  });

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

  it("migrates item data when a field is renamed", () => {
    const { dbPath } = createTempDbFile();
    initDatabase(dbPath);

    // Create a collection
    const collection = handleOperation({
      type: "addCollection",
      input: { name: "Test Collection", icon: "folder" },
    }) as { id: number; name: string };

    // Add a field
    const field = handleOperation({
      type: "addField",
      input: {
        collectionId: collection.id,
        name: "oldName",
        type: "text",
        options: null,
        orderIndex: 0,
      },
    }) as Field;

    // Add an item with data under the old field name
    const itemData: ItemData = { oldName: "test value" };
    const item = handleOperation({
      type: "addItem",
      input: {
        collectionId: collection.id,
        data: itemData,
      },
    }) as { id: number; collection_id: number; data: ItemData };

    // Verify the item data is stored correctly
    const itemsBefore = handleOperation({
      type: "getItems",
      input: {
        collectionId: collection.id,
        limit: 10,
        offset: 0,
        search: undefined,
        sort: undefined,
      },
    }) as { items: any[]; total: number; limit: number; offset: number };

    expect(itemsBefore.items).toHaveLength(1);
    expect(JSON.parse(itemsBefore.items[0].data)).toEqual({ oldName: "test value" });

    // Rename the field
    const renameResult = handleOperation({
      type: "updateField",
      input: {
        id: field.id,
        name: "newName",
        type: "text",
        options: null,
        orderIndex: 0,
      },
    }) as boolean;

    expect(renameResult).toBe(true);

    // Verify the field name was updated
    const fieldsAfter = handleOperation({
      type: "getFields",
      collectionId: collection.id,
    }) as Field[];

    const renamedField = fieldsAfter.find((f) => f.id === field.id);
    expect(renamedField?.name).toBe("newName");

    // Verify the item data was migrated
    const itemsAfter = handleOperation({
      type: "getItems",
      input: {
        collectionId: collection.id,
        limit: 10,
        offset: 0,
        search: undefined,
        sort: undefined,
      },
    }) as { items: any[]; total: number; limit: number; offset: number };

    expect(itemsAfter.items).toHaveLength(1);
    expect(JSON.parse(itemsAfter.items[0].data)).toEqual({ newName: "test value" });
  });

  it("does not migrate data when field name is unchanged", () => {
    const { dbPath } = createTempDbFile();
    initDatabase(dbPath);

    // Create a collection
    const collection = handleOperation({
      type: "addCollection",
      input: { name: "Test Collection", icon: "folder" },
    }) as { id: number; name: string };

    // Add a field
    const field = handleOperation({
      type: "addField",
      input: {
        collectionId: collection.id,
        name: "fieldName",
        type: "text",
        options: null,
        orderIndex: 0,
      },
    }) as Field;

    // Add an item with data
    const itemData: ItemData = { fieldName: "test value" };
    handleOperation({
      type: "addItem",
      input: {
        collectionId: collection.id,
        data: itemData,
      },
    });

    // Update field without changing name
    const updateResult = handleOperation({
      type: "updateField",
      input: {
        id: field.id,
        name: "fieldName", // Same name
        type: "longtext", // Different type
        options: null,
        orderIndex: 0,
      },
    }) as boolean;

    expect(updateResult).toBe(true);

    // Verify the item data is unchanged
    const itemsAfter = handleOperation({
      type: "getItems",
      input: {
        collectionId: collection.id,
        limit: 10,
        offset: 0,
        search: undefined,
        sort: undefined,
      },
    }) as { items: any[]; total: number; limit: number; offset: number };

    expect(itemsAfter.items).toHaveLength(1);
    expect(JSON.parse(itemsAfter.items[0].data)).toEqual({ fieldName: "test value" });
  });
});
