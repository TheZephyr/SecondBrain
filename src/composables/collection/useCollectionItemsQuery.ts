import { ref, watch, type Ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { Field, ItemSortSpec, ViewConfig } from '../../types/models'
import type {
  MultiSortMeta,
  RawSortMeta
} from '../../components/views/collection/types'

export type LoadItemsOptions = {
  search?: string
  sort?: ItemSortSpec[]
}

type SortStorage = Pick<Storage, 'getItem' | 'removeItem'>

type UseCollectionItemsQueryParams = {
  collectionId: Ref<number>
  viewId: Ref<number | null>
  safeFields: Ref<Field[]>
  loadItems: (options?: LoadItemsOptions) => Promise<void>
  loadViewConfig: (viewId: number) => Promise<ViewConfig | null>
  saveViewConfig: (viewId: number, config: ViewConfig) => Promise<void>
  storage?: SortStorage
  debounceMs?: number
}

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

function normalizeColumnWidths(
  value: Record<number, number> | Record<string, number> | undefined
): Record<number, number> {
  if (!value) {
    return {}
  }

  const normalized: Record<number, number> = {}
  for (const [fieldId, width] of Object.entries(value)) {
    const parsedFieldId = Number(fieldId)
    if (!Number.isInteger(parsedFieldId) || parsedFieldId <= 0) {
      continue
    }
    const parsedWidth = Number(width)
    if (!Number.isFinite(parsedWidth)) {
      continue
    }
    normalized[parsedFieldId] = Math.max(60, Math.round(parsedWidth))
  }
  return normalized
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
  safeFields,
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

  function canHydrateSortFromCurrentFields() {
    return (
      safeFields.value.length > 0 &&
      safeFields.value.every(field => field.collection_id === collectionId.value)
    )
  }

  async function persistSortForView(targetViewId: number, nextSortMeta: MultiSortMeta[]) {
    const existing = await loadViewConfig(targetViewId)
    const nextConfig: ViewConfig = {
      columnWidths: normalizeColumnWidths(existing?.columnWidths),
      sort: toItemSort(nextSortMeta).map(entry => ({
        field: entry.field,
        order: entry.order
      }))
    }
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
    const migratedConfig: ViewConfig = {
      columnWidths: normalizeColumnWidths(existingConfig?.columnWidths),
      sort: migratedSort
    }

    await saveViewConfig(targetViewId, migratedConfig)
    sortStorage.removeItem(storageKey)

    return parsePersistedSort(migratedSort)
  }

  async function applyPendingSortPreferences(token = sortHydrationToken) {
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
    [collectionId, viewId],
    async () => {
      resetSearchQuery()
      await hydrateSortForActiveView()
    },
    { immediate: true }
  )

  return {
    searchQuery,
    debouncedSearchQuery,
    multiSortMeta,
    onItemsSort
  }
}
