import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Field, Item, ItemSortSpec, ViewConfig } from '../../../types/models'
import type { LoadItemsOptions } from '../useCollectionItemsQuery'
import { parseFieldOptions } from '../../../utils/fieldOptions'
import { useItemsStore } from '../../../stores/items'
import { mergeViewConfig, normalizeKanbanColumnOrder } from '../../../utils/viewConfig'

const ITEMS_PAGE_SIZE = 100

export type KanbanColumn = {
  key: string | null
  label: string
  items: Item[]
}

type UseCollectionKanbanParams = {
  viewId: Ref<number>
  items: Ref<Item[]>
  itemsLoading: Ref<boolean>
  itemsFullyLoaded: Ref<boolean>
  itemsSearch: Ref<string>
  itemsSort: Ref<ItemSortSpec[]>
  loadItems: (options?: LoadItemsOptions) => Promise<void>
  orderedFields: Ref<Field[]>
  groupingFieldId: Ref<number | null>
  childViewConfig: Ref<ViewConfig | null>
  saveViewConfig: (viewId: number, config: ViewConfig) => Promise<void>
}

function isKanbanQuery(itemsSearch: string, itemsSort: ItemSortSpec[]): boolean {
  return itemsSearch === '' && itemsSort.length === 0
}

export function useCollectionKanban({
  viewId,
  items,
  itemsLoading,
  itemsFullyLoaded,
  itemsSearch,
  itemsSort,
  loadItems,
  orderedFields,
  groupingFieldId,
  childViewConfig,
  saveViewConfig
}: UseCollectionKanbanParams) {
  const itemsStore = useItemsStore()
  const isEnsuringAllItems = ref(false)
  let loadAllToken = 0

  const selectFields = computed(() => {
    return orderedFields.value.filter(field => field.type === 'select')
  })

  const groupingField = computed(() => {
    const desiredId = Number(groupingFieldId.value)
    if (!Number.isInteger(desiredId) || desiredId <= 0) {
      return null
    }

    return selectFields.value.find(field => field.id === desiredId) ?? null
  })

  const groupingOptions = computed(() => {
    if (!groupingField.value) {
      return []
    }

    const options = parseFieldOptions(groupingField.value.type, groupingField.value.options) as { choices?: string[] }
    return options.choices ?? []
  })

  const columnOrder = computed(() => {
    return (
      normalizeKanbanColumnOrder(
        childViewConfig.value?.kanbanColumnOrder,
        groupingOptions.value
      ) ?? groupingOptions.value
    )
  })

  const columns = computed<KanbanColumn[]>(() => {
    const field = groupingField.value
    const options = groupingOptions.value
    const optionSet = new Set(options)

    const uncategorizedItems: Item[] = []
    const optionBuckets = new Map<string, Item[]>()
    for (const option of options) {
      optionBuckets.set(option, [])
    }

    for (const item of items.value) {
      if (!field) {
        uncategorizedItems.push(item)
        continue
      }

      const rawValue = item.data[field.name]
      const value = typeof rawValue === 'string' ? rawValue : null
      if (!value || !optionSet.has(value)) {
        uncategorizedItems.push(item)
        continue
      }

      optionBuckets.get(value)?.push(item)
    }

    const sortedUncategorized = [...uncategorizedItems].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.id - b.id
    })

    const orderedKeys = columnOrder.value
    const orderedColumns = orderedKeys.map(key => {
      const bucket = optionBuckets.get(key) ?? []
      const sorted = [...bucket].sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order
        }
        return a.id - b.id
      })
      return {
        key,
        label: key,
        items: sorted
      }
    })

    return [
      {
        key: null,
        label: 'Uncategorized',
        items: sortedUncategorized
      },
      ...orderedColumns
    ]
  })

  async function persistKanbanColumnOrder(nextOrder: string[]) {
    const parsedViewId = Number(viewId.value)
    if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
      return
    }

    const existing = childViewConfig.value
    const config = mergeViewConfig(existing, {
      kanbanColumnOrder: nextOrder
    })

    await saveViewConfig(parsedViewId, config)
  }

  async function reorderColumns(fromKey: string, toKey: string) {
    if (fromKey === toKey) {
      return
    }

    const order = columnOrder.value
    const fromIndex = order.indexOf(fromKey)
    const toIndex = order.indexOf(toKey)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }

    const next = [...order]
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, fromKey)

    await persistKanbanColumnOrder(next)
  }

  async function reorderItemsInColumn(columnKey: string | null, orderedItemIds: number[]) {
    const targetColumn = columns.value.find(column => column.key === columnKey)
    if (!targetColumn) {
      return
    }

    const currentItems = targetColumn.items
    if (currentItems.length === 0) {
      return
    }

    const orderValues = [...currentItems]
      .sort((a, b) => a.order - b.order)
      .map(item => item.order)

    if (orderValues.length !== orderedItemIds.length) {
      return
    }

    await itemsStore.reorderItems({
      collectionId: currentItems[0].collection_id,
      itemOrders: orderedItemIds.map((id, index) => ({
        id,
        order: orderValues[index] ?? 0
      }))
    })
  }

  async function moveItemToColumn(item: Item, targetKey: string | null, afterItemId?: number | null) {
    const field = groupingField.value
    if (!field) {
      return
    }

    const patchValue = targetKey === null ? null : targetKey
    const mutation = await itemsStore.bulkPatchItems({
      collectionId: item.collection_id,
      updates: [{
        id: item.id,
        patch: {
          [field.name]: patchValue
        }
      }]
    })

    if (!mutation) {
      return
    }

    const targetColumn = columns.value.find(column => column.key === targetKey)
    if (!targetColumn) {
      return
    }

    const baseOrder = targetColumn.items.map(entry => entry.id)
    const filtered = baseOrder.filter(id => id !== item.id)
    let insertIndex = 0
    if (afterItemId !== null && afterItemId !== undefined) {
      const index = filtered.indexOf(afterItemId)
      if (index >= 0) {
        insertIndex = index + 1
      } else {
        insertIndex = filtered.length
      }
    }
    filtered.splice(insertIndex, 0, item.id)

    const orderValues = targetColumn.items.map(entry => entry.order)
    if (!baseOrder.includes(item.id)) {
      orderValues.push(item.order)
    }
    orderValues.sort((a, b) => a - b)

    if (orderValues.length !== filtered.length) {
      return
    }

    await itemsStore.reorderItems({
      collectionId: item.collection_id,
      itemOrders: filtered.map((id, index) => ({
        id,
        order: orderValues[index] ?? 0
      }))
    })
  }

  async function runLoadAllLoop(token: number) {
    while (token === loadAllToken) {
      if (!groupingField.value) {
        return
      }

      if (itemsLoading.value) {
        return
      }

      if (!isKanbanQuery(itemsSearch.value, itemsSort.value)) {
        await loadItems({
          search: '',
          sort: []
        })
        continue
      }

      if (itemsFullyLoaded.value) {
        return
      }

      const nextPage = items.value.length === 0
        ? 0
        : Math.ceil(items.value.length / ITEMS_PAGE_SIZE)

      if (nextPage === 0) {
        await loadItems({
          search: '',
          sort: []
        })
        continue
      }

      await loadItems({ page: nextPage })
    }
  }

  function ensureAllItemsLoaded() {
    if (!groupingField.value || isEnsuringAllItems.value) {
      return
    }

    const token = ++loadAllToken
    isEnsuringAllItems.value = true

    void runLoadAllLoop(token).finally(() => {
      if (token === loadAllToken) {
        isEnsuringAllItems.value = false
      }
    })
  }

  watch(
    [groupingField, itemsLoading, itemsFullyLoaded, itemsSearch, itemsSort, () => items.value.length],
    () => {
      if (!groupingField.value) {
        return
      }

      if (itemsLoading.value && !isEnsuringAllItems.value) {
        return
      }

      if (isKanbanQuery(itemsSearch.value, itemsSort.value) && itemsFullyLoaded.value) {
        return
      }

      ensureAllItemsLoaded()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    loadAllToken += 1
  })

  return {
    selectFields,
    groupingField,
    groupingOptions,
    columnOrder,
    columns,
    isEnsuringAllItems,
    reorderColumns,
    moveItemToColumn,
    reorderItemsInColumn
  }
}
