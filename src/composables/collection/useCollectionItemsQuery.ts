import { ref, watch, type Ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { Field, Item, ItemSortSpec, ViewConfig, ViewType } from '../../types/models'
import type {
  MultiSortMeta,
  RawSortMeta
} from '../../components/collections/types'
import { mergeViewConfig } from '../../utils/viewConfig'

export type LoadItemsOptions = {
  page?: number
  search?: string
  sort?: ItemSortSpec[]
}

type SortStorage = Pick<Storage, 'getItem' | 'removeItem'>

type UseCollectionItemsQueryParams = {
  collectionId: Ref<number>
  viewId: Ref<number | null>
  activeViewType: Ref<ViewType | null>
  safeFields: Ref<Field[]>
  items: Ref<Item[]>
  itemsLoading: Ref<boolean>
  itemsFullyLoaded: Ref<boolean>
  loadItems: (options?: LoadItemsOptions) => Promise<void>
  loadViewConfig: (viewId: number) => Promise<ViewConfig | null>
  saveViewConfig: (viewId: number, config: ViewConfig) => Promise<void>
  storage?: SortStorage
  debounceMs?: number
}

const ITEMS_PAGE_SIZE = 100

const fallbackStorage: SortStorage = {
  getItem: () => null,
  removeItem: () => undefined
}

const migratedCollectionIds = new Set<number>()

function resolveStorage(storage?: SortStorage): SortStorage {
  if (storage) return storage
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return fallbackStorage
}

function parseRawSortMeta(value: string | null): RawSortMeta[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as RawSortMeta[]) : []
  } catch {
    return []
  }
}

function parsePersistedSort(sort: ItemSortSpec[] | undefined): RawSortMeta[] {
  if (!Array.isArray(sort)) return []
  return sort.map(entry => ({
    field: entry.field,
    order: entry.order
  }))
}

function sanitizeRawSort(meta: RawSortMeta[]): ItemSortSpec[] {
  return meta
    .filter(item => typeof item.field === 'string' && (item.order === 1 || item.order === -1))
    .map(item => ({
      field: item.field as string,
      order: item.order as 1 | -1
    }))
}

export function getSortStorageKey(collectionId: number): string {
  return `multi_sort_${collectionId}`
}

export function normalizeSortMeta(meta: RawSortMeta[], safeFields: Field[]): MultiSortMeta[] {
  return meta
    .filter(item => {
      if (!item.field) return false
      if (item.order !== 1 && item.order !== -1) return false
      const fieldName = item.field.startsWith('data.') ? item.field.slice(5) : item.field
      return safeFields.some(field => field.name === fieldName)
    })
    .map(item => ({
      field: item.field as string,
      order: item.order as 1 | -1
    }))
}

export function areSortMetaEqual(a: MultiSortMeta[], b: MultiSortMeta[]): boolean {
  if (a.length !== b.length) return false
  return a.every((entry, index) => entry.field === b[index]?.field && entry.order === b[index]?.order)
}

export function toItemSort(meta: MultiSortMeta[]): ItemSortSpec[] {
  return meta.map(entry => ({ field: entry.field, order: entry.order }))
}

export function useCollectionItemsQuery({
  collectionId,
  viewId,
  activeViewType,
  safeFields,
  items,
  itemsLoading,
  itemsFullyLoaded,
  loadItems,
  loadViewConfig,
  saveViewConfig,
  storage,
  debounceMs = 200
}: UseCollectionItemsQueryParams) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, debounceMs)
  const multiSortMeta = ref<MultiSortMeta[]>([])
  const sortStorage = resolveStorage(storage)
  const suppressNextEmptySearchLoad = ref(false)
  const pendingSortMeta = ref<RawSortMeta[]>([])
  const isSortHydrationPending = ref(false)
  let sortHydrationToken = 0

  function isGridViewActive() {
    return activeViewType.value === 'grid'
  }

  function canHydrateSortFromCurrentFields() {
    return (
      safeFields.value.length > 0 &&
      safeFields.value.every(field => field.collection_id === collectionId.value)
    )
  }

  async function persistSortForView(targetViewId: number, nextSortMeta: MultiSortMeta[]) {
    const existing = await loadViewConfig(targetViewId)
    const nextConfig: ViewConfig = mergeViewConfig(existing, {
      sort: toItemSort(nextSortMeta).map(entry => ({
        field: entry.field,
        order: entry.order
      }))
    })
    await saveViewConfig(targetViewId, nextConfig)
  }

  async function migrateLegacySortIfNeeded(
    targetViewId: number,
    existingConfig: ViewConfig | null
  ): Promise<RawSortMeta[] | null> {
    const currentCollectionId = collectionId.value
    if (migratedCollectionIds.has(currentCollectionId)) {
      return null
    }
    migratedCollectionIds.add(currentCollectionId)

    const storageKey = getSortStorageKey(currentCollectionId)
    const rawLegacySort = sortStorage.getItem(storageKey)
    if (rawLegacySort === null) {
      return null
    }

    const parsedLegacySort = parseRawSortMeta(rawLegacySort)
    const migratedSort = sanitizeRawSort(parsedLegacySort)
    const migratedConfig: ViewConfig = mergeViewConfig(existingConfig, {
      sort: migratedSort
    })

    await saveViewConfig(targetViewId, migratedConfig)
    sortStorage.removeItem(storageKey)

    return parsePersistedSort(migratedSort)
  }

  async function applyPendingSortPreferences(token = sortHydrationToken) {
    if (!isGridViewActive()) {
      pendingSortMeta.value = []
      isSortHydrationPending.value = false
      multiSortMeta.value = []
      return
    }
    if (!isSortHydrationPending.value) return
    if (token !== sortHydrationToken) return

    const normalized = normalizeSortMeta(pendingSortMeta.value, safeFields.value)
    pendingSortMeta.value = []
    isSortHydrationPending.value = false
    multiSortMeta.value = normalized

    if (normalized.length > 0) {
      await loadItems({
        search: '',
        sort: toItemSort(normalized)
      })
    }
  }

  async function hydrateSortForActiveView() {
    const token = ++sortHydrationToken
    pendingSortMeta.value = []
    isSortHydrationPending.value = true
    multiSortMeta.value = []

    if (!isGridViewActive()) {
      isSortHydrationPending.value = false
      return
    }

    const targetViewId = viewId.value
    if (targetViewId === null) {
      isSortHydrationPending.value = false
      return
    }

    const existingConfig = await loadViewConfig(targetViewId)
    if (token !== sortHydrationToken) return

    const migratedSort = await migrateLegacySortIfNeeded(targetViewId, existingConfig)
    if (token !== sortHydrationToken) return

    pendingSortMeta.value =
      migratedSort ?? parsePersistedSort(existingConfig?.sort)
    isSortHydrationPending.value = true
    multiSortMeta.value = []

    if (canHydrateSortFromCurrentFields()) {
      await applyPendingSortPreferences(token)
    }
  }

  async function onItemsSort(nextMeta: MultiSortMeta[]) {
    if (!isGridViewActive()) {
      multiSortMeta.value = []
      return
    }
    pendingSortMeta.value = []
    isSortHydrationPending.value = false
    multiSortMeta.value = nextMeta

    await loadItems({
      sort: toItemSort(nextMeta)
    })

    const targetViewId = viewId.value
    if (targetViewId !== null) {
      await persistSortForView(targetViewId, nextMeta)
    }
  }

  function resetSearchQuery() {
    if (searchQuery.value !== '') {
      suppressNextEmptySearchLoad.value = true
    }
    searchQuery.value = ''
  }

  watch(debouncedSearchQuery, async query => {
    if (!isGridViewActive()) {
      suppressNextEmptySearchLoad.value = false
      return
    }
    if (query === '' && suppressNextEmptySearchLoad.value) {
      suppressNextEmptySearchLoad.value = false
      return
    }
    suppressNextEmptySearchLoad.value = false
    await loadItems({
      search: query
    })
  })

  watch(
    () => safeFields.value,
    () => {
      if (!isGridViewActive()) {
        multiSortMeta.value = []
        pendingSortMeta.value = []
        isSortHydrationPending.value = false
        return
      }

      if (!canHydrateSortFromCurrentFields()) {
        return
      }

      if (isSortHydrationPending.value) {
        void applyPendingSortPreferences()
        return
      }

      const normalized = normalizeSortMeta(multiSortMeta.value, safeFields.value)
      if (!areSortMetaEqual(multiSortMeta.value, normalized)) {
        multiSortMeta.value = normalized
        void loadItems({
          sort: toItemSort(normalized)
        })

        const targetViewId = viewId.value
        if (targetViewId !== null) {
          void persistSortForView(targetViewId, normalized)
        }
      }
    }
  )

  watch(
    [collectionId, viewId, activeViewType],
    async () => {
      resetSearchQuery()
      await hydrateSortForActiveView()
    },
    { immediate: true }
  )

  async function loadNextPage() {
    if (itemsFullyLoaded.value || itemsLoading.value) {
      return
    }
    if (items.value.length === 0) {
      return
    }

    const nextPage = Math.ceil(items.value.length / ITEMS_PAGE_SIZE)
    await loadItems({ page: nextPage })
  }

  return {
    searchQuery,
    debouncedSearchQuery,
    multiSortMeta,
    onItemsSort,
    loadNextPage
  }
}
