import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { initDatabaseConnection } from "../db/init";
import {
  addView,
  deleteView,
  getViewConfig,
  getViews,
  parseStoredViewConfig,
  reorderViews,
  updateView,
  updateViewConfig,
} from "../db/views";
import type { ReorderViewsInput, ViewConfig } from "../../src/types/models";

type StubDatabaseOptions = {
  get?: (sql: string, params: readonly unknown[]) => unknown;
  all?: (sql: string, params: readonly unknown[]) => unknown[];
  run?: (sql: string, params: readonly unknown[]) => number;
};

type DirectDbConnection = {
  db: Database.Database;
  ftsEnabled: boolean;
};

type ViewRow = {
  id: number;
  collection_id: number;
  name: string;
  type: string;
  is_default: 0 | 1;
  order: number;
  config?: string | null;
};

const directDatabases: Database.Database[] = [];

function openDatabase(): Database.Database {
  const connection = initDatabaseConnection(":memory:") as DirectDbConnection;
  directDatabases.push(connection.db);
  return connection.db;
}

function createCollection(database: Database.Database, name: string): number {
  const info = database
    .prepare("INSERT INTO collections (name) VALUES (?)")
    .run(name);
  return Number(info.lastInsertRowid);
}

function loadViews(database: Database.Database, collectionId: number): ViewRow[] {
  return getViews(database, collectionId) as ViewRow[];
}

function createStubDatabase(options: StubDatabaseOptions): Database.Database {
  const prepare = (sql: string) => ({
    get: (...params: unknown[]) => options.get?.(sql, params) ?? undefined,
    all: (...params: unknown[]) => options.all?.(sql, params) ?? [],
    run: (...params: unknown[]) => ({
      changes: options.run?.(sql, params) ?? 1,
      lastInsertRowid: 1,
    }),
  });

  const transaction = <T,>(callback: (payload: T) => T) => {
    return (payload: T) => callback(payload);
  };

  return {
    prepare,
    transaction,
  } as unknown as Database.Database;
}

afterEach(() => {
  while (directDatabases.length > 0) {
    directDatabases.pop()?.close();
  }
});

describe("parseStoredViewConfig", () => {
  it("returns null for empty, invalid, and malformed configs", () => {
    expect(parseStoredViewConfig(null)).toBeNull();
    expect(parseStoredViewConfig("")).toBeNull();
    expect(parseStoredViewConfig("{not json")).toBeNull();
    expect(
      parseStoredViewConfig(
        JSON.stringify({
          columnWidths: { "1": 50 },
          sort: [],
          selectedFieldIds: [],
        }),
      ),
    ).toBeNull();
  });

  it("normalizes column width keys and preserves the rest of the payload", () => {
    const result = parseStoredViewConfig(
      JSON.stringify({
        columnWidths: { "1": 120, "9": 240 },
        sort: [
          { field: "data.Title", order: 1 },
          { field: "data.CreatedAt", order: -1 },
        ],
        calendarDateField: "Due Date",
        calendarDateFieldId: 4,
        groupingFieldId: 5,
        kanbanColumnOrder: ["Todo", "Doing", "Done"],
        selectedFieldIds: [1, 9],
      }),
    );

    expect(result).toEqual({
      columnWidths: { 1: 120, 9: 240 },
      sort: [
        { field: "data.Title", order: 1, emptyPlacement: "last" },
        { field: "data.CreatedAt", order: -1, emptyPlacement: "last" },
      ],
      calendarDateField: "Due Date",
      calendarDateFieldId: 4,
      groupingFieldId: 5,
      kanbanColumnOrder: ["Todo", "Doing", "Done"],
      selectedFieldIds: [1, 9],
    });
  });
});

describe("addView", () => {
  it("defaults type, default flag, and order for the first view in a collection", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Notes");

    const created = addView(db, {
      collectionId,
      name: "Board",
    });

    expect(created).toEqual({
      id: expect.any(Number),
      collection_id: collectionId,
      name: "Board",
      type: "grid",
      is_default: 0,
      order: 0,
    });
  });

  it("increments the order when adding another view without an explicit order", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Views");

    const first = addView(db, {
      collectionId,
      name: "First",
    });
    const second = addView(db, {
      collectionId,
      name: "Second",
    });

    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
    expect(loadViews(db, collectionId).map((view) => view.name)).toEqual([
      "First",
      "Second",
    ]);
  });
});

describe("updateView", () => {
  it("renames a non-source view", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Books");
    const created = addView(db, {
      collectionId,
      name: "Draft",
      type: "kanban",
      isDefault: 0,
      order: 1,
    });

    expect(updateView(db, { id: created.id, name: "Published" })).toBe(true);
    expect(loadViews(db, collectionId)[0].name).toBe("Published");
  });

  it("rejects renaming the source view", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Protected");
    const source = addView(db, {
      collectionId,
      name: "Source",
      type: "grid",
      isDefault: 1,
      order: 0,
    });

    expect(() => updateView(db, { id: source.id, name: "New name" })).toThrow(
      /Cannot rename source view/,
    );
  });

  it("throws when the target view does not exist", () => {
    const db = createStubDatabase({
      get: (sql) => {
        if (sql.includes("SELECT is_default FROM views WHERE id = ?")) {
          return undefined;
        }
        return undefined;
      },
    });

    expect(() => updateView(db, { id: 404, name: "Missing" })).toThrow(
      "View 404 not found.",
    );
  });

  it("throws when the update does not change any rows", () => {
    const db = createStubDatabase({
      get: (sql) => {
        if (sql.includes("SELECT is_default FROM views WHERE id = ?")) {
          return { is_default: 0 };
        }
        return undefined;
      },
      run: (sql) => {
        if (sql.includes("UPDATE views SET name = ? WHERE id = ?")) {
          return 0;
        }
        return 1;
      },
    });

    expect(() => updateView(db, { id: 7, name: "No-op" })).toThrow(
      "Failed to update view 7.",
    );
  });
});

describe("deleteView", () => {
  it("deletes a non-source view", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Trash");
    const created = addView(db, {
      collectionId,
      name: "Temporary",
      type: "grid",
      isDefault: 0,
      order: 1,
    });

    expect(deleteView(db, created.id)).toBe(true);
    expect(getViews(db, collectionId)).toEqual([]);
  });

  it("rejects deleting the source view", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Protected");
    const source = addView(db, {
      collectionId,
      name: "Source",
      type: "grid",
      isDefault: 1,
      order: 0,
    });

    expect(() => deleteView(db, source.id)).toThrow(
      /Cannot delete source view/,
    );
  });

  it("throws when the target view does not exist", () => {
    const db = createStubDatabase({
      get: (sql) => {
        if (sql.includes("SELECT is_default FROM views WHERE id = ?")) {
          return undefined;
        }
        return undefined;
      },
    });

    expect(() => deleteView(db, 404)).toThrow("View 404 not found.");
  });

  it("throws when the delete does not change any rows", () => {
    const db = createStubDatabase({
      get: (sql) => {
        if (sql.includes("SELECT is_default FROM views WHERE id = ?")) {
          return { is_default: 0 };
        }
        return undefined;
      },
      run: (sql) => {
        if (sql.includes("DELETE FROM views WHERE id = ?")) {
          return 0;
        }
        return 1;
      },
    });

    expect(() => deleteView(db, 7)).toThrow("Failed to delete view 7.");
  });
});

describe("getViewConfig", () => {
  it("returns null when the view does not exist", () => {
    const db = openDatabase();

    expect(getViewConfig(db, 999)).toBeNull();
  });

  it("returns null when the stored config is null", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Config");
    const created = addView(db, {
      collectionId,
      name: "Board",
      type: "grid",
      isDefault: 0,
      order: 1,
    });

    db.prepare("UPDATE views SET config = NULL WHERE id = ?").run(created.id);

    expect(getViewConfig(db, created.id)).toBeNull();
  });

  it("reads and parses a stored config", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Config");
    const created = addView(db, {
      collectionId,
      name: "Board",
      type: "grid",
      isDefault: 0,
      order: 1,
    });
    const config: ViewConfig = {
      columnWidths: { 3: 180 },
      sort: [{ field: "data.Title", order: 1, emptyPlacement: "last" }],
      calendarDateField: undefined,
      calendarDateFieldId: undefined,
      groupingFieldId: undefined,
      kanbanColumnOrder: undefined,
      selectedFieldIds: [3],
    };

    updateViewConfig(db, { viewId: created.id, config });

    expect(getViewConfig(db, created.id)).toEqual(config);
  });
});

describe("updateViewConfig", () => {
  it("stores a normalized config payload", () => {
    const db = openDatabase();
    const collectionId = createCollection(db, "Config");
    const created = addView(db, {
      collectionId,
      name: "Board",
      type: "grid",
      isDefault: 0,
      order: 1,
    });
    const config: ViewConfig = {
      columnWidths: { 7: 240 },
      sort: [
        { field: "data.Title", order: 1, emptyPlacement: "last" },
        { field: "data.CreatedAt", order: -1, emptyPlacement: "last" },
      ],
      calendarDateField: "Due",
      calendarDateFieldId: 2,
      groupingFieldId: 4,
      kanbanColumnOrder: ["Todo", "Done"],
      selectedFieldIds: [7],
    };

    expect(updateViewConfig(db, { viewId: created.id, config })).toBe(true);
    expect(getViewConfig(db, created.id)).toEqual(config);
  });

  it("throws when the update does not affect a row", () => {
    const db = createStubDatabase({
      run: (sql) => {
        if (sql.includes("UPDATE views SET config = ? WHERE id = ?")) {
          return 0;
        }
        return 1;
      },
    });

    expect(() =>
      updateViewConfig(db, {
        viewId: 12,
        config: {
          columnWidths: {},
          sort: [],
          selectedFieldIds: [],
        },
      }),
    ).toThrow("Failed to update view config for view 12.");
  });
});

describe("reorderViews", () => {
  function createViewSet() {
    const db = openDatabase();
    const collectionId = createCollection(db, "Ordered views");
    const source = addView(db, {
      collectionId,
      name: "Source",
      type: "grid",
      isDefault: 1,
      order: 0,
    });
    const first = addView(db, {
      collectionId,
      name: "Alpha",
      type: "grid",
      isDefault: 0,
      order: 1,
    });
    const second = addView(db, {
      collectionId,
      name: "Beta",
      type: "grid",
      isDefault: 0,
      order: 2,
    });

    return { db, collectionId, source, first, second };
  }

  it("reorders non-source views and keeps the source view at order 0", () => {
    const { db, collectionId, source, first, second } = createViewSet();

    expect(
      reorderViews(db, {
        collectionId,
        viewOrders: [
          { id: second.id, order: 1 },
          { id: first.id, order: 2 },
        ],
      }),
    ).toBe(true);

    expect(
      loadViews(db, collectionId).map((view) => ({
        id: view.id,
        name: view.name,
        order: view.order,
      })),
    ).toEqual([
      { id: source.id, name: "Source", order: 0 },
      { id: second.id, name: "Beta", order: 1 },
      { id: first.id, name: "Alpha", order: 2 },
    ]);
  });

  it("rejects payloads that include the source view", () => {
    const { db, collectionId, source, first } = createViewSet();

    expect(() =>
      reorderViews(db, {
        collectionId,
        viewOrders: [
          { id: source.id, order: 1 },
          { id: first.id, order: 2 },
        ],
      }),
    ).toThrow(/includes source view/);
  });

  it("rejects payloads with the wrong number of views", () => {
    const { db, collectionId, first } = createViewSet();

    expect(() =>
      reorderViews(db, {
        collectionId,
        viewOrders: [{ id: first.id, order: 1 }],
      }),
    ).toThrow(/must include every non-source view/);
  });

  it("rejects payloads with duplicate view IDs", () => {
    const { db, collectionId, first, second } = createViewSet();

    expect(() =>
      reorderViews(db, {
        collectionId,
        viewOrders: [
          { id: first.id, order: 1 },
          { id: first.id, order: 2 },
        ],
      }),
    ).toThrow(/contains duplicate view IDs/);

    expect(second.id).toBeGreaterThan(0);
  });

  it("rejects payloads with IDs from outside the collection", () => {
    const { db, collectionId, first, second } = createViewSet();

    expect(() =>
      reorderViews(db, {
        collectionId,
        viewOrders: [
          { id: first.id, order: 1 },
          { id: 999_999, order: 2 },
        ],
      }),
    ).toThrow(/contains IDs outside collection/);

    expect(second.id).toBeGreaterThan(0);
  });

  it("rejects payloads that miss an existing view", () => {
    const db = createStubDatabase({
      get: (sql) => {
        if (
          sql.includes("SELECT id FROM views WHERE collection_id = ? AND is_default = 1")
        ) {
          return undefined;
        }
        return undefined;
      },
      all: (sql) => {
        if (
          sql.includes(
            'SELECT id FROM views WHERE collection_id = ? AND is_default = 0 ORDER BY "order" ASC, id ASC',
          )
        ) {
          return [{ id: 1 }, { id: 2 }, { id: 3 }];
        }
        return [];
      },
    });

    const originalHas = Set.prototype.has;
    let hasCallCount = 0;
    Set.prototype.has = function (this: Set<unknown>, value: unknown) {
      hasCallCount += 1;
      if (hasCallCount === 4) {
        return false;
      }
      return originalHas.call(this, value);
    };

    try {
      expect(() =>
        reorderViews(db, {
          collectionId: 1,
          viewOrders: [
            { id: 1, order: 1 },
            { id: 2, order: 2 },
            { id: 3, order: 3 },
          ],
        }),
      ).toThrow(/is missing IDs from collection/);
    } finally {
      Set.prototype.has = originalHas;
    }
  });

  it("throws when one of the reorder updates does not affect a row", () => {
    const db = createStubDatabase({
      get: (sql) => {
        if (
          sql.includes("SELECT id FROM views WHERE collection_id = ? AND is_default = 1")
        ) {
          return { id: 10 };
        }

        if (
          sql.includes(
            'SELECT id FROM views WHERE collection_id = ? AND is_default = 0 ORDER BY "order" ASC, id ASC',
          )
        ) {
          return [{ id: 11 }, { id: 12 }];
        }

        return undefined;
      },
      all: (sql) => {
        if (
          sql.includes(
            'SELECT id FROM views WHERE collection_id = ? AND is_default = 0 ORDER BY "order" ASC, id ASC',
          )
        ) {
          return [{ id: 11 }, { id: 12 }];
        }

        return [];
      },
      run: (sql) => {
        if (sql.includes('UPDATE views SET "order" = "order" + ?')) {
          return 1;
        }

        if (sql.includes('UPDATE views SET "order" = 0 WHERE collection_id = ? AND is_default = 1')) {
          return 1;
        }

        if (
          sql.includes(
            'UPDATE views SET "order" = ? WHERE id = ? AND collection_id = ? AND is_default = 0',
          )
        ) {
          return 0;
        }

        return 1;
      },
    });

    const input: ReorderViewsInput = {
      collectionId: 1,
      viewOrders: [
        { id: 11, order: 1 },
        { id: 12, order: 2 },
      ],
    };

    expect(() => reorderViews(db, input)).toThrow(
      "Failed to reorder view 11 in collection 1.",
    );
  });
});
