import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { Field, Item, ItemSortSpec, ViewConfig } from '../../../types/models'
import { useCollectionCalendar } from '../calendar/useCollectionCalendar'

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

function makeItem(id: number, data: Item['data']): Item {
  return {
    id,
    collection_id: 1,
    order: id,
    data
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

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('useCollectionCalendar', () => {
  it('auto-selects and persists the single available date field', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 8))

    const viewId = ref(5)
    const orderedFields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', type: 'text' }),
      makeField({ id: 2, name: 'Due Date', type: 'date' })
    ])
    const items = ref<Item[]>([])
    const itemsLoading = ref(false)
    const itemsFullyLoaded = ref(true)
    const itemsSearch = ref('')
    const itemsSort = ref<ItemSortSpec[]>([])
    const loadItems = vi.fn(async () => undefined)
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => ({
      columnWidths: {},
      sort: []
    }))
    const saveViewConfig = vi.fn(async () => undefined)

    try {
      await withScope(async scope => {
        const calendar = scope.run(() =>
          useCollectionCalendar({
            viewId,
            orderedFields,
            items,
            itemsLoading,
            itemsFullyLoaded,
            itemsSearch,
            itemsSort,
            loadItems,
            loadViewConfig,
            saveViewConfig
          })
        )

        if (!calendar) {
          throw new Error('Calendar composable failed to initialize')
        }

        await flushAsyncWork()

        expect(calendar.selectedDateFieldName.value).toBe('Due Date')
        expect(saveViewConfig).toHaveBeenCalledWith(5, {
          columnWidths: {},
          sort: [],
          calendarDateField: 'Due Date'
        })
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears an invalid saved date field when multiple date fields exist', async () => {
    const viewId = ref(7)
    const orderedFields = ref<Field[]>([
      makeField({ id: 1, name: 'Start', type: 'date' }),
      makeField({ id: 2, name: 'Due', type: 'date' })
    ])
    const items = ref<Item[]>([])
    const itemsLoading = ref(false)
    const itemsFullyLoaded = ref(true)
    const itemsSearch = ref('')
    const itemsSort = ref<ItemSortSpec[]>([])
    const loadItems = vi.fn(async () => undefined)
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => ({
      columnWidths: { 1: 140 },
      sort: [{ field: 'data.Title', order: 1 }],
      calendarDateField: 'Missing'
    }))
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const calendar = scope.run(() =>
        useCollectionCalendar({
          viewId,
          orderedFields,
          items,
          itemsLoading,
          itemsFullyLoaded,
          itemsSearch,
          itemsSort,
          loadItems,
          loadViewConfig,
          saveViewConfig
        })
      )

      if (!calendar) {
        throw new Error('Calendar composable failed to initialize')
      }

      await flushAsyncWork()

      expect(calendar.selectedDateFieldName.value).toBeNull()
      expect(saveViewConfig).toHaveBeenCalledWith(7, {
        columnWidths: { 1: 140 },
        sort: [{ field: 'data.Title', order: 1 }],
        calendarDateField: undefined
      })
    })
  })

  it('groups items by the selected date field and falls back to item id for labels', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 8))

    const viewId = ref(9)
    const orderedFields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', type: 'text' }),
      makeField({ id: 2, name: 'Due Date', type: 'date' })
    ])
    const items = ref<Item[]>([
      makeItem(1, { Title: 'Ship alpha', 'Due Date': '2026-03-08' }),
      makeItem(2, { Title: '', 'Due Date': '2026-03-08' }),
      makeItem(3, { Title: 'Skip me', 'Due Date': '' })
    ])
    const itemsLoading = ref(false)
    const itemsFullyLoaded = ref(true)
    const itemsSearch = ref('')
    const itemsSort = ref<ItemSortSpec[]>([])
    const loadItems = vi.fn(async () => undefined)
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => ({
      columnWidths: {},
      sort: [],
      calendarDateField: 'Due Date'
    }))
    const saveViewConfig = vi.fn(async () => undefined)

    try {
      await withScope(async scope => {
        const calendar = scope.run(() =>
          useCollectionCalendar({
            viewId,
            orderedFields,
            items,
            itemsLoading,
            itemsFullyLoaded,
            itemsSearch,
            itemsSort,
            loadItems,
            loadViewConfig,
            saveViewConfig
          })
        )

        if (!calendar) {
          throw new Error('Calendar composable failed to initialize')
        }

        await flushAsyncWork()

        const todayCell = calendar.monthCells.value.find(cell => cell.key === '2026-03-08')
        expect(todayCell?.items.map(entry => entry.label)).toEqual(['Ship alpha', '#2'])
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets grid search and sort before loading all calendar pages', async () => {
    const viewId = ref(11)
    const orderedFields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', type: 'text' }),
      makeField({ id: 2, name: 'Due Date', type: 'date' })
    ])
    const items = ref<Item[]>([
      makeItem(1, { Title: 'A', 'Due Date': '2026-03-08' })
    ])
    const itemsLoading = ref(false)
    const itemsFullyLoaded = ref(false)
    const itemsSearch = ref('alpha')
    const itemsSort = ref<ItemSortSpec[]>([{ field: 'data.Title', order: -1 }])
    const loadItems = vi.fn(async (options?: { page?: number; search?: string; sort?: ItemSortSpec[] }) => {
      if (options?.search !== undefined) {
        itemsSearch.value = options.search
      }

      if (options?.sort !== undefined) {
        itemsSort.value = options.sort
      }

      if (options?.page === 1) {
        items.value = [
          ...items.value,
          makeItem(2, { Title: 'B', 'Due Date': '2026-03-09' })
        ]
        itemsFullyLoaded.value = true
        return
      }

      items.value = [makeItem(1, { Title: 'A', 'Due Date': '2026-03-08' })]
      itemsFullyLoaded.value = false
    })
    const loadViewConfig = vi.fn(async (): Promise<ViewConfig | null> => ({
      columnWidths: {},
      sort: [],
      calendarDateField: 'Due Date'
    }))
    const saveViewConfig = vi.fn(async () => undefined)

    await withScope(async scope => {
      const calendar = scope.run(() =>
        useCollectionCalendar({
          viewId,
          orderedFields,
          items,
          itemsLoading,
          itemsFullyLoaded,
          itemsSearch,
          itemsSort,
          loadItems,
          loadViewConfig,
          saveViewConfig
        })
      )

      if (!calendar) {
        throw new Error('Calendar composable failed to initialize')
      }

      await vi.waitFor(() => {
        expect(loadItems).toHaveBeenCalledTimes(2)
      })

      expect(loadItems).toHaveBeenNthCalledWith(1, {
        search: '',
        sort: []
      })
      expect(loadItems).toHaveBeenNthCalledWith(2, { page: 1 })
      expect(itemsSearch.value).toBe('')
      expect(itemsSort.value).toEqual([])
      expect(calendar.isEnsuringAllItems.value).toBe(false)
    })
  })
})
