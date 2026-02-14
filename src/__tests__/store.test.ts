import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useStore } from "../store";
import type { IpcResult } from "../types/ipc";
import type { PaginatedItemsResult, Item, Collection } from "../types/models";

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
    getFields: vi.fn(),
    addField: vi.fn(),
    updateField: vi.fn(),
    reorderFields: vi.fn(),
    deleteField: vi.fn(),
    getItems: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    bulkDeleteItems: vi.fn(),
    bulkPatchItems: vi.fn(),
    importCollection: vi.fn(),
    showSaveDialog: vi.fn(),
    writeFile: vi.fn(),
    showOpenDialog: vi.fn(),
    readFile: vi.fn(),
  };
}

function emptyPaginatedResult(
  limit = 50,
  offset = 0,
): PaginatedItemsResult {
  return { items: [], total: 0, limit, offset };
}

function makeItem(id: number, data: Record<string, unknown> = {}): Item {
  return { id, collection_id: 1, data };
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

  it("clamps rows to MAX_ITEMS_ROWS (100)", async () => {
    const store = useStore();
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult(100, 0)));

    await store.loadItems(1, { rows: 999 });

    const callArgs = mockApi.getItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(100);
  });

  it("clamps rows to minimum of 1", async () => {
    const store = useStore();
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult(1, 0)));

    await store.loadItems(1, { rows: -5 });

    const callArgs = mockApi.getItems.mock.calls[0][0];
    expect(callArgs.limit).toBe(1);
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
    mockApi.getItems
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(
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

  it("computes page from offset/limit in response", async () => {
    const store = useStore();
    mockApi.getItems.mockResolvedValue(
      ok<PaginatedItemsResult>({
        items: [makeItem(1)],
        total: 100,
        limit: 10,
        offset: 30,
      }),
    );

    await store.loadItems(1, { page: 3, rows: 10 });

    expect(store.itemsPage).toBe(3); // 30 / 10 = 3
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
    const col: Collection = { id: 5, name: "Books", icon: "book" };
    mockApi.getFields.mockResolvedValue(ok([]));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

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

  it("resets to dashboard when selecting null", () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "A", icon: "a" };
    store.currentView = "collection";

    store.selectCollection(null);

    expect(store.selectedCollection).toBeNull();
    expect(store.currentView).toBe("dashboard");
    expect(store.fields).toEqual([]);
    expect(store.items).toEqual([]);
  });
});

describe("deleteCollection", () => {
  it("clears selectedCollection when deleting the active collection", async () => {
    const store = useStore();
    const col: Collection = { id: 3, name: "ToDelete", icon: "trash" };
    store.selectedCollection = col;

    mockApi.deleteCollection.mockResolvedValue(ok(true));
    mockApi.getCollections.mockResolvedValue(ok([]));

    await store.deleteCollection(3);

    expect(store.selectedCollection).toBeNull();
  });

  it("keeps selectedCollection when deleting a different collection", async () => {
    const store = useStore();
    const active: Collection = { id: 1, name: "Active", icon: "star" };
    store.selectedCollection = active;

    mockApi.deleteCollection.mockResolvedValue(ok(true));
    mockApi.getCollections.mockResolvedValue(ok([active]));

    await store.deleteCollection(99);

    expect(store.selectedCollection).toEqual(active);
  });

  it("reloads collections after successful delete", async () => {
    const store = useStore();
    mockApi.deleteCollection.mockResolvedValue(ok(true));
    mockApi.getCollections.mockResolvedValue(ok([]));

    await store.deleteCollection(1);

    expect(mockApi.getCollections).toHaveBeenCalledOnce();
  });
});

describe("bulkDeleteItems", () => {
  it("re-fetches items after successful bulk delete on active collection", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "A", icon: "a" };

    mockApi.bulkDeleteItems.mockResolvedValue(ok({ affectedCount: 2 }));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    const result = await store.bulkDeleteItems({
      collectionId: 1,
      itemIds: [10, 11],
    });

    expect(result).toEqual({ affectedCount: 2 });
    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("returns null on IPC error", async () => {
    const store = useStore();
    mockApi.bulkDeleteItems.mockResolvedValue({
      ok: false,
      error: { code: "DB_QUERY_FAILED", message: "fail" },
    });

    const result = await store.bulkDeleteItems({
      collectionId: 1,
      itemIds: [1],
    });

    expect(result).toBeNull();
  });
});

describe("bulkPatchItems", () => {
  it("re-fetches items after successful bulk patch on active collection", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "A", icon: "a" };

    mockApi.bulkPatchItems.mockResolvedValue(ok({ affectedCount: 1 }));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    const result = await store.bulkPatchItems({
      collectionId: 1,
      updates: [{ id: 5, patch: { Title: "Updated" } }],
    });

    expect(result).toEqual({ affectedCount: 1 });
    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("returns null on IPC error", async () => {
    const store = useStore();
    mockApi.bulkPatchItems.mockResolvedValue({
      ok: false,
      error: { code: "DB_QUERY_FAILED", message: "fail" },
    });

    const result = await store.bulkPatchItems({
      collectionId: 1,
      updates: [{ id: 1, patch: { Title: "X" } }],
    });

    expect(result).toBeNull();
  });
});

describe("loadCollections", () => {
  it("populates collections from IPC response", async () => {
    const store = useStore();
    const cols: Collection[] = [
      { id: 1, name: "A", icon: "a" },
      { id: 2, name: "B", icon: "b" },
    ];
    mockApi.getCollections.mockResolvedValue(ok(cols));

    await store.loadCollections();

    expect(store.collections).toEqual(cols);
  });
});
