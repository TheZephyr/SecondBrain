import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, handleOperation, initDatabase } from "../db/worker";
import type {
  Collection,
  Field,
  FullArchiveFile,
  FullArchiveRestoreReport,
  NewCollectionInput,
  NewFieldInput,
  NewItemInput,
  NewViewInput,
  View,
  ViewConfig,
} from "../../src/types/models";

type GetItemsResult = {
  items: Array<{
    id: number;
    collection_id: number;
    order: number;
    data: string;
  }>;
  total: number;
  limit: number;
  offset: number;
};

function setupInMemoryDb() {
  closeDatabase();
  initDatabase(":memory:");
}

function addCollection(input: NewCollectionInput): Collection {
  return handleOperation({ type: "addCollection", input }) as Collection;
}

function addField(input: NewFieldInput) {
  return handleOperation({ type: "addField", input }) as { id: number };
}

function addItem(input: NewItemInput) {
  return handleOperation({ type: "addItem", input }) as { id: number };
}

function addView(input: NewViewInput): View {
  return handleOperation({ type: "addView", input }) as View;
}

function updateViewConfig(viewId: number, config: ViewConfig) {
  return handleOperation({
    type: "updateViewConfig",
    input: { viewId, config },
  }) as boolean;
}

function getCollections(): Collection[] {
  return handleOperation({ type: "getCollections" }) as Collection[];
}

function getFields(collectionId: number): Field[] {
  return handleOperation({ type: "getFields", collectionId }) as Field[];
}

function getItems(collectionId: number): GetItemsResult {
  return handleOperation({
    type: "getItems",
    input: {
      collectionId,
      limit: 200,
      offset: 0,
      search: "",
      sort: [],
    },
  }) as GetItemsResult;
}

function getViews(collectionId: number): View[] {
  return handleOperation({ type: "getViews", collectionId }) as View[];
}

function getViewConfig(viewId: number): ViewConfig | null {
  return handleOperation({
    type: "getViewConfig",
    viewId,
  }) as ViewConfig | null;
}

function exportArchive(): FullArchiveFile {
  return handleOperation({
    type: "exportFullArchive",
    input: {
      appVersion: "0.3.0",
      description: "test archive",
    },
  }) as FullArchiveFile;
}

function restoreArchive(archive: FullArchiveFile) {
  return handleOperation({
    type: "restoreFullArchive",
    input: archive,
  }) as Omit<FullArchiveRestoreReport, "preRestoreBackupPath">;
}

afterEach(() => {
  closeDatabase();
});

describe("full archive export", () => {
  it("exports field options, item values, and view configs in archive format", () => {
    setupInMemoryDb();
    const collection = addCollection({ name: "Books" });
    const titleField = addField({
      collectionId: collection.id,
      name: "Title",
      type: "text",
      options: JSON.stringify({ defaultValue: "Untitled", uniqueCheck: false }),
      orderIndex: 0,
    });
    const statusField = addField({
      collectionId: collection.id,
      name: "Status",
      type: "select",
      options: JSON.stringify({
        choices: ["To Read", "Done"],
        defaultValue: "To Read",
      }),
      orderIndex: 1,
    });
    addField({
      collectionId: collection.id,
      name: "Tags",
      type: "multiselect",
      options: JSON.stringify({
        choices: ["Sci-Fi", "Classic"],
        defaultValue: ["Sci-Fi"],
      }),
      orderIndex: 2,
    });
    addField({
      collectionId: collection.id,
      name: "Read",
      type: "boolean",
      options: JSON.stringify({ icon: "heart" }),
      orderIndex: 3,
    });
    addField({
      collectionId: collection.id,
      name: "Rating",
      type: "rating",
      options: JSON.stringify({ icon: "star", color: "#ff0", min: 0, max: 5 }),
      orderIndex: 4,
    });

    addItem({
      collectionId: collection.id,
      data: {
        Title: "Dune",
        Status: "Done",
        Tags: JSON.stringify(["Sci-Fi", "Classic"]),
        Read: "1",
        Rating: 5,
      },
    });

    const board = addView({
      collectionId: collection.id,
      name: "Board",
      type: "kanban",
      isDefault: 0,
      order: 1,
    });
    updateViewConfig(board.id, {
      columnWidths: {
        [titleField.id]: 240,
      },
      sort: [{ field: "data.Title", order: 1 }],
      groupingFieldId: statusField.id,
      kanbanColumnOrder: ["To Read", "Done"],
      selectedFieldIds: [titleField.id, statusField.id],
    });

    const archive = exportArchive();
    const books = archive.collections[0];
    const boardView = books?.views.find((view) => view.name === "Board");

    expect(archive.type).toBe("full_archive");
    expect(archive.stats.collectionCount).toBe(1);
    expect(books?.fields[0]).toEqual({
      name: "Title",
      type: "text",
      orderIndex: 0,
      options: {
        defaultValue: "Untitled",
        uniqueCheck: false,
      },
    });
    expect(books?.items[0]?.data).toEqual({
      Title: "Dune",
      Status: "Done",
      Tags: ["Sci-Fi", "Classic"],
      Read: true,
      Rating: 5,
    });
    expect(boardView).toEqual({
      name: "Board",
      type: "kanban",
      isDefault: false,
      order: 1,
      config: {
        groupingField: "Status",
        columnOrder: ["To Read", "Done"],
        selectedFields: ["Title", "Status"],
      },
    });
  });
});

describe("full archive restore", () => {
  it("restores exported archives with preserved order and view references", () => {
    setupInMemoryDb();
    const original = addCollection({ name: "Books" });
    const titleField = addField({
      collectionId: original.id,
      name: "Title",
      type: "text",
      options: null,
      orderIndex: 0,
    });
    const dateField = addField({
      collectionId: original.id,
      name: "Published",
      type: "date",
      options: JSON.stringify({ format: "YYYY-MM-DD" }),
      orderIndex: 1,
    });
    addItem({
      collectionId: original.id,
      data: {
        Title: "Dune",
        Published: "1965-08-01",
      },
    });
    const calendar = addView({
      collectionId: original.id,
      name: "Calendar",
      type: "calendar",
      isDefault: 0,
      order: 1,
    });
    updateViewConfig(calendar.id, {
      columnWidths: {
        [titleField.id]: 240,
      },
      sort: [{ field: "data.Title", order: 1 }],
      calendarDateFieldId: dateField.id,
      selectedFieldIds: [titleField.id],
    });

    const archive = exportArchive();
    const calendarView = archive.collections[0]?.views.find(
      (view) => view.name === "Calendar",
    );

    addCollection({ name: "Temporary" });

    const report = restoreArchive(archive);
    const collections = getCollections();
    const restored = collections[0];
    const fields = getFields(restored.id);
    const items = getItems(restored.id);
    const views = getViews(restored.id);
    const restoredCalendar = views.find((view) => view.name === "Calendar");
    const restoredCalendarConfig = restoredCalendar
      ? getViewConfig(restoredCalendar.id)
      : null;

    expect(report.failedCollections).toEqual([]);
    expect(report.statMismatches).toEqual([]);
    expect(collections.map((collection) => collection.name)).toEqual(["Books"]);
    expect(fields.map((field) => field.name)).toEqual(["Title", "Published"]);
    expect(JSON.parse(items.items[0]?.data ?? "{}")).toEqual({
      Title: "Dune",
      Published: "1965-08-01",
    });
    expect(calendarView?.config).toEqual(
      expect.objectContaining({
        dateField: "Published",
      }),
    );
    expect(restoredCalendarConfig?.calendarDateFieldId).toBe(fields[1]?.id);
    expect(restoredCalendarConfig?.selectedFieldIds).toEqual([fields[0]?.id]);
  });

  it("skips unknown field and view types and reports dropped references", () => {
    setupInMemoryDb();

    const report = restoreArchive({
      type: "full_archive",
      version: 1,
      appVersion: "0.3.0",
      exportedAt: "2026-03-22T14:30:00.000Z",
      description: "",
      stats: {
        collectionCount: 1,
        totalFieldCount: 2,
        totalItemCount: 1,
      },
      collections: [
        {
          name: "Books",
          exportedAt: "2026-03-22T14:30:00.000Z",
          stats: {
            fieldCount: 2,
            itemCount: 1,
          },
          fields: [
            {
              name: "Title",
              type: "text",
              orderIndex: 0,
              options: { defaultValue: null, uniqueCheck: false },
            },
            {
              name: "Mystery",
              type: "mystery",
              orderIndex: 1,
              options: {},
            },
          ],
          views: [
            {
              name: "Source",
              type: "grid",
              isDefault: true,
              order: 0,
              config: {
                columnWidths: {
                  Missing: 200,
                },
                sort: [{ field: "Missing", order: 1 }],
                selectedFields: ["Title", "Missing"],
              },
            },
            {
              name: "Weird",
              type: "timeline",
              isDefault: false,
              order: 1,
              config: {},
            },
          ],
          items: [
            {
              order: 0,
              data: {
                Title: "Dune",
                Mystery: "ignored",
              },
            },
          ],
        },
      ],
    });

    const collection = getCollections()[0];
    const fields = getFields(collection.id);
    const views = getViews(collection.id);
    const source = views.find((view) => view.is_default === 1);
    const sourceConfig = source ? getViewConfig(source.id) : null;
    const items = getItems(collection.id);

    expect(report.skippedEntities).toEqual([
      expect.objectContaining({
        scope: "field",
        name: "Mystery",
        type: "mystery",
      }),
      expect.objectContaining({
        scope: "view",
        name: "Weird",
        type: "timeline",
      }),
    ]);
    expect(report.droppedViewReferences).toEqual([
      expect.objectContaining({
        referenceType: "columnWidth",
        referenceValue: "Missing",
      }),
      expect.objectContaining({
        referenceType: "sort",
        referenceValue: "Missing",
      }),
      expect.objectContaining({
        referenceType: "selectedField",
        referenceValue: "Missing",
      }),
    ]);
    expect(fields.map((field) => field.name)).toEqual(["Title"]);
    expect(sourceConfig?.selectedFieldIds).toEqual([fields[0]?.id]);
    expect(JSON.parse(items.items[0]?.data ?? "{}")).toEqual({ Title: "Dune" });
  });

  it("continues restoring later collections after one collection fails", () => {
    setupInMemoryDb();

    const report = restoreArchive({
      type: "full_archive",
      version: 1,
      appVersion: "0.3.0",
      exportedAt: "2026-03-22T14:30:00.000Z",
      description: "",
      stats: {
        collectionCount: 2,
        totalFieldCount: 3,
        totalItemCount: 0,
      },
      collections: [
        {
          name: "Good",
          exportedAt: "2026-03-22T14:30:00.000Z",
          stats: { fieldCount: 1, itemCount: 0 },
          fields: [
            {
              name: "Title",
              type: "text",
              orderIndex: 0,
              options: { defaultValue: null, uniqueCheck: false },
            },
          ],
          views: [],
          items: [],
        },
        {
          name: "Broken",
          exportedAt: "2026-03-22T14:30:00.000Z",
          stats: { fieldCount: 2, itemCount: 0 },
          fields: [
            {
              name: "A",
              type: "text",
              orderIndex: 0,
              options: { defaultValue: null, uniqueCheck: false },
            },
            {
              name: "B",
              type: "text",
              orderIndex: 0,
              options: { defaultValue: null, uniqueCheck: false },
            },
          ],
          views: [],
          items: [],
        },
      ],
    });

    expect(getCollections().map((collection) => collection.name)).toEqual([
      "Good",
    ]);
    expect(report.restoredCollections).toEqual(["Good"]);
    expect(report.failedCollections).toHaveLength(1);
    expect(report.failedCollections[0]?.collectionName).toBe("Broken");
    expect(report.statMismatches).toEqual([
      expect.objectContaining({
        scope: "total",
        stat: "collectionCount",
        expected: 2,
        actual: 1,
      }),
      expect.objectContaining({
        scope: "total",
        stat: "fieldCount",
        expected: 3,
        actual: 1,
      }),
    ]);
  });
});
