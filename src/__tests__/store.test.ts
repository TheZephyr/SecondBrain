import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useStore } from "../store";
import type { IpcResult } from "../types/ipc";
import type {
  PaginatedItemsResult,
  Item,
  Collection,
  ItemData,
  View,
  ViewConfig,
} from "../types/models";
import { normalizeViewConfig } from "../utils/viewConfig";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function makeElectronAPIMock() {
  return {
    getCollections: vi.fn(),
    getCollectionItemCounts: vi.fn(),
    addCollection: vi.fn(),
    updateCollection: vi.fn(),
    deleteCollection: vi.fn(),
    getViews: vi.fn(),
    addView: vi.fn(),
    updateView: vi.fn(),
    deleteView: vi.fn(),
    getViewConfig: vi.fn(),
    updateViewConfig: vi.fn(),
    reorderViews: vi.fn(),
    getFields: vi.fn(),
    addField: vi.fn(),
    updateField: vi.fn(),
    previewFieldConversion: vi.fn(),
    convertFieldType: vi.fn(),
    reorderFields: vi.fn(),
    deleteField: vi.fn(),
    getItems: vi.fn(),
    addItem: vi.fn(),
    insertItemAt: vi.fn(),
    duplicateItem: vi.fn(),
    moveItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    reorderItems: vi.fn(),
    bulkDeleteItems: vi.fn(),
    bulkPatchItems: vi.fn(),
    importCollection: vi.fn(),
    showSaveDialog: vi.fn(),
    writeFile: vi.fn(),
    showOpenDialog: vi.fn(),
    readFile: vi.fn(),
    getBackupSettings: vi.fn(),
    updateBackupSettings: vi.fn(),
    listBackups: vi.fn(),
    createManualBackup: vi.fn(),
    restoreBackup: vi.fn(),
    deleteBackup: vi.fn(),
    openBackupsFolder: vi.fn(),
    openExternal: vi.fn(),
  };
}

function emptyPaginatedResult(limit = 100, offset = 0): PaginatedItemsResult {
  return { items: [], total: 0, limit, offset };
}

function makeItem(id: number, data: ItemData = {}): Item {
  return { id, collection_id: 1, order: id, data };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockApi: ReturnType<typeof makeElectronAPIMock>;

beforeEach(() => {
  setActivePinia(createPinia());
  mockApi = makeElectronAPIMock();
  vi.stubGlobal("window", { electronAPI: mockApi });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadItems", () => {
  it("fetches items and updates store state", async () => {
    const store = useStore();
    const items = [makeItem(1, { Title: "A" }), makeItem(2, { Title: "B" })];
    mockApi.getItems.mockResolvedValue(
      ok<PaginatedItemsResult>({ items, total: 2, limit: 50, offset: 0 }),
    );

    await store.loadItems(1);

    expect(mockApi.getItems).toHaveBeenCalledOnce();
    expect(store.items).toEqual(items);
    expect(store.itemsTotal).toBe(2);
    expect(store.itemsLoading).toBe(false);
  });

  it("appends nothing when appendItems receives an empty array", () => {
    const store = useStore();
    const existing = [makeItem(1), makeItem(2)];
    store.items = existing;

    store.appendItems([]);

    expect(store.items).toEqual(existing);
  });

  it("uses a fixed limit of 100", async () => {
    const store = useStore();
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    await store.loadItems(1);

    const callArgs = mockApi.getItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(100);
  });

  it("appends items for page > 0 and deduplicates by id", async () => {
    const store = useStore();
    mockApi.getItems
      .mockResolvedValueOnce(
        ok<PaginatedItemsResult>({
          items: [makeItem(1), makeItem(2)],
          total: 4,
          limit: 100,
          offset: 0,
        }),
      )
      .mockResolvedValueOnce(
        ok<PaginatedItemsResult>({
          items: [makeItem(2), makeItem(3), makeItem(4)],
          total: 4,
          limit: 100,
          offset: 100,
        }),
      );

    await store.loadItems(1, { page: 0 });
    await store.loadItems(1, { page: 1 });

    expect(store.items.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(mockApi.getItems.mock.calls[1][0]).toMatchObject({
      limit: 100,
      offset: 100,
    });
  });

  it("keeps the page when the requested sort matches the current sort", async () => {
    const store = useStore();
    const sort = [{ field: "data.Title", order: 1 as const }];
    mockApi.getItems.mockImplementation(
      async (input: { limit: number; offset: number }) =>
        ok<PaginatedItemsResult>({
          items: [],
          total: 0,
          limit: input.limit,
          offset: input.offset,
        }),
    );

    await store.loadItems(1, { sort, page: 0 });
    await store.loadItems(1, { sort, page: 1 });

    expect(mockApi.getItems.mock.calls[1][0]).toMatchObject({
      limit: 100,
      offset: 100,
      search: "",
      sort,
    });
    expect(store.itemsSort).toEqual(sort);
  });

  it("resets to page 0 when the requested sort length changes", async () => {
    const store = useStore();
    const firstSort = [{ field: "data.Title", order: 1 as const }];
    const nextSort = [
      { field: "data.Title", order: 1 as const },
      { field: "data.Date", order: -1 as const },
    ];
    mockApi.getItems.mockImplementation(
      async (input: { limit: number; offset: number }) =>
        ok<PaginatedItemsResult>({
          items: [],
          total: 0,
          limit: input.limit,
          offset: input.offset,
        }),
    );

    await store.loadItems(1, { sort: firstSort, page: 2 });
    await store.loadItems(1, { sort: nextSort, page: 2 });

    expect(mockApi.getItems.mock.calls[1][0]).toMatchObject({
      limit: 100,
      offset: 0,
      search: "",
      sort: nextSort,
    });
    expect(store.itemsSort).toEqual(nextSort);
  });

  it("updates itemsFullyLoaded when all rows are fetched", async () => {
    const store = useStore();
    const firstPageItems = Array.from({ length: 100 }, (_, index) =>
      makeItem(index + 1),
    );
    const secondPageItems = Array.from({ length: 50 }, (_, index) =>
      makeItem(index + 101),
    );

    mockApi.getItems
      .mockResolvedValueOnce(
        ok<PaginatedItemsResult>({
          items: firstPageItems,
          total: 150,
          limit: 100,
          offset: 0,
        }),
      )
      .mockResolvedValueOnce(
        ok<PaginatedItemsResult>({
          items: secondPageItems,
          total: 150,
          limit: 100,
          offset: 100,
        }),
      );

    await store.loadItems(1, { page: 0 });
    expect(store.itemsFullyLoaded).toBe(false);

    await store.loadItems(1, { page: 1 });
    expect(store.items.length).toBe(150);
    expect(store.itemsFullyLoaded).toBe(true);
  });

  it("discards stale responses (stale-request token)", async () => {
    const store = useStore();
    const staleItems = [makeItem(1, { Title: "Stale" })];
    const freshItems = [makeItem(2, { Title: "Fresh" })];

    // First call: slow, returns stale data
    let resolveFirst: (v: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    mockApi.getItems.mockReturnValueOnce(firstPromise).mockResolvedValueOnce(
      ok<PaginatedItemsResult>({
        items: freshItems,
        total: 1,
        limit: 50,
        offset: 0,
      }),
    );

    // Fire first load (will hang on the promise)
    const firstLoad = store.loadItems(1);
    // Fire second load immediately — this bumps the requestToken
    const secondLoad = store.loadItems(1);

    // Now resolve the first (stale) load
    resolveFirst!(
      ok<PaginatedItemsResult>({
        items: staleItems,
        total: 1,
        limit: 50,
        offset: 0,
      }),
    );

    await firstLoad;
    await secondLoad;

    // Store should contain fresh data, not stale
    expect(store.items).toEqual(freshItems);
    expect(store.items).not.toEqual(staleItems);
  });

  it("ignores stale page append responses after a reset load", async () => {
    const store = useStore();
    let resolveAppend: (value: IpcResult<PaginatedItemsResult>) => void;
    const appendPromise = new Promise<IpcResult<PaginatedItemsResult>>(
      (resolve) => {
        resolveAppend = resolve;
      },
    );

    mockApi.getItems
      .mockResolvedValueOnce(
        ok<PaginatedItemsResult>({
          items: [makeItem(1)],
          total: 2,
          limit: 100,
          offset: 0,
        }),
      )
      .mockReturnValueOnce(appendPromise)
      .mockResolvedValueOnce(
        ok<PaginatedItemsResult>({
          items: [makeItem(10)],
          total: 1,
          limit: 100,
          offset: 0,
        }),
      );

    await store.loadItems(1, { page: 0 });
    const appendLoad = store.loadItems(1, { page: 1 });
    const resetLoad = store.loadItems(1, { search: "fresh" });

    resolveAppend!(
      ok<PaginatedItemsResult>({
        items: [makeItem(2)],
        total: 2,
        limit: 100,
        offset: 100,
      }),
    );

    await appendLoad;
    await resetLoad;

    expect(store.items.map((item) => item.id)).toEqual([10]);
    expect(store.itemsFullyLoaded).toBe(true);
  });

  it("sets itemsLoading to false on completion", async () => {
    const store = useStore();
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    expect(store.itemsLoading).toBe(false);
    const promise = store.loadItems(1);
    // Loading is set true synchronously
    expect(store.itemsLoading).toBe(true);
    await promise;
    expect(store.itemsLoading).toBe(false);
  });
});

describe("selectCollection", () => {
  it("sets selectedCollection, clears items state, and triggers loads", async () => {
    const store = useStore();
    const col: Collection = { id: 5, name: "Books" };
    mockApi.getFields.mockResolvedValue(ok([]));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));
    mockApi.getViews.mockResolvedValue(
      ok([
        {
          id: 10,
          collection_id: 5,
          name: "Source",
          type: "grid",
          is_default: 1,
          order: 0,
        },
      ]),
    );

    // Pre-populate some state to verify it's cleared
    store.items = [makeItem(99)];
    store.itemsTotal = 99;
    store.itemsSearch = "old-search";

    store.selectCollection(col);

    expect(store.selectedCollection).toEqual(col);
    expect(store.currentView).toBe("collection");
    // State was cleared before new loads
    expect(store.itemsSearch).toBe("");
  });

  it("loads views and sets activeViewId to the default view", async () => {
    const store = useStore();
    const col: Collection = { id: 7, name: "Notes" };
    mockApi.getFields.mockResolvedValue(ok([]));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));
    mockApi.getViews.mockResolvedValue(
      ok([
        {
          id: 21,
          collection_id: 7,
          name: "Alt Grid",
          type: "grid",
          is_default: 0,
          order: 1,
        },
        {
          id: 22,
          collection_id: 7,
          name: "Source",
          type: "grid",
          is_default: 1,
          order: 0,
        },
      ]),
    );

    store.selectCollection(col);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockApi.getViews).toHaveBeenCalledOnce();
    expect(store.activeViewId).toBe(22);
  });

  it("adds a view, reloads views, and sets activeViewId to the new view", async () => {
    const store = useStore();
    const created = {
      id: 5,
      collection_id: 1,
      name: "Kanban",
      type: "kanban",
      is_default: 0,
      order: 1,
    };

    mockApi.addView.mockResolvedValue(ok(created));
    mockApi.getViews.mockResolvedValue(ok([created]));

    await store.addView({
      collectionId: 1,
      name: "Kanban",
      type: "kanban",
      isDefault: 0,
    });

    expect(mockApi.addView).toHaveBeenCalledOnce();
    expect(mockApi.getViews).toHaveBeenCalledOnce();
    expect(store.currentViews).toEqual([created]);
    expect(store.activeViewId).toBe(5);
  });

  it("resets to dashboard when selecting null", () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "A" };
    store.currentView = "collection";
    store.currentViews = [
      {
        id: 1,
        collection_id: 1,
        name: "Source",
        type: "grid",
        is_default: 1,
        order: 0,
      },
    ];
    store.activeViewId = 1;

    store.selectCollection(null);

    expect(store.selectedCollection).toBeNull();
    expect(store.currentView).toBe("dashboard");
    expect(store.fields).toEqual([]);
    expect(store.items).toEqual([]);
    expect(store.currentViews).toEqual([]);
    expect(store.activeViewId).toBeNull();
  });
});

describe("collection panel and view state", () => {
  it("resets activeCollectionPanel to 'data' when selectCollection is called", () => {
    const store = useStore();
    mockApi.getFields.mockResolvedValue(ok([]));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));
    mockApi.getViews.mockResolvedValue(ok([]));

    store.activeCollectionPanel = "fields";
    store.selectCollection({ id: 1, name: "A" });

    expect(store.activeCollectionPanel).toBe("data");
  });

  it("resets collectionSettingsOpen to false when selectCollection is called", () => {
    const store = useStore();
    mockApi.getFields.mockResolvedValue(ok([]));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));
    mockApi.getViews.mockResolvedValue(ok([]));

    store.collectionSettingsOpen = true;
    store.selectCollection({ id: 1, name: "A" });

    expect(store.collectionSettingsOpen).toBe(false);
  });

  it("resets activeViewId to null when selectCollection is called", () => {
    const store = useStore();
    mockApi.getFields.mockResolvedValue(ok([]));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));
    mockApi.getViews.mockResolvedValue(ok([]));

    store.activeViewId = 12;
    store.selectCollection({ id: 1, name: "A" });

    expect(store.activeViewId).toBeNull();
  });

  it("selectCollection(null) resets panel and view state", () => {
    const store = useStore();
    store.activeCollectionPanel = "fields";
    store.collectionSettingsOpen = true;
    store.activeViewId = 12;

    store.selectCollection(null);

    expect(store.activeCollectionPanel).toBe("data");
    expect(store.collectionSettingsOpen).toBe(false);
    expect(store.activeViewId).toBeNull();
  });

  it("setActiveCollectionPanel updates activeCollectionPanel", () => {
    const store = useStore();
    store.setActiveCollectionPanel("fields");
    expect(store.activeCollectionPanel).toBe("fields");
  });

  it("setCollectionSettingsOpen updates collectionSettingsOpen", () => {
    const store = useStore();
    store.setCollectionSettingsOpen(true);
    expect(store.collectionSettingsOpen).toBe(true);
  });

  it("setActiveViewId updates activeViewId", () => {
    const store = useStore();
    store.setActiveViewId(5);
    expect(store.activeViewId).toBe(5);
  });
});

describe("deleteCollection", () => {
  it("clears selectedCollection when deleting the active collection", async () => {
    const store = useStore();
    const col: Collection = { id: 3, name: "ToDelete" };
    store.selectedCollection = col;

    mockApi.deleteCollection.mockResolvedValue(ok(true));
    mockApi.getCollections.mockResolvedValue(ok([]));
    mockApi.getCollectionItemCounts.mockResolvedValue(ok([]));

    await store.deleteCollection(3);

    expect(store.selectedCollection).toBeNull();
  });

  it("keeps selectedCollection when deleting a different collection", async () => {
    const store = useStore();
    const active: Collection = { id: 1, name: "Active" };
    store.selectedCollection = active;

    mockApi.deleteCollection.mockResolvedValue(ok(true));
    mockApi.getCollections.mockResolvedValue(ok([active]));
    mockApi.getCollectionItemCounts.mockResolvedValue(ok([]));

    await store.deleteCollection(99);

    expect(store.selectedCollection).toEqual(active);
  });

  it("reloads collections after successful delete", async () => {
    const store = useStore();
    mockApi.deleteCollection.mockResolvedValue(ok(true));
    mockApi.getCollections.mockResolvedValue(ok([]));
    mockApi.getCollectionItemCounts.mockResolvedValue(ok([]));

    await store.deleteCollection(1);

    expect(mockApi.getCollections).toHaveBeenCalledOnce();
  });
});

describe("bulkDeleteItems", () => {
  it("patches visible items locally after successful bulk delete", async () => {
    const store = useStore();
    mockApi.getItems.mockResolvedValueOnce(
      ok<PaginatedItemsResult>({
        items: [makeItem(10), makeItem(11), makeItem(12)],
        total: 3,
        limit: 100,
        offset: 0,
      }),
    );
    await store.loadItems(1);

    mockApi.bulkDeleteItems.mockResolvedValue(ok({ affectedCount: 2 }));

    const result = await store.bulkDeleteItems({
      collectionId: 1,
      itemIds: [10, 11],
    });

    expect(result).toEqual({ affectedCount: 2 });
    expect(store.items).toEqual([makeItem(12)]);
    expect(store.itemsTotal).toBe(1);
    expect(mockApi.getItems).toHaveBeenCalledTimes(1);
  });

  it("returns null on IPC error", async () => {
    const store = useStore();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi.bulkDeleteItems.mockResolvedValue({
      ok: false,
      error: { code: "DB_QUERY_FAILED", message: "fail" },
    });

    const result = await store.bulkDeleteItems({
      collectionId: 1,
      itemIds: [1],
    });

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("[IPC:db:bulkDeleteItems]", {
      code: "DB_QUERY_FAILED",
      message: "fail",
    });
  });
});

describe("bulkPatchItems", () => {
  it("patches visible items locally after successful bulk patch", async () => {
    const store = useStore();
    mockApi.getItems.mockResolvedValueOnce(
      ok<PaginatedItemsResult>({
        items: [makeItem(5, { Title: "Before" })],
        total: 1,
        limit: 100,
        offset: 0,
      }),
    );
    await store.loadItems(1);

    mockApi.bulkPatchItems.mockResolvedValue(ok({ affectedCount: 1 }));

    const result = await store.bulkPatchItems({
      collectionId: 1,
      updates: [{ id: 5, patch: { Title: "Updated" } }],
    });

    expect(result).toEqual({ affectedCount: 1 });
    expect(store.items[0]?.data).toEqual({ Title: "Updated" });
    expect(mockApi.getItems).toHaveBeenCalledTimes(1);
  });

  it("returns null on IPC error", async () => {
    const store = useStore();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApi.bulkPatchItems.mockResolvedValue({
      ok: false,
      error: { code: "DB_QUERY_FAILED", message: "fail" },
    });

    const result = await store.bulkPatchItems({
      collectionId: 1,
      updates: [{ id: 1, patch: { Title: "X" } }],
    });

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("[IPC:db:bulkPatchItems]", {
      code: "DB_QUERY_FAILED",
      message: "fail",
    });
  });
});

describe("loadCollections", () => {
  it("populates collections from IPC response", async () => {
    const store = useStore();
    const cols: Collection[] = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ];
    mockApi.getCollections.mockResolvedValue(ok(cols));

    await store.loadCollections();

    expect(store.collections).toEqual(cols);
  });
});

describe("view config", () => {
  it("loads view config via IPC", async () => {
    const store = useStore();
    const config: ViewConfig = {
      columnWidths: { 1: 120 },
      sort: [{ field: "data.Title", order: 1 }],
      calendarDateField: "Due Date",
    };
    mockApi.getViewConfig.mockResolvedValue(ok(config));

    const result = await store.loadViewConfig(5);

    expect(mockApi.getViewConfig).toHaveBeenCalledWith(5);
    expect(result).toEqual(normalizeViewConfig(config));
  });

  it("saves view config via IPC", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(4, {
      columnWidths: { 7: 59.4 },
      sort: [{ field: "data.Title", order: -1 }],
      calendarDateField: "Due Date",
    });

    expect(mockApi.updateViewConfig).toHaveBeenCalledWith({
      viewId: 4,
      config: {
        columnWidths: { 7: 60 },
        sort: [{ field: "data.Title", order: -1, emptyPlacement: "last" }],
        calendarDateField: "Due Date",
        calendarDateFieldId: undefined,
        groupingFieldId: undefined,
        kanbanColumnOrder: undefined,
        selectedFieldIds: [],
      },
    });
  });

  it("normalizes kanbanColumnOrder by trimming and deduplicating values", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(4, {
      columnWidths: {},
      sort: [],
      kanbanColumnOrder: ["  Todo  ", "In Progress", "Todo", "", "Done  "],
    });

    const sent = mockApi.updateViewConfig.mock.calls[0][0];
    expect(sent.config.kanbanColumnOrder).toEqual([
      "Todo",
      "In Progress",
      "Done",
    ]);
  });

  it("returns undefined for an empty kanbanColumnOrder array", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(4, {
      columnWidths: {},
      sort: [],
      kanbanColumnOrder: [],
    });

    const sent = mockApi.updateViewConfig.mock.calls[0][0];
    expect(sent.config.kanbanColumnOrder).toBeUndefined();
  });
});

describe("loadViews", () => {
  it("ignores stale responses when a newer request finishes first", async () => {
    const store = useStore();
    const staleViews: View[] = [
      {
        id: 1,
        collection_id: 1,
        name: "Stale",
        type: "grid",
        is_default: 1,
        order: 0,
      },
    ];
    const freshViews: View[] = [
      {
        id: 2,
        collection_id: 1,
        name: "Fresh",
        type: "grid",
        is_default: 1,
        order: 0,
      },
    ];
    let resolveFirst!: (value: IpcResult<View[]>) => void;
    const firstPromise = new Promise<IpcResult<View[]>>((resolve) => {
      resolveFirst = resolve;
    });
    mockApi.getViews
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(ok(freshViews));

    const firstLoad = store.loadViews(1);
    const secondLoad = store.loadViews(1);
    resolveFirst(ok(staleViews));

    await firstLoad;
    await secondLoad;

    expect(store.currentViews).toEqual(freshViews);
    expect(store.activeViewId).toBe(2);
  });
});
