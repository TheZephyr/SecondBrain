import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  exportFullArchive,
  getArchiveDatabaseSummary,
  restoreFullArchive,
} from "../lib/full-archive";
import { getViewConfig as readViewConfig } from "../db/views";
import type { FullArchiveFile } from "../../src/types/models";

type ViewRow = {
  id: number;
  name: string;
  type: string;
  is_default: number;
  order: number;
  config: string | null;
};

type ItemRow = {
  id: number;
  order: number;
  data: string;
};

function createTestDatabase(): Database.Database {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'folder',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT DEFAULT NULL,
      options TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE TABLE views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 0,
      config TEXT DEFAULT NULL,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );
  `);
  return database;
}

function withTestDatabase<T>(callback: (database: Database.Database) => T): T {
  const database = createTestDatabase();
  try {
    return callback(database);
  } finally {
    database.close();
  }
}

function insertCollection(database: Database.Database, name: string): number {
  const info = database
    .prepare("INSERT INTO collections (name) VALUES (?)")
    .run(name);
  return Number(info.lastInsertRowid);
}

function insertField(
  database: Database.Database,
  input: {
    collectionId: number;
    name: string;
    type: string;
    description?: string | null;
    options: string | null;
    orderIndex: number;
  },
): number {
  const info = database
    .prepare(
      "INSERT INTO fields (collection_id, name, type, description, options, order_index) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.collectionId,
      input.name,
      input.type,
      input.description ?? null,
      input.options,
      input.orderIndex,
    );
  return Number(info.lastInsertRowid);
}

function insertView(
  database: Database.Database,
  input: {
    collectionId: number;
    name: string;
    type: string;
    isDefault: number;
    order: number;
    config: Record<string, unknown> | null;
  },
): number {
  const info = database
    .prepare(
      'INSERT INTO views (collection_id, name, type, is_default, "order", config) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      input.collectionId,
      input.name,
      input.type,
      input.isDefault,
      input.order,
      input.config ? JSON.stringify(input.config) : null,
    );
  return Number(info.lastInsertRowid);
}

function insertItem(
  database: Database.Database,
  input: {
    collectionId: number;
    order: number;
    data: string;
  },
): number {
  const info = database
    .prepare('INSERT INTO items (collection_id, data, "order") VALUES (?, ?, ?)')
    .run(input.collectionId, input.data, input.order);
  return Number(info.lastInsertRowid);
}

function readViews(database: Database.Database, collectionId: number): ViewRow[] {
  return database
    .prepare(
      'SELECT id, name, type, is_default, "order", config FROM views WHERE collection_id = ? ORDER BY "order" ASC, id ASC',
    )
    .all(collectionId) as ViewRow[];
}

function readItems(database: Database.Database, collectionId: number): ItemRow[] {
  return database
    .prepare(
      'SELECT id, "order", data FROM items WHERE collection_id = ? ORDER BY "order" ASC, id ASC',
    )
    .all(collectionId) as ItemRow[];
}

describe("full archive summary", () => {
  it("reports empty and populated database totals", () => {
    withTestDatabase((database) => {
      expect(getArchiveDatabaseSummary(database)).toEqual({
        isEmpty: true,
        collectionCount: 0,
        totalFieldCount: 0,
        totalItemCount: 0,
        collectionNames: [],
      });

      insertCollection(database, "Books");
      const notesCollectionId = insertCollection(database, "Notes");
      insertField(database, {
        collectionId: notesCollectionId,
        name: "Title",
        type: "text",
        options: null,
        orderIndex: 0,
      });
      insertItem(
        database,
        {
          collectionId: notesCollectionId,
          order: 0,
          data: JSON.stringify({ Title: "First note" }),
        },
      );

      expect(getArchiveDatabaseSummary(database)).toEqual({
        isEmpty: false,
        collectionCount: 2,
        totalFieldCount: 1,
        totalItemCount: 1,
        collectionNames: ["Books", "Notes"],
      });
    });
  });
});

describe("full archive export", () => {
  it("normalizes fields, items, and view configs when exporting", () => {
    withTestDatabase((database) => {
      const collectionId = insertCollection(database, "Books");
      const titleFieldId = insertField(database, {
        collectionId,
        name: "Title",
        type: "text",
        options: null,
        orderIndex: 0,
      });
      insertField(database, {
        collectionId,
        name: "Description",
        type: "longtext",
        options: JSON.stringify({
          richText: true,
          defaultValue: "Intro",
          uniqueCheck: true,
        }),
        orderIndex: 1,
      });
      insertField(database, {
        collectionId,
        name: "Count",
        type: "number",
        options: JSON.stringify({
          defaultValue: 12,
          uniqueCheck: true,
        }),
        orderIndex: 2,
      });
      insertField(database, {
        collectionId,
        name: "CountCopy",
        type: "url",
        options: JSON.stringify({
          defaultValue: "https://example.com",
          uniqueCheck: true,
        }),
        orderIndex: 2,
      });
      insertField(database, {
        collectionId,
        name: "Status",
        type: "select",
        options: JSON.stringify({
          choices: ["To Read", "Done"],
          defaultValue: "Done",
        }),
        orderIndex: 4,
      });
      insertField(database, {
        collectionId,
        name: "Tags",
        type: "multiselect",
        options: JSON.stringify({
          choices: ["Sci-Fi", "Classic"],
          defaultValue: ["Sci-Fi"],
          uniqueCheck: true,
        }),
        orderIndex: 5,
      });
      insertField(database, {
        collectionId,
        name: "Read",
        type: "boolean",
        options: JSON.stringify({ icon: "heart" }),
        orderIndex: 6,
      });
      insertField(database, {
        collectionId,
        name: "Rating",
        type: "rating",
        options: JSON.stringify({
          icon: "star",
          color: "#ff0",
          min: 1,
          max: 10,
          defaultValue: 3,
          uniqueCheck: true,
        }),
        orderIndex: 7,
      });
      insertField(database, {
        collectionId,
        name: "MysteryNull",
        type: "mystery",
        options: null,
        orderIndex: 8,
      });
      insertField(database, {
        collectionId,
        name: "MysteryBadJson",
        type: "mystery",
        options: "{not json",
        orderIndex: 9,
      });
      insertField(database, {
        collectionId,
        name: "MysteryArray",
        type: "mystery",
        options: "[]",
        orderIndex: 10,
      });
      insertField(database, {
        collectionId,
        name: "MysteryPrimitive",
        type: "mystery",
        options: "1",
        orderIndex: 11,
      });
      insertField(database, {
        collectionId,
        name: "MysteryObject",
        type: "mystery",
        options: JSON.stringify({ keep: true }),
        orderIndex: 12,
      });

      insertItem(database, {
        collectionId,
        order: 0,
        data: JSON.stringify({
          Title: "Dune",
          Description: "Novel",
          Count: 7,
          CountCopy: "https://example.com/dune",
          Status: "Done",
          Tags: JSON.stringify(["Sci-Fi", "Classic"]),
          Read: "1",
          Rating: 4,
        }),
      });
      insertItem(database, {
        collectionId,
        order: 1,
        data: "{not json",
      });

      const gridViewId = insertView(database, {
        collectionId,
        name: "Board",
        type: "grid",
        isDefault: 1,
        order: 0,
        config: {
          columnWidths: {
            [titleFieldId]: 240,
            999: 300,
          },
          sort: [{ field: "data.Title", order: 1 }],
          selectedFieldIds: [titleFieldId, 999],
        },
      });
      insertView(database, {
        collectionId,
        name: "Pipeline",
        type: "kanban",
        isDefault: 0,
        order: 1,
        config: {
          columnWidths: {},
          sort: [],
          groupingFieldId: 999,
          kanbanColumnOrder: ["Todo", "Doing"],
          selectedFieldIds: [titleFieldId, 999],
        },
      });
      insertView(database, {
        collectionId,
        name: "Calendar",
        type: "calendar",
        isDefault: 0,
        order: 2,
        config: {
          columnWidths: {},
          sort: [],
          calendarDateFieldId: 999,
          calendarDateField: "  Release Date  ",
          selectedFieldIds: [titleFieldId, 999],
        },
      });
      insertView(database, {
        collectionId,
        name: "CalendarEmpty",
        type: "calendar",
        isDefault: 0,
        order: 3,
        config: {
          columnWidths: {},
          sort: [],
          calendarDateFieldId: 999,
          selectedFieldIds: [titleFieldId],
        },
      });

      const archive = exportFullArchive(database, {
        appVersion: "0.3.0",
        description: "test archive",
      });
      const collection = archive.collections[0];
      const boardView = collection?.views.find((view) => view.name === "Board");
      const pipelineView = collection?.views.find(
        (view) => view.name === "Pipeline",
      );
      const calendarView = collection?.views.find(
        (view) => view.name === "Calendar",
      );
      const calendarEmptyView = collection?.views.find(
        (view) => view.name === "CalendarEmpty",
      );

      const fieldsByName = new Map(
        collection?.fields.map((field) => [field.name, field]) ?? [],
      );

      expect(collection?.fields.map((field) => field.name)).toEqual([
        "Title",
        "Description",
        "Count",
        "CountCopy",
        "Status",
        "Tags",
        "Read",
        "Rating",
        "MysteryNull",
        "MysteryBadJson",
        "MysteryArray",
        "MysteryPrimitive",
        "MysteryObject",
      ]);
      expect(fieldsByName.get("Description")?.options).toEqual({
        richText: true,
        defaultValue: "Intro",
        uniqueCheck: true,
      });
      expect(fieldsByName.get("Count")?.options).toEqual({
        defaultValue: 12,
        showAsChip: false,
        showThousandsSeparator: false,
        colorScale: null,
        uniqueCheck: true,
      });
      expect(fieldsByName.get("CountCopy")?.options).toEqual({
        defaultValue: "https://example.com",
        uniqueCheck: true,
      });
      expect(fieldsByName.get("MysteryNull")?.options).toBeNull();
      expect(fieldsByName.get("MysteryBadJson")?.options).toBeNull();
      expect(fieldsByName.get("MysteryArray")?.options).toBeNull();
      expect(fieldsByName.get("MysteryPrimitive")?.options).toBeNull();
      expect(fieldsByName.get("MysteryObject")?.options).toEqual({ keep: true });

      expect(collection?.items).toHaveLength(2);
      expect(collection?.items[0]?.data).toEqual({
        Title: "Dune",
        Description: "Novel",
        Count: 7,
        CountCopy: "https://example.com/dune",
        Status: "Done",
        Tags: ["Sci-Fi", "Classic"],
        Read: true,
        Rating: 4,
      });
      expect(collection?.items[1]?.data).toEqual({
        Title: null,
        Description: null,
        Count: null,
        CountCopy: null,
        Status: null,
        Tags: [],
        Read: false,
        Rating: null,
      });

      expect(boardView?.config).toEqual({
        columnWidths: {
          Title: 240,
        },
        sort: [{ field: "Title", order: 1 }],
        selectedFields: ["Title"],
      });
      expect(pipelineView?.config).toEqual({
        groupingField: null,
        columnOrder: ["Todo", "Doing"],
        selectedFields: ["Title"],
      });
      expect(calendarView?.config).toEqual({
        dateField: "Release Date",
        selectedFields: ["Title"],
      });
      expect(calendarEmptyView?.config).toEqual({
        dateField: null,
        selectedFields: ["Title"],
      });
      expect(archive.stats).toEqual({
        collectionCount: 1,
        totalFieldCount: 13,
        totalItemCount: 2,
      });
      expect(gridViewId).toBeGreaterThan(0);
    });
  });
});

describe("full archive restore", () => {
  it("restores valid archives while dropping missing references and keeping order ties stable", () => {
    withTestDatabase((database) => {
      const archive: FullArchiveFile = {
        type: "full_archive",
        version: 1,
        appVersion: "0.3.0",
        exportedAt: "2026-03-22T14:30:00.000Z",
        description: "restore test",
        stats: {
          collectionCount: 1,
          totalFieldCount: 6,
          totalItemCount: 3,
        },
        collections: [
          {
            name: "Books",
            exportedAt: "2026-03-22T14:30:00.000Z",
            stats: {
              fieldCount: 6,
              itemCount: 3,
            },
            fields: [
              {
                name: "Title",
                type: "text",
                orderIndex: 0,
                options: {
                  defaultValue: null,
                  uniqueCheck: false,
                },
              },
              {
                name: " Bad",
                type: "text",
                orderIndex: 0,
                options: {
                  defaultValue: null,
                  uniqueCheck: false,
                },
              },
              {
                name: "Description",
                type: "longtext",
                orderIndex: 1,
                options: {
                  richText: true,
                  defaultValue: "Intro",
                  uniqueCheck: true,
                },
              },
              {
                name: "Tags",
                type: "multiselect",
                orderIndex: 2,
                options: {
                  choices: ["Sci-Fi", "Classic"],
                  optionColors: {},
                  defaultValue: ["Sci-Fi"],
                  uniqueCheck: true,
                },
              },
              {
                name: "Done",
                type: "boolean",
                orderIndex: 3,
                options: {
                  icon: "heart",
                },
              },
              {
                name: "Rating",
                type: "rating",
                orderIndex: 4,
                options: {
                  icon: "star",
                  color: "#ff0",
                  min: 1,
                  max: 10,
                  defaultValue: 3,
                  uniqueCheck: true,
                },
              },
              {
                name: "Count",
                type: "number",
                orderIndex: 5,
                options: {
                  defaultValue: 12,
                  showAsChip: false,
                  showThousandsSeparator: false,
                  colorScale: null,
                  uniqueCheck: true,
                },
              },
              {
                name: "Mystery",
                type: "mystery",
                orderIndex: 6,
                options: {},
              },
            ],
            views: [
              {
                name: "Board",
                type: "grid",
                isDefault: true,
                order: 1,
                config: {
                  columnWidths: {
                    Title: 240,
                    MissingWidth: 180,
                  },
                  sort: [
                    { field: "data.Title", order: 1 },
                    { field: "data.MissingSort", order: -1 },
                  ],
                  selectedFields: ["Title", "MissingSelected"],
                },
              },
              {
                name: "Pipeline",
                type: "kanban",
                isDefault: false,
                order: 1,
                config: {
                  groupingField: "MissingGroup",
                  columnOrder: ["Todo", "Doing"],
                  selectedFields: ["Title", "MissingSelected"],
                },
              },
              {
                name: "Calendar",
                type: "calendar",
                isDefault: false,
                order: 2,
                config: {
                  dateField: "Title",
                  selectedFields: ["Title", "MissingSelected"],
                },
              },
              {
                name: "CalendarMissing",
                type: "calendar",
                isDefault: false,
                order: 3,
                config: {
                  dateField: "MissingDate",
                  selectedFields: ["Title", "MissingSelected"],
                },
              },
            ],
            items: [
              {
                order: 0,
                data: {
                  Title: "Dune",
                  Description: "Novel",
                  Tags: ["Sci-Fi", "Classic"],
                  Done: true,
                  Rating: 4,
                  Count: 7,
                },
              },
              {
                order: 0,
                data: {
                  Title: "Dune Messiah",
                  Description: null,
                  Done: false,
                  Rating: null,
                  Count: null,
                },
              },
            ],
          },
        ],
      };

      const report = restoreFullArchive(database, archive, false);
      const collectionRow = database
        .prepare("SELECT id, name FROM collections LIMIT 1")
        .get() as { id: number; name: string } | undefined;

      expect(report.restoredCollections).toEqual(["Books"]);
      expect(report.failedCollections).toEqual([]);
      expect(report.skippedEntities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            scope: "field",
            name: " Bad",
            type: "text",
            reason: "Unsafe field name.",
          }),
          expect.objectContaining({
            scope: "field",
            name: "Mystery",
            type: "mystery",
            reason: "Unknown field type.",
          }),
        ]),
      );
      expect(report.droppedViewReferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            referenceType: "columnWidth",
            referenceValue: "MissingWidth",
          }),
          expect.objectContaining({
            referenceType: "sort",
            referenceValue: "data.Title",
          }),
          expect.objectContaining({
            referenceType: "sort",
            referenceValue: "data.MissingSort",
          }),
          expect.objectContaining({
            referenceType: "selectedField",
            referenceValue: "MissingSelected",
          }),
          expect.objectContaining({
            referenceType: "groupingField",
            referenceValue: "MissingGroup",
          }),
          expect.objectContaining({
            referenceType: "dateField",
            referenceValue: "MissingDate",
          }),
        ]),
      );
      expect(report.statMismatches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            scope: "total",
            stat: "itemCount",
            expected: 3,
            actual: 2,
          }),
          expect.objectContaining({
            scope: "collection",
            collectionName: "Books",
            stat: "itemCount",
            expected: 3,
            actual: 2,
          }),
        ]),
      );

      expect(collectionRow).toEqual(expect.objectContaining({ name: "Books" }));
      const collectionId = collectionRow?.id ?? 0;
      const fields = database
        .prepare(
          'SELECT id, name, type, order_index FROM fields WHERE collection_id = ? ORDER BY order_index ASC, id ASC',
        )
        .all(collectionId) as Array<{
        id: number;
        name: string;
        type: string;
        order_index: number;
      }>;
      expect(fields.map((field) => field.name)).toEqual([
        "Title",
        "Description",
        "Tags",
        "Done",
        "Rating",
        "Count",
      ]);

      const views = readViews(database, collectionId);
      expect(views.map((view) => view.name)).toEqual([
        "Board",
        "Pipeline",
        "Calendar",
        "CalendarMissing",
      ]);
      expect(readViewConfig(database, views[0]?.id ?? 0)).toMatchObject({
        columnWidths: {
          [fields[0]?.id ?? 0]: 240,
        },
        sort: [],
        selectedFieldIds: [fields[0]?.id ?? 0],
      });
      expect(readViewConfig(database, views[1]?.id ?? 0)).toMatchObject({
        columnWidths: {},
        sort: [],
        selectedFieldIds: [fields[0]?.id ?? 0],
      });
      expect(readViewConfig(database, views[1]?.id ?? 0)?.groupingFieldId).toBeUndefined();
      expect(readViewConfig(database, views[2]?.id ?? 0)).toMatchObject({
        columnWidths: {},
        sort: [],
        calendarDateFieldId: fields[0]?.id,
        selectedFieldIds: [fields[0]?.id ?? 0],
      });
      expect(readViewConfig(database, views[3]?.id ?? 0)).toMatchObject({
        columnWidths: {},
        sort: [],
        selectedFieldIds: [fields[0]?.id ?? 0],
      });

      const items = readItems(database, collectionId);
      expect(items).toHaveLength(2);
      expect(JSON.parse(items[0]?.data ?? "{}")).toEqual({
        Title: "Dune",
        Description: "Novel",
        Tags: JSON.stringify(["Sci-Fi", "Classic"]),
        Done: "1",
        Rating: 4,
        Count: 7,
      });
      expect(JSON.parse(items[1]?.data ?? "{}")).toEqual({
        Title: "Dune Messiah",
        Description: null,
        Tags: JSON.stringify([]),
        Done: "0",
        Rating: null,
        Count: null,
      });
    });
  });

  it("returns null configs for unsupported grid, kanban, and calendar archive views", () => {
    withTestDatabase((database) => {
      const archive: FullArchiveFile = {
        type: "full_archive",
        version: 1,
        appVersion: "0.3.0",
        exportedAt: "2026-03-22T14:30:00.000Z",
        description: "",
        stats: {
          collectionCount: 1,
          totalFieldCount: 0,
          totalItemCount: 0,
        },
        collections: [
          {
            name: "Empty",
            exportedAt: "2026-03-22T14:30:00.000Z",
            stats: {
              fieldCount: 0,
              itemCount: 0,
            },
            fields: [],
            views: [
              {
                name: "Grid",
                type: "grid",
                isDefault: true,
                order: 0,
                config: {},
              },
              {
                name: "Kanban",
                type: "kanban",
                isDefault: false,
                order: 1,
                config: {},
              },
              {
                name: "Calendar",
                type: "calendar",
                isDefault: false,
                order: 2,
                config: {},
              },
            ],
            items: [],
          },
        ],
      };

      const report = restoreFullArchive(database, archive, false);
      const collectionRow = database
        .prepare("SELECT id FROM collections LIMIT 1")
        .get() as { id: number } | undefined;
      const views = collectionRow
        ? readViews(database, collectionRow.id)
        : [];

      expect(report.failedCollections).toEqual([]);
      expect(report.skippedEntities).toEqual([]);
      expect(report.droppedViewReferences).toEqual([]);
      expect(report.statMismatches).toEqual([]);
      expect(views).toHaveLength(3);
      expect(readViewConfig(database, views[0]?.id ?? 0)).toBeNull();
      expect(readViewConfig(database, views[1]?.id ?? 0)).toBeNull();
      expect(readViewConfig(database, views[2]?.id ?? 0)).toBeNull();
    });
  });
});
