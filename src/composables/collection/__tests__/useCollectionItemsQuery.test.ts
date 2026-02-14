import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { Field } from '../../../types/models'
import type { RawSortMeta } from '../../../components/views/collection/types'
import {
  getSortStorageKey,
  normalizeSortMeta,
  useCollectionItemsQuery
} from '../useCollectionItemsQuery'

function makeField(input: Partial<Field> & Pick<Field, 'id' | 'name'>): Field {
  return {
    id: input.id,
    collection_id: 1,
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
    setItem(key: string, value: string) {
      map.set(key, value)
    }
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

  it('restores saved sort preferences for the active collection', async () => {
    const collectionId = ref(9)
    const safeFields = ref<Field[]>([makeField({ id: 1, name: 'Title' })])
    const storage = createMemoryStorage({
      [getSortStorageKey(9)]: JSON.stringify([
        { field: 'data.Title', order: -1 },
        { field: 'data.Unknown', order: 1 }
      ])
    })
    const loadItems = vi.fn(async () => undefined)

    await withScope(async scope => {
      const query = scope.run(() =>
        useCollectionItemsQuery({
          collectionId,
          safeFields,
          storage,
          loadItems,
          debounceMs: 10
        })
      )

      if (!query) {
        throw new Error('Query composable failed to initialize')
      }

      await nextTick()

      expect(query.multiSortMeta.value).toEqual([
        { field: 'data.Title', order: -1 }
      ])
      expect(loadItems).toHaveBeenCalledWith({
        page: 0,
        search: '',
        sort: [{ field: 'data.Title', order: -1 }]
      })
    })
  })

  it('triggers a debounced search load', async () => {
    vi.useFakeTimers()
    const collectionId = ref(1)
    const safeFields = ref<Field[]>([makeField({ id: 1, name: 'Title' })])
    const storage = createMemoryStorage()
    const loadItems = vi.fn(async () => undefined)

    try {
      await withScope(async scope => {
        const query = scope.run(() =>
          useCollectionItemsQuery({
            collectionId,
            safeFields,
            storage,
            loadItems,
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
          page: 0,
          search: 'alpha'
        })
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
