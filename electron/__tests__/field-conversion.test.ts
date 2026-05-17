import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initDatabaseConnection } from "../db/init";
import {
  convertFieldType,
  previewFieldConversion,
} from "../db/field-conversion";
import { FieldType } from "../../src/types/models";

let db: Database.Database;

beforeEach(() => {
  const conn = initDatabaseConnection(":memory:");
  db = conn.db;
  db.exec("INSERT INTO collections (name) VALUES ('Test')");
});

afterEach(() => {
  db.close();
});

let fieldIndex = 0;
function addField(name: string, type: FieldType, options: any = null) {
  const info = db
    .prepare(
      "INSERT INTO fields (collection_id, name, type, options, order_index) VALUES (1, ?, ?, ?, ?)",
    )
    .run(name, type, options ? JSON.stringify(options) : null, fieldIndex++);
  return Number(info.lastInsertRowid);
}

function addItem(data: any) {
  const info = db
    .prepare(
      'INSERT INTO items (collection_id, data, "order") VALUES (1, ?, 0)',
    )
    .run(JSON.stringify(data));
  return Number(info.lastInsertRowid);
}

describe("field-conversion coverage", () => {
  it("covers parseStrictDate non-string and YYYY.MM.DD", () => {
    const fieldId = addField("f", "text");
    addItem({ f: 12345 });
    addItem({ f: "2026.05.10" });
    addItem({ f: "10.05.2026" });
    addItem({ f: "not-a-date" });

    const preview = previewFieldConversion(db, {
      fieldId,
      targetType: "date",
      targetOptions: null,
    });
    expect(preview.convertedCount).toBe(2);
    expect(preview.clearedCount).toBe(2);
  });

  it("covers convertBooleanSource with number and string 1", () => {
    const fieldId = addField("f", "number");
    addItem({ f: 1 });
    addItem({ f: 0 });

    const res = convertFieldType(db, {
      fieldId,
      targetType: "boolean",
      targetOptions: null,
    });
    expect(res.convertedCount).toBe(2);
  });

  it("covers wipe conversions", () => {
    const fieldId = addField("f", "number");
    addItem({ f: 123 });
    const res = convertFieldType(db, {
      fieldId,
      targetType: "date",
      targetOptions: null,
    });
    expect(res.clearedCount).toBe(1);
    expect(res.convertedCount).toBe(0);
  });

  it("covers multiselect to text/longtext", () => {
    const fieldId = addField("f", "multiselect", { choices: ["A", "B"] });
    addItem({ f: JSON.stringify(["A", "B"]) });
    const res = convertFieldType(db, {
      fieldId,
      targetType: "text",
      targetOptions: null,
    });
    expect(res.convertedCount).toBe(1);
    const item = db.prepare("SELECT data FROM items WHERE id=1").get() as any;
    expect(JSON.parse(item.data).f).toBe("A, B");
  });

  it("covers boolean to number", () => {
    const fieldId = addField("f", "boolean");
    addItem({ f: "1" });
    addItem({ f: "0" });
    addItem({ f: 1 });
    addItem({ f: 0 });
    const res = convertFieldType(db, {
      fieldId,
      targetType: "number",
      targetOptions: null,
    });
    expect(res.convertedCount).toBe(4);
    const items = db
      .prepare("SELECT data FROM items ORDER BY id")
      .all() as any[];
    expect(JSON.parse(items[0].data).f).toBe(1);
    expect(JSON.parse(items[1].data).f).toBe(0);
    expect(JSON.parse(items[2].data).f).toBe(1);
    expect(JSON.parse(items[3].data).f).toBe(0);
  });

  it("covers boolean/multiselect to select", () => {
    const field1 = addField("f1", "boolean");
    addItem({ f1: "1" });
    const res1 = convertFieldType(db, {
      fieldId: field1,
      targetType: "select",
      targetOptions: null,
    });
    expect(res1.convertedCount).toBe(1);

    const field2 = addField("f2", "multiselect");
    addItem({ f2: JSON.stringify(["A", "B"]) });
    const res2 = convertFieldType(db, {
      fieldId: field2,
      targetType: "select",
      targetOptions: null,
    });
    expect(res2.convertedCount).toBe(1);
  });

  it("covers boolean to multiselect", () => {
    const fieldId = addField("f", "boolean");
    addItem({ f: "1" });
    const res = convertFieldType(db, {
      fieldId,
      targetType: "multiselect",
      targetOptions: null,
    });
    expect(res.convertedCount).toBe(1);
  });

  it("covers boolean from multiselect, rating, url, fallback", () => {
    const f1 = addField("f1", "multiselect");
    addItem({ f1: JSON.stringify(["A"]) });
    convertFieldType(db, {
      fieldId: f1,
      targetType: "boolean",
      targetOptions: null,
    });

    const f2 = addField("f2", "rating");
    addItem({ f2: 3 });
    convertFieldType(db, {
      fieldId: f2,
      targetType: "boolean",
      targetOptions: null,
    });

    const f3 = addField("f3", "url");
    addItem({ f3: "https://example.com" });
    convertFieldType(db, {
      fieldId: f3,
      targetType: "boolean",
      targetOptions: null,
    });

    const f4 = addField("f4", "text");
    addItem({ f4: "yes" });
    convertFieldType(db, {
      fieldId: f4,
      targetType: "boolean",
      targetOptions: null,
    });
  });

  it("covers boolean to rating", () => {
    const fieldId = addField("f", "boolean");
    addItem({ f: "1" });
    addItem({ f: "0" });
    const res = convertFieldType(db, {
      fieldId,
      targetType: "rating",
      targetOptions: JSON.stringify({ min: 0, max: 5 }),
    });
    expect(res.convertedCount).toBe(2);
  });

  it("covers formatPreviewValue boolean", () => {
    const fieldId = addField("f", "boolean");
    addItem({ f: "1" });
    const preview = previewFieldConversion(db, {
      fieldId,
      targetType: "number",
      targetOptions: null,
    });
    expect(preview.samples[0].before).toBe("true");
  });

  it("covers missing field property", () => {
    const fieldId = addField("f", "text");
    addItem({ other: "test" });
    const res = convertFieldType(db, {
      fieldId,
      targetType: "number",
      targetOptions: null,
    });
    expect(res.affectedCount).toBe(0);
  });

  it("covers failing update field", () => {
    addField("f", "text");
    addItem({ f: "123" });

    const fakeDb = {
      prepare: (sql: string) => {
        return {
          get: () => {
            if (sql.includes("SELECT * FROM fields")) {
              return {
                id: 1,
                collection_id: 1,
                name: "f",
                type: "text",
                options: null,
                order_index: 0,
              };
            }
            return null;
          },
          all: () => {
            if (sql.includes("SELECT id, data FROM items")) {
              return [{ id: 1, data: JSON.stringify({ f: "123" }) }];
            }
            return [];
          },
          run: () => {
            if (sql.includes("UPDATE fields")) {
              return { changes: 0 };
            }
            if (sql.includes("UPDATE items")) {
              return { changes: 0 };
            }
            return { changes: 1 };
          },
        };
      },
      transaction: (cb: any) => cb,
    } as any;

    expect(() =>
      convertFieldType(fakeDb, {
        fieldId: 1,
        targetType: "number",
        targetOptions: null,
      }),
    ).toThrow("Failed to update field 1.");
  });

  it("covers failing update item and schema parse failure", () => {
    const fakeDb = {
      prepare: (sql: string) => {
        return {
          get: () => {
            if (sql.includes("SELECT * FROM fields")) {
              return {
                id: 1,
                collection_id: 1,
                name: "f",
                type: "text",
                options: null,
                order_index: 0,
              };
            }
            return null;
          },
          all: () => {
            if (sql.includes("SELECT id, data FROM items")) {
              return [{ id: 1, data: JSON.stringify({ f: "123" }) }];
            }
            return [];
          },
          run: () => {
            if (sql.includes("UPDATE fields")) return { changes: 1 };
            if (sql.includes("UPDATE items")) return { changes: 0 };
            return { changes: 1 };
          },
        };
      },
      transaction: (cb: any) => cb,
    } as any;

    expect(() =>
      convertFieldType(fakeDb, {
        fieldId: 1,
        targetType: "number",
        targetOptions: null,
      }),
    ).toThrow("Failed to update item 1.");
  });

  it("covers skippedEmptyCount and empty source values", () => {
    const fieldId = addField("f", "text");
    addItem({ f: "" });
    addItem({ f: null });
    const fieldIdMulti = addField("m", "multiselect");
    addItem({ m: "[]" });

    const res1 = convertFieldType(db, {
      fieldId,
      targetType: "number",
      targetOptions: null,
    });
    expect(res1.skippedEmptyCount).toBe(2);

    const res2 = convertFieldType(db, {
      fieldId: fieldIdMulti,
      targetType: "date",
      targetOptions: null,
    });
    expect(res2.skippedEmptyCount).toBe(1);
  });

  it("covers invalid converted data schema", async () => {
    const fieldId = addField("f", "text");
    addItem({ f: "1337" });

    const schemas = await import("../../src/validation/schemas");
    const originalSafeParse = schemas.itemDataSchema.safeParse;
    schemas.itemDataSchema.safeParse = (data: any) => {
      if (data && data.f === 1337) return { success: false, error: {} as any };
      return originalSafeParse(data);
    };

    expect(() =>
      convertFieldType(db, {
        fieldId,
        targetType: "number",
        targetOptions: null,
      }),
    ).toThrow("converted data is invalid");

    schemas.itemDataSchema.safeParse = originalSafeParse;
  });

  it("covers exhaustive switch default", () => {
    const fakeDb = {
      prepare: () => {
        return {
          get: () => ({
            id: 1,
            collection_id: 1,
            name: "f",
            type: "text",
            options: null,
            order_index: 0,
          }),
          all: () => [{ id: 1, data: JSON.stringify({ f: "123" }) }],
          run: () => ({ changes: 1 }),
        };
      },
      transaction: (cb: any) => cb,
    } as any;
    expect(() =>
      convertFieldType(fakeDb, {
        fieldId: 1,
        targetType: "invalid" as any,
        targetOptions: null,
      }),
    ).toThrow();
  });

  it("covers text/number/rating to multiselect", () => {
    const f1 = addField("f1", "text");
    addItem({ f1: "hello" });
    const f2 = addField("f2", "number");
    addItem({ f2: 42 });
    const f3 = addField("f3", "rating");
    addItem({ f3: 5 });

    convertFieldType(db, {
      fieldId: f1,
      targetType: "multiselect",
      targetOptions: null,
    });
    convertFieldType(db, {
      fieldId: f2,
      targetType: "multiselect",
      targetOptions: null,
    });
    convertFieldType(db, {
      fieldId: f3,
      targetType: "multiselect",
      targetOptions: null,
    });
  });

  it("covers text to url", () => {
    const fieldId = addField("f", "text");
    addItem({ f: "example.com" });
    convertFieldType(db, { fieldId, targetType: "url", targetOptions: null });
  });

  it("covers multiselect to rating", () => {
    const fieldId = addField("f", "multiselect");
    addItem({ f: JSON.stringify(["3"]) });
    convertFieldType(db, {
      fieldId,
      targetType: "rating",
      targetOptions: JSON.stringify({ min: 1, max: 5 }),
    });
  });

  it("covers number to text/longtext", () => {
    const fieldId = addField("f", "number");
    addItem({ f: 42 });
    convertFieldType(db, { fieldId, targetType: "text", targetOptions: null });
    convertFieldType(db, {
      fieldId,
      targetType: "longtext",
      targetOptions: null,
    });
  });

  it("covers text to select", () => {
    const fieldId = addField("f", "text");
    addItem({ f: "optionA" });
    convertFieldType(db, {
      fieldId,
      targetType: "select",
      targetOptions: null,
    });
  });
});
