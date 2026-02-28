import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { Field, Item, ViewConfig } from '../../../types/models'
import type { RawSortMeta } from '../../../components/views/collection/types'
import {
  getSortStorageKey,
  normalizeSortMeta,
  useCollectionItemsQuery
} from '../useCollectionItemsQuery'

function makeField(input: Partial<Field> & Pick<Field, 'id' | 'name'>): Field {
  return {
    id: input.id,
    collection_id: input.collection_id ?? 1,
    name: input.name,
    type: input.type ?? 'text',
    options: input.options ?? null,
    order_index: input.order_index ?? 0
  }
}

function createMemoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed))
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    removeItem(key: string) {
      map.delete(key)
    }
  }
}

function createPagingState(seedItems: Item[] = []) {
  return {
    items: ref<Item[]>(seedItems),
    itemsLoading: ref(false),
    itemsFullyLoaded: ref(false)
  }
}

async function withScope<T>(callback: (scope: EffectScope) => Promise<T> | T): Promise<T> {
  const scope = effectScope()
  try {
    return await callback(scope)
  } finally {
    scope.stop()
  }
}

async function flushAsyncHydration() {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

describe('useCollectionItemsQuery', () => {
  it('normalizes sort meta by dropping invalid entries', () => {
    const safeFields = [
      makeField({ id: 1, name: 'Title' }),
      makeField({ id: 2, name: 'Author' })
    ]
    const rawMeta: RawSortMeta[] = [
      { field: 'data.Title', order: 1 },
      { field: 'data.Unknown', order: 1 },
      { field: 'data.Author', order: -1 },
      { field: 'data.Title', order: 0 },
      { field: undefined, order: 1 }
    ]

    const normalized = normalizeSortMeta(rawMeta, safeFields)
    expect(normalized).toEqual([
      { field: 'data.Title', order: 1 },
      { field: 'data.Author', order: -1 }
    ])
  })

  it('restores saved sort preferences from view config for the active view', async () => {
    const collectionId = ref(9)
    const viewId = ref<number | null>(18)
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', collection_id: 9 })
    ])
    const loadItems = vi.fn(async () => undefined)
    const paging = createPagingState()
    const loadViewConfig = vi.fn(
      async (): Promise<ViewConfig | null> => ({
        columnWidths: { 1: 120 },
        sort: [
          { field: 'data.Title', order: -1 },
          { field: 'data.Unknown', order: 1 }
        ]
      })
    )
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
          debounceMs: 10
        })
      )

      if (!query) {
        throw new Error('Query composable failed to initialize')
      }

      await flushAsyncHydration()

      expect(loadViewConfig).toHaveBeenCalledWith(18)
      expect(query.multiSortMeta.value).toEqual([{ field: 'data.Title', order: -1 }])
      expect(loadItems).toHaveBeenCalledWith({
        search: '',
        sort: [{ field: 'data.Title', order: -1 }]
      })
      expect(saveViewConfig).not.toHaveBeenCalled()
    })
  })

  it('does not normalize away saved sorts before current fields are loaded', async () => {
    const collectionId = ref(7)
    const viewId = ref<number | null>(17)
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: 'Legacy', collection_id: 1 })
    ])
    const loadItems = vi.fn(async () => undefined)
    const paging = createPagingState()
    const loadViewConfig = vi.fn(
      async (): Promise<ViewConfig | null> => ({
        columnWidths: {},
        sort: [{ field: 'data.Title', order: 1 }]
      })
    )
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
          debounceMs: 10
        })
      )

      if (!query) {
        throw new Error('Query composable failed to initialize')
      }

      await flushAsyncHydration()
      expect(query.multiSortMeta.value).toEqual([])
      expect(loadItems).not.toHaveBeenCalled()

      safeFields.value = [makeField({ id: 2, name: 'Title', collection_id: 7 })]
      await flushAsyncHydration()

      expect(query.multiSortMeta.value).toEqual([{ field: 'data.Title', order: 1 }])
      expect(loadItems).toHaveBeenCalledWith({
        search: '',
        sort: [{ field: 'data.Title', order: 1 }]
      })
    })
  })

  it('persists sort updates to view config', async () => {
    const collectionId = ref(15)
    const viewId = ref<number | null>(30)
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', collection_id: 15 })
    ])
    const loadItems = vi.fn(async () => undefined)
    const paging = createPagingState()
    const loadViewConfig = vi.fn(
      async (): Promise<ViewConfig | null> => ({
        columnWidths: { 4: 190 },
        sort: []
      })
    )
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig,
          debounceMs: 10
        })
      )

      if (!query) {
        throw new Error('Query composable failed to initialize')
      }

      await flushAsyncHydration()
      await query.onItemsSort([{ field: 'data.Title', order: -1 }])

      expect(saveViewConfig).toHaveBeenCalledWith(30, {
        columnWidths: { 4: 190 },
        sort: [{ field: 'data.Title', order: -1 }]
      })
    })
  })

  it('migrates localStorage sort to view config and removes old key', async () => {
    const collectionId = ref(42)
    const viewId = ref<number | null>(101)
    const safeFields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', collection_id: 42 })
    ])
    const storage = createMemoryStorage({
      [getSortStorageKey(42)]: JSON.stringify([
        { field: 'data.Title', order: -1 },
        { field: 'data.Unknown', order: 1 }
      ])
    })
    const loadItems = vi.fn(async () => undefined)
    const paging = createPagingState()
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null)
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          storage,
          loadItems,
          loadViewConfig,
          saveViewConfig,
          debounceMs: 10
        })
      )

      if (!query) {
        throw new Error('Query composable failed to initialize')
      }

      await nextTick()

      expect(saveViewConfig).toHaveBeenCalledWith(101, {
        columnWidths: {},
        sort: [{ field: 'data.Title', order: -1 }, { field: 'data.Unknown', order: 1 }]
      })
      await vi.waitFor(() => {
        expect(storage.getItem(getSortStorageKey(42))).toBeNull()
      })
      expect(query.multiSortMeta.value).toEqual([{ field: 'data.Title', order: -1 }])
      expect(loadItems).toHaveBeenCalledWith({
        search: '',
        sort: [{ field: 'data.Title', order: -1 }]
      })
    })
  })

  it('triggers a debounced search load', async () => {
    vi.useFakeTimers()
    const collectionId = ref(81)
    const viewId = ref<number | null>(111)
    const safeFields = ref<Field[]>([makeField({ id: 1, name: 'Title', collection_id: 81 })])
    const loadItems = vi.fn(async () => undefined)
    const paging = createPagingState()
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null)
    const saveViewConfig = vi.fn(async () => undefined)

    try {
      await withScope(async scope => {
        const query = scope.run(() =>
          useCollectionItemsQuery({
            collectionId,
            viewId,
            safeFields,
            items: paging.items,
            itemsLoading: paging.itemsLoading,
            itemsFullyLoaded: paging.itemsFullyLoaded,
            loadItems,
            loadViewConfig,
            saveViewConfig,
            debounceMs: 100
          })
        )

        if (!query) {
          throw new Error('Query composable failed to initialize')
        }

        query.searchQuery.value = 'alpha'
        await vi.advanceTimersByTimeAsync(110)
        await nextTick()

        expect(loadItems).toHaveBeenCalledWith({
          search: 'alpha'
        })
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('loads the next page when not loading and not fully loaded', async () => {
    const collectionId = ref(11)
    const viewId = ref<number | null>(null)
    const safeFields = ref<Field[]>([])
    const paging = createPagingState(Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      collection_id: 11,
      order: index,
      data: {}
    })))
    const loadItems = vi.fn(async () => undefined)
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null)
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig
        })
      )

      if (!query) {
        throw new Error('Query composable failed to initialize')
      }

      await query.loadNextPage()

      expect(loadItems).toHaveBeenCalledWith({ page: 1 })
    })
  })

  it('does not load the next page when already loading or fully loaded', async () => {
    const collectionId = ref(11)
    const viewId = ref<number | null>(null)
    const safeFields = ref<Field[]>([])
    const paging = createPagingState(Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      collection_id: 11,
      order: index,
      data: {}
    })))
    const loadItems = vi.fn(async () => undefined)
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => null)
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          viewId,
          safeFields,
          items: paging.items,
          itemsLoading: paging.itemsLoading,
          itemsFullyLoaded: paging.itemsFullyLoaded,
          loadItems,
          loadViewConfig,
          saveViewConfig
        })
      )

      if (!query) {
        throw new Error('Query composable failed to initialize')
      }

      paging.itemsLoading.value = true
      await query.loadNextPage()
      paging.itemsLoading.value = false
      paging.itemsFullyLoaded.value = true
      await query.loadNextPage()

      expect(loadItems).not.toHaveBeenCalled()
    })
  })
})
