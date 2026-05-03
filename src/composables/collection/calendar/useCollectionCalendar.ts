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
  ItemSortSpec
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
  groupingFieldId: Ref<number | null>
  cardTitleField: Ref<Field | null>
}

function normalizeFieldId(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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
  groupingFieldId,
  cardTitleField
}: UseCollectionCalendarParams) {
  const today = new Date()
  const displayedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
  const weekdayLabels = buildWeekdayLabels()
  const isEnsuringAllItems = ref(false)
  let loadAllToken = 0

  const dateFields = computed(() => {
    return orderedFields.value.filter(field => field.type === 'date')
  })

  const titleField = computed(() => {
    return orderedFields.value.find(field => field.type === 'text' || field.type === 'longtext') ?? null
  })

  const selectedDateFieldId = computed(() => {
    if (dateFields.value.length === 0) {
      return null
    }

    const desired = normalizeFieldId(groupingFieldId.value)
    if (desired !== null) {
      const exists = dateFields.value.some(field => field.id === desired)
      if (exists) {
        return desired
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
    const resolvedTitleField = cardTitleField.value ?? titleField.value

    for (const item of items.value) {
      const parsedDate = parseDateValue(item.data[selectedField.name] ?? null)
      if (!parsedDate) {
        continue
      }

      const dateKey = formatDateKey(parsedDate)
      const labelValue = resolvedTitleField ? item.data[resolvedTitleField.name] : null
      const label =
        labelValue !== null && labelValue !== undefined && String(labelValue).trim().length > 0
          ? String(labelValue).trim()
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

  const sidebarItems = computed(() => {
    const selectedField = selectedDateField.value
    if (!selectedField) {
      return []
    }

    const year = displayedMonth.value.getFullYear()
    const month = displayedMonth.value.getMonth()

    return items.value
      .filter(item => {
        const parsedDate = parseDateValue(item.data[selectedField.name] ?? null)
        return parsedDate && parsedDate.getFullYear() === year && parsedDate.getMonth() === month
      })
      .sort((a, b) => {
        const dateA = parseDateValue(a.data[selectedField.name] ?? null)?.getTime() ?? 0
        const dateB = parseDateValue(b.data[selectedField.name] ?? null)?.getTime() ?? 0
        return dateA - dateB
      })
  })

  const monthCells = computed<CalendarMonthCell[]>(() => {
    return monthGrid.value.map(cell => ({
      ...cell,
      items: groupedItems.value[cell.key] ?? []
    }))
  })

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

  function setMonth(month: number) {
    displayedMonth.value = new Date(
      displayedMonth.value.getFullYear(),
      month,
      1
    )
  }

  function setYear(year: number) {
    displayedMonth.value = new Date(
      year,
      displayedMonth.value.getMonth(),
      1
    )
  }

  async function runLoadAllLoop(token: number) {
    while (token === loadAllToken) {
      if (selectedDateFieldId.value === null) {
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
    if (selectedDateFieldId.value === null || isEnsuringAllItems.value) {
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
    () => {
      displayedMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
      loadAllToken += 1
      isEnsuringAllItems.value = false
    },
    { immediate: true }
  )

  watch(
    [selectedDateFieldId, itemsLoading, itemsFullyLoaded, itemsSearch, itemsSort, () => items.value.length],
    () => {
      if (selectedDateFieldId.value === null) {
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
  })

  return {
    dateFields,
    weekdayLabels,
    selectedDateField,
    selectedDateFieldId,
    monthLabel,
    displayedMonth,
    monthCells,
    sidebarItems,
    isEnsuringAllItems,
    goToPreviousMonth,
    goToNextMonth,
    setMonth,
    setYear
  }
}
