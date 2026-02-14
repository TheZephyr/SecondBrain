import { ref, watch, type Ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { Field, ItemSortSpec } from '../../types/models'
import type {
  MultiSortMeta,
  RawSortMeta,
  TablePageEventLike,
  TableSortEventLike
} from '../../components/views/collection/types'

export type LoadItemsOptions = {
  page?: number
  rows?: number
  search?: string
  sort?: ItemSortSpec[]
}

type SortStorage = Pick<Storage, 'getItem' | 'setItem'>

type UseCollectionItemsQueryParams = {
  collectionId: Ref<number>
  safeFields: Ref<Field[]>
  loadItems: (options?: LoadItemsOptions) => Promise<void>
  storage?: SortStorage
  debounceMs?: number
}

const fallbackStorage: SortStorage = {
  getItem: () => null,
  setItem: () => undefined
}

function resolveStorage(storage?: SortStorage): SortStorage {
  if (storage) return storage
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return fallbackStorage
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
  safeFields,
  loadItems,
  storage,
  debounceMs = 200
}: UseCollectionItemsQueryParams) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, debounceMs)
  const multiSortMeta = ref<MultiSortMeta[]>([])
  const sortStorage = resolveStorage(storage)
  const suppressNextEmptySearchLoad = ref(false)
  const pendingSortMeta = ref<RawSortMeta[] | null>(null)
  const isSortHydrationPending = ref(false)

  function saveSortPreferences() {
    sortStorage.setItem(getSortStorageKey(collectionId.value), JSON.stringify(multiSortMeta.value))
  }

  function loadSortPreferences() {
    const saved = sortStorage.getItem(getSortStorageKey(collectionId.value))
    let parsed: RawSortMeta[] = []

    if (saved) {
      try {
        const decoded = JSON.parse(saved) as unknown
        parsed = Array.isArray(decoded) ? (decoded as RawSortMeta[]) : []
      } catch {
        parsed = []
      }
    }

    pendingSortMeta.value = parsed
    isSortHydrationPending.value = true
    multiSortMeta.value = []
  }

  function canHydrateSortFromCurrentFields() {
    return (
      safeFields.value.length > 0 &&
      safeFields.value.every(field => field.collection_id === collectionId.value)
    )
  }

  async function applyPendingSortPreferences() {
    if (!isSortHydrationPending.value) return

    const normalized = normalizeSortMeta(pendingSortMeta.value ?? [], safeFields.value)
    pendingSortMeta.value = null
    isSortHydrationPending.value = false
    multiSortMeta.value = normalized
    saveSortPreferences()

    if (normalized.length > 0) {
      await loadItems({
        page: 0,
        search: '',
        sort: toItemSort(normalized)
      })
    }
  }

  async function onItemsPage(event: TablePageEventLike) {
    const rowsFromEvent = event.rows ?? 50
    const rows = rowsFromEvent > 0 ? rowsFromEvent : 50
    const page = rows > 0 ? Math.floor(event.first / rows) : 0
    await loadItems({ page, rows })
  }

  async function onItemsSort(event: TableSortEventLike) {
    pendingSortMeta.value = null
    isSortHydrationPending.value = false
    const nextMeta = normalizeSortMeta((event.multiSortMeta || []) as RawSortMeta[], safeFields.value)
    multiSortMeta.value = nextMeta
    await loadItems({
      page: 0,
      sort: toItemSort(nextMeta)
    })
  }

  function resetSearchQuery() {
    if (searchQuery.value !== '') {
      suppressNextEmptySearchLoad.value = true
    }
    searchQuery.value = ''
  }

  watch(
    multiSortMeta,
    () => {
      if (isSortHydrationPending.value) return
      saveSortPreferences()
    },
    { deep: true }
  )

  watch(debouncedSearchQuery, async query => {
    if (query === '' && suppressNextEmptySearchLoad.value) {
      suppressNextEmptySearchLoad.value = false
      return
    }
    suppressNextEmptySearchLoad.value = false
    await loadItems({
      page: 0,
      search: query
    })
  })

  watch(
    () => safeFields.value,
    () => {
      if (isSortHydrationPending.value) {
        void applyPendingSortPreferences()
        return
      }

      const normalized = normalizeSortMeta(multiSortMeta.value, safeFields.value)
      if (!areSortMetaEqual(multiSortMeta.value, normalized)) {
        multiSortMeta.value = normalized
        void loadItems({
          page: 0,
          sort: toItemSort(normalized)
        })
      }
      saveSortPreferences()
    }
  )

  watch(
    collectionId,
    async () => {
      resetSearchQuery()
      loadSortPreferences()
      if (canHydrateSortFromCurrentFields()) {
        await applyPendingSortPreferences()
      }
    },
    { immediate: true }
  )

  return {
    searchQuery,
    debouncedSearchQuery,
    multiSortMeta,
    onItemsPage,
    onItemsSort
  }
}
