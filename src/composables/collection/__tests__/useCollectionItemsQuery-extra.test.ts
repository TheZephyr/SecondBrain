import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, type EffectScope } from "vue";
import type { Field, Item, ViewConfig } from "../../../types/models";
import type { ViewType } from "../../../types/models";
import type {
  MultiSortMeta,
  RawSortMeta,
} from "../../../components/views/collection/types";
import {
  areSortMetaEqual,
  getSortStorageKey,
  normalizeSortMeta,
  toItemSort,
  useCollectionItemsQuery,
} from "../useCollectionItemsQuery";

// ---------------------------------------------------------------------------
// Helpers (mirrors the existing test file's pattern)
// ---------------------------------------------------------------------------

function makeField(input: Partial<Field> & Pick<Field, "id" | "name">): Field {
  return {
    id: input.id,
    collection_id: input.collection_id ?? 1,
    name: input.name,
    type: input.type ?? "text",
    options: input.options ?? null,
    order_index: input.order_index ?? 0,
  };
}

function createPagingState(seedItems: Item[] = []) {
  return {
    items: ref<Item[]>(seedItems),
    itemsLoading: ref(false),
    itemsFullyLoaded: ref(false),
  };
}

function createMemoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

async function withScope<T>(
  callback: (scope: EffectScope) => Promise<T> | T,
): Promise<T> {
  const scope = effectScope();
  try {
    return await callback(scope);
  } finally {
    scope.stop();
  }
}

async function flushAsyncHydration() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

describe("areSortMetaEqual", () => {
  it("returns true for two empty arrays", () => {
    expect(areSortMetaEqual([], [])).toBe(true);
  });

  it("returns false for different lengths", () => {
    const a: MultiSortMeta[] = [{ field: "data.Title", order: 1 }];
    expect(areSortMetaEqual(a, [])).toBe(false);
  });

  it("returns true for identical entries", () => {
    const a: MultiSortMeta[] = [
      { field: "data.Title", order: 1 },
      { field: "data.Date", order: -1 },
    ];
    const b: MultiSortMeta[] = [
      { field: "data.Title", order: 1 },
      { field: "data.Date", order: -1 },
    ];
    expect(areSortMetaEqual(a, b)).toBe(true);
  });

  it("returns false when field names differ", () => {
    const a: MultiSortMeta[] = [{ field: "data.Title", order: 1 }];
    const b: MultiSortMeta[] = [{ field: "data.Author", order: 1 }];
    expect(areSortMetaEqual(a, b)).toBe(false);
  });

  it("returns false when orders differ", () => {
    const a: MultiSortMeta[] = [{ field: "data.Title", order: 1 }];
    const b: MultiSortMeta[] = [{ field: "data.Title", order: -1 }];
    expect(areSortMetaEqual(a, b)).toBe(false);
  });
});

describe("toItemSort", () => {
  it("maps MultiSortMeta to ItemSortSpec", () => {
    const meta: MultiSortMeta[] = [
      { field: "data.Title", order: 1 },
      { field: "data.Date", order: -1 },
    ];
    expect(toItemSort(meta)).toEqual([
      { field: "data.Title", order: 1 },
      { field: "data.Date", order: -1 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(toItemSort([])).toEqual([]);
  });
});

describe("getSortStorageKey", () => {
  it("returns a stable string key for a collection id", () => {
    expect(getSortStorageKey(5)).toBe("multi_sort_5");
  });
});

describe("normalizeSortMeta – extra branches", () => {
  it("returns empty array when all entries are invalid", () => {
    const safeFields = [makeField({ id: 1, name: "Title" })];
    const raw: RawSortMeta[] = [
      { field: undefined, order: 1 },
      { field: "data.Unknown", order: 1 },
    ];
    expect(normalizeSortMeta(raw, safeFields)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// onItemsSort on non-grid view clears multiSortMeta
// ---------------------------------------------------------------------------

describe("onItemsSort", () => {
  it("clears multiSortMeta and does not persist when activeViewType is not grid", async () => {
    const collectionId = ref(50);
    const viewId = ref<number | null>(null);
    const activeViewType = ref<ViewType | null>("calendar");
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: "Title", collection_id: 50 }),
    ]);
    const paging = createPagingState();
    const loadItems = vi.fn(async () => undefined);
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null);
    const saveViewConfig = vi.fn(async () => undefined);

    await withScope(async (scope) => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          activeViewType,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
        }),
      )!;

      query.multiSortMeta.value = [{ field: "data.Title", order: 1 }];
      await query.onItemsSort([{ field: "data.Title", order: -1 }]);

      expect(query.multiSortMeta.value).toEqual([]);
      expect(loadItems).not.toHaveBeenCalled();
      expect(saveViewConfig).not.toHaveBeenCalled();
    });
  });

  it("calls loadItems without persisting when viewId is null", async () => {
    const collectionId = ref(51);
    const viewId = ref<number | null>(null);
    const activeViewType = ref<ViewType | null>("grid");
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: "Title", collection_id: 51 }),
    ]);
    const paging = createPagingState();
    const loadItems = vi.fn(async () => undefined);
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null);
    const saveViewConfig = vi.fn(async () => undefined);

    await withScope(async (scope) => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          activeViewType,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
        }),
      )!;

      await query.onItemsSort([{ field: "data.Title", order: 1 }]);

      expect(loadItems).toHaveBeenCalledWith({
        sort: [{ field: "data.Title", order: 1 }],
      });
      expect(saveViewConfig).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// safeFields watcher – re-normalises stale sorts when fields change
// ---------------------------------------------------------------------------

describe("safeFields watcher", () => {
  it("re-normalises active sort and reloads when a sorted field is removed", async () => {
    const collectionId = ref(60);
    const viewId = ref<number | null>(60);
    const activeViewType = ref<ViewType | null>("grid");
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: "Title", collection_id: 60 }),
      makeField({ id: 2, name: "Author", collection_id: 60 }),
    ]);
    const paging = createPagingState();
    const loadItems = vi.fn(async () => undefined);
    const loadViewConfig = vi.fn(
      async (): Promise<ViewConfig | null> => ({
        columnWidths: {},
        sort: [
          { field: "data.Title", order: 1 },
          { field: "data.Author", order: -1 },
        ],
      }),
    );
    const saveViewConfig = vi.fn(async () => undefined);

    await withScope(async (scope) => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          activeViewType,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
          debounceMs: 10,
        }),
      )!;

      await flushAsyncHydration();
      loadItems.mockClear();
      saveViewConfig.mockClear();

      // Remove Author from safe fields — the sort on Author should be dropped
      safeFields.value = [
        makeField({ id: 1, name: "Title", collection_id: 60 }),
      ];
      await flushAsyncHydration();

      expect(query.multiSortMeta.value).toEqual([
        { field: "data.Title", order: 1 },
      ]);
      expect(loadItems).toHaveBeenCalledWith({
        sort: [{ field: "data.Title", order: 1 }],
      });
      expect(saveViewConfig).toHaveBeenCalledWith(
        60,
        expect.objectContaining({ sort: [{ field: "data.Title", order: 1 }] }),
      );
    });
  });

  it("clears sort state when activeViewType switches away from grid", async () => {
    const collectionId = ref(61);
    const viewId = ref<number | null>(null);
    const activeViewType = ref<ViewType | null>("grid");
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: "Title", collection_id: 61 }),
    ]);
    const paging = createPagingState();
    const loadItems = vi.fn(async () => undefined);
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null);
    const saveViewConfig = vi.fn(async () => undefined);

    await withScope(async (scope) => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          activeViewType,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
        }),
      )!;

      query.multiSortMeta.value = [{ field: "data.Title", order: 1 }];

      activeViewType.value = "calendar";
      safeFields.value = [...safeFields.value]; // trigger watcher
      await nextTick();

      expect(query.multiSortMeta.value).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// suppressNextEmptySearchLoad – reset-search suppression path
// ---------------------------------------------------------------------------

describe("suppressNextEmptySearchLoad", () => {
  it("suppresses the load triggered when search is cleared after a collection switch", async () => {
    vi.useFakeTimers();
    const collectionId = ref(70);
    const viewId = ref<number | null>(null);
    const activeViewType = ref<ViewType | null>("grid");
    const safeFields = ref<Field[]>([]);
    const paging = createPagingState();
    const loadItems = vi.fn(async () => undefined);
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null);
    const saveViewConfig = vi.fn(async () => undefined);

    try {
      await withScope(async (scope) => {
        const query = scope.run(() =>
          useCollectionItemsQuery({
            collectionId,
            viewId,
            activeViewType,
            safeFields,
            items: paging.items,
            itemsLoading: paging.itemsLoading,
            itemsFullyLoaded: paging.itemsFullyLoaded,
            loadItems,
            loadViewConfig,
            saveViewConfig,
            debounceMs: 50,
          }),
        )!;

        // Set a search query, then switch collection (which calls resetSearchQuery)
        query.searchQuery.value = "hello";
        await vi.advanceTimersByTimeAsync(60);
        loadItems.mockClear();

        // Simulate collection switch — the watch on [collectionId, viewId, activeViewType]
        // calls resetSearchQuery which sets suppressNextEmptySearchLoad = true and clears query
        collectionId.value = 71;
        await vi.advanceTimersByTimeAsync(60);
        await nextTick();

        // The empty-string load triggered by clearing search should be suppressed
        const calls = loadItems.mock.calls as unknown as Array<
          [{ search?: string } | undefined]
        >;
        const emptySearchCalls = calls.filter(([arg]) => arg?.search === "");
        expect(emptySearchCalls).toHaveLength(0);
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// loadNextPage – empty items guard
// ---------------------------------------------------------------------------

describe("loadNextPage – empty items guard", () => {
  it("does not call loadItems when items list is empty", async () => {
    const collectionId = ref(80);
    const viewId = ref<number | null>(null);
    const activeViewType = ref<ViewType | null>("grid");
    const safeFields = ref<Field[]>([]);
    const paging = createPagingState([]); // no items
    const loadItems = vi.fn(async () => undefined);
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null);
    const saveViewConfig = vi.fn(async () => undefined);

    await withScope(async (scope) => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          activeViewType,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
        }),
      )!;

      await query.loadNextPage();

      expect(loadItems).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// migratedCollectionIds de-duplication guard
// ---------------------------------------------------------------------------

describe("migrateLegacySortIfNeeded – already-migrated guard", () => {
  it("only migrates legacy sort once per collection id per module lifetime", async () => {
    // Use a unique collection id that hasn't been seen by the module-level Set yet
    const collectionId = ref(9001);
    const viewId = ref<number | null>(9001);
    const activeViewType = ref<ViewType | null>("grid");
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: "Title", collection_id: 9001 }),
    ]);
    const storage = createMemoryStorage({
      [getSortStorageKey(9001)]: JSON.stringify([
        { field: "data.Title", order: -1 },
      ]),
    });
    const loadItems = vi.fn(async () => undefined);
    const paging = createPagingState();
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null);
    const saveViewConfig = vi.fn(async () => undefined);

    // First instance — should trigger migration
    await withScope(async (scope) => {
      scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          activeViewType,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          storage,
          loadItems,
          loadViewConfig,
          saveViewConfig,
          debounceMs: 10,
        }),
      );
      await flushAsyncHydration();
    });

    const firstMigrationCalls = saveViewConfig.mock.calls.length;
    saveViewConfig.mockClear();

    // Second instance with same collectionId — migration should be skipped
    await withScope(async (scope) => {
      scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          activeViewType,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          storage,
          loadItems,
          loadViewConfig,
          saveViewConfig,
          debounceMs: 10,
        }),
      );
      await flushAsyncHydration();
    });

    expect(firstMigrationCalls).toBe(1);
    expect(saveViewConfig).not.toHaveBeenCalled();
  });
});
