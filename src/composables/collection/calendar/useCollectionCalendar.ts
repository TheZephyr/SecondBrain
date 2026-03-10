import {
  computed,
  onScopeDispose,
  ref,
  watch,
  type Ref,
} from 'vue'
import type {
  Field,
  Item,
  ItemSortSpec,
  ViewConfig
} from '../../../types/models'
import type { LoadItemsOptions } from '../useCollectionItemsQuery'
import {
  buildMonthGrid,
  formatMonthYear,
  parseDateValue,
  type MonthGridCell
} from '../../../utils/date'

const ITEMS_PAGE_SIZE = 100

export type CalendarDayItem = {
  item: Item
  label: string
}

export type CalendarMonthCell = MonthGridCell & {
  items: CalendarDayItem[]
}

type UseCollectionCalendarParams = {
  viewId: Ref<number>
  orderedFields: Ref<Field[]>
  items: Ref<Item[]>
  itemsLoading: Ref<boolean>
  itemsFullyLoaded: Ref<boolean>
  itemsSearch: Ref<string>
  itemsSort: Ref<ItemSortSpec[]>
  loadItems: (options?: LoadItemsOptions) => Promise<void>
  loadViewConfig: (viewId: number) => Promise<ViewConfig | null>
  saveViewConfig: (viewId: number, config: ViewConfig) => Promise<void>
}

function normalizeFieldName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeFieldId(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizeViewConfig(config: ViewConfig | null): ViewConfig {
  return {
    columnWidths: { ...(config?.columnWidths ?? {}) },
    sort: (config?.sort ?? []).map(entry => ({
      field: entry.field,
      order: entry.order
    })),
    calendarDateField: normalizeFieldName(config?.calendarDateField) ?? undefined,
    calendarDateFieldId: normalizeFieldId(config?.calendarDateFieldId) ?? undefined,
    selectedFieldIds: config?.selectedFieldIds ?? []
  }
}

function buildWeekdayLabels(locale?: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const monday = new Date(2024, 0, 1)

  return Array.from({ length: 7 }, (_, index) => {
    return formatter.format(new Date(2024, 0, monday.getDate() + index))
  })
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isCalendarQuery(itemsSearch: string, itemsSort: ItemSortSpec[]): boolean {
  return itemsSearch === '' && itemsSort.length === 0
}

export function useCollectionCalendar({
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
}: UseCollectionCalendarParams) {
  const today = new Date()
  const displayedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
  const storedCalendarDateFieldId = ref<number | null>(null)
  const storedCalendarDateFieldName = ref<string | null>(null)
  const weekdayLabels = buildWeekdayLabels()
  const configLoaded = ref(false)
  const isEnsuringAllItems = ref(false)
  let configLoadToken = 0
  let loadAllToken = 0

  const dateFields = computed(() => {
    return orderedFields.value.filter(field => field.type === 'date')
  })

  const titleField = computed(() => {
    return orderedFields.value.find(field => field.type === 'text' || field.type === 'textarea') ?? null
  })

  const selectedDateFieldId = computed(() => {
    if (dateFields.value.length === 0) {
      return null
    }

    const storedId = normalizeFieldId(storedCalendarDateFieldId.value)
    if (storedId !== null) {
      const exists = dateFields.value.some(field => field.id === storedId)
      if (exists) {
        return storedId
      }
    }

    const normalizedStoredName = normalizeFieldName(storedCalendarDateFieldName.value)
    if (normalizedStoredName) {
      const match = dateFields.value.find(field => field.name === normalizedStoredName)
      if (match) {
        return match.id
      }
    }

    if (dateFields.value.length === 1) {
      return dateFields.value[0]?.id ?? null
    }

    return null
  })

  const selectedDateField = computed(() => {
    const selectedId = selectedDateFieldId.value
    if (!selectedId) {
      return null
    }

    return dateFields.value.find(field => field.id === selectedId) ?? null
  })

  const monthLabel = computed(() => {
    return formatMonthYear(
      displayedMonth.value.getFullYear(),
      displayedMonth.value.getMonth()
    )
  })

  const monthGrid = computed<MonthGridCell[]>(() => {
    return buildMonthGrid(
      displayedMonth.value.getFullYear(),
      displayedMonth.value.getMonth(),
      today
    )
  })

  const groupedItems = computed<Record<string, CalendarDayItem[]>>(() => {
    const selectedField = selectedDateField.value
    if (!selectedField) {
      return {}
    }

    const groups: Record<string, CalendarDayItem[]> = {}
    const resolvedTitleField = titleField.value

    for (const item of items.value) {
      const parsedDate = parseDateValue(item.data[selectedField.name] ?? null)
      if (!parsedDate) {
        continue
      }

      const dateKey = formatDateKey(parsedDate)
      const labelValue = resolvedTitleField ? item.data[resolvedTitleField.name] : null
      const label =
        typeof labelValue === 'string' && labelValue.trim().length > 0
          ? labelValue.trim()
          : `#${item.id}`

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }

      groups[dateKey]?.push({
        item,
        label
      })
    }

    return groups
  })

  const monthCells = computed<CalendarMonthCell[]>(() => {
    return monthGrid.value.map(cell => ({
      ...cell,
      items: groupedItems.value[cell.key] ?? []
    }))
  })

  async function persistCalendarDateField(nextFieldId: number | null) {
    const parsedViewId = Number(viewId.value)
    if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
      return
    }

    const existingConfig = normalizeViewConfig(await loadViewConfig(parsedViewId))
    const normalizedFieldId = normalizeFieldId(nextFieldId) ?? undefined

    await saveViewConfig(parsedViewId, {
      ...existingConfig,
      calendarDateField: undefined,
      calendarDateFieldId: normalizedFieldId
    })
  }

  async function setSelectedDateFieldId(nextFieldId: number | null) {
    const normalizedFieldId = normalizeFieldId(nextFieldId)
    storedCalendarDateFieldId.value = normalizedFieldId

    if (!configLoaded.value) {
      return
    }

    await persistCalendarDateField(normalizedFieldId)
  }

  function goToPreviousMonth() {
    displayedMonth.value = new Date(
      displayedMonth.value.getFullYear(),
      displayedMonth.value.getMonth() - 1,
      1
    )
  }

  function goToNextMonth() {
    displayedMonth.value = new Date(
      displayedMonth.value.getFullYear(),
      displayedMonth.value.getMonth() + 1,
      1
    )
  }

  async function runLoadAllLoop(token: number) {
    while (token === loadAllToken) {
      if (dateFields.value.length === 0) {
        return
      }

      if (itemsLoading.value) {
        return
      }

      if (!isCalendarQuery(itemsSearch.value, itemsSort.value)) {
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
    if (dateFields.value.length === 0 || isEnsuringAllItems.value) {
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
    viewId,
    async nextViewId => {
      const parsedViewId = Number(nextViewId)
      configLoaded.value = false
      storedCalendarDateFieldId.value = null
      storedCalendarDateFieldName.value = null

      if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
        configLoaded.value = true
        return
      }

      const token = ++configLoadToken
      const config = await loadViewConfig(parsedViewId)
      if (token !== configLoadToken) {
        return
      }

      const normalized = normalizeViewConfig(config)
      storedCalendarDateFieldId.value = normalizeFieldId(normalized.calendarDateFieldId)
      storedCalendarDateFieldName.value = normalizeFieldName(normalized.calendarDateField)
      configLoaded.value = true
    },
    { immediate: true }
  )

  watch(
    [selectedDateFieldId, configLoaded],
    ([resolvedFieldId, loaded]) => {
      if (!loaded) {
        return
      }

      if (normalizeFieldId(storedCalendarDateFieldId.value) === resolvedFieldId) {
        return
      }

      void setSelectedDateFieldId(resolvedFieldId)
    },
    { immediate: true }
  )

  watch(
    [dateFields, itemsLoading, itemsFullyLoaded, itemsSearch, itemsSort, () => items.value.length],
    () => {
      if (dateFields.value.length === 0) {
        return
      }

      if (itemsLoading.value && !isEnsuringAllItems.value) {
        return
      }

      if (isCalendarQuery(itemsSearch.value, itemsSort.value) && itemsFullyLoaded.value) {
        return
      }

      ensureAllItemsLoaded()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    loadAllToken += 1
    configLoadToken += 1
  })

  return {
    dateFields,
    weekdayLabels,
    selectedDateField,
    selectedDateFieldId,
    monthLabel,
    monthCells,
    isEnsuringAllItems,
    setSelectedDateFieldId,
    goToPreviousMonth,
    goToNextMonth
  }
}
