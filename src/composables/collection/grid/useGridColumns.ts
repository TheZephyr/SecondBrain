import { computed, ref, watch, type Ref } from 'vue'
import type { Field, Item, ViewConfig } from '../../../types/models'
import type { GridColumnDef } from '../../../components/views/collection/grid/types'
import { useStore } from '../../../store'

type UseGridColumnsParams = {
  orderedFields: Ref<Field[]>
  viewId: Ref<number>
}

const MIN_COLUMN_WIDTH = 60
const ROW_NUMBER_COLUMN_WIDTH = 52
const ADD_FIELD_COLUMN_WIDTH = 40

function normalizeColumnWidths(
  value: Record<number, number> | Record<string, number> | undefined,
  allowedFieldIds?: Set<number>
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
    if (allowedFieldIds && !allowedFieldIds.has(parsedFieldId)) {
      continue
    }

    const parsedWidth = Number(width)
    if (!Number.isFinite(parsedWidth)) {
      continue
    }
    normalized[parsedFieldId] = Math.max(MIN_COLUMN_WIDTH, Math.round(parsedWidth))
  }
  return normalized
}

function buildAllowedFieldIdSet(fields: Field[]): Set<number> {
  return new Set(fields.map(field => field.id))
}

export function useGridColumns({ orderedFields, viewId }: UseGridColumnsParams) {
  const store = useStore()
  const columnWidths = ref<Record<number, number>>({})
  let loadToken = 0

  const columns = computed<GridColumnDef[]>(() => {
    const fieldColumns: GridColumnDef[] = orderedFields.value.map(field => ({
      id: `field_${field.id}`,
      header: field.name,
      accessorFn: (row: Item) => row.data[field.name],
      meta: {
        type: 'field',
        field
      }
    }))

    return [
      {
        id: 'rowNumber',
        header: '',
        cell: () => null,
        meta: {
          type: 'rowNumber'
        }
      },
      ...fieldColumns,
      {
        id: 'addField',
        header: '',
        cell: () => null,
        meta: {
          type: 'addField'
        }
      }
    ]
  })

  const gridTemplateColumns = computed(() => {
    const fieldSegments = orderedFields.value.map(field => {
      const width = columnWidths.value[field.id]
      if (!width) {
        return `minmax(${MIN_COLUMN_WIDTH}px, 1fr)`
      }
      return `${Math.max(MIN_COLUMN_WIDTH, width)}px`
    })

    if (fieldSegments.length === 0) {
      return `${ROW_NUMBER_COLUMN_WIDTH}px ${ADD_FIELD_COLUMN_WIDTH}px`
    }

    return `${ROW_NUMBER_COLUMN_WIDTH}px ${fieldSegments.join(' ')} ${ADD_FIELD_COLUMN_WIDTH}px`
  })

  function setColumnWidth(fieldId: number, width: number) {
    if (!Number.isInteger(fieldId) || fieldId <= 0) {
      return
    }
    const normalizedWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(Number(width)))
    columnWidths.value = {
      ...columnWidths.value,
      [fieldId]: normalizedWidth
    }
  }

  async function persistColumnWidths() {
    const targetViewId = Number(viewId.value)
    if (!Number.isInteger(targetViewId) || targetViewId <= 0) {
      return
    }

    const existingConfig = await store.loadViewConfig(targetViewId)
    const nextConfig: ViewConfig = {
      columnWidths: normalizeColumnWidths(columnWidths.value, buildAllowedFieldIdSet(orderedFields.value)),
      sort: (existingConfig?.sort ?? []).map(entry => ({
        field: entry.field,
        order: entry.order
      })),
      calendarDateField: existingConfig?.calendarDateField
    }
    await store.saveViewConfig(targetViewId, nextConfig)
  }

  watch(
    orderedFields,
    nextFields => {
      columnWidths.value = normalizeColumnWidths(
        columnWidths.value,
        buildAllowedFieldIdSet(nextFields)
      )
    },
    { immediate: true }
  )

  watch(
    viewId,
    async nextViewId => {
      const parsedViewId = Number(nextViewId)
      if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
        columnWidths.value = {}
        return
      }

      const token = ++loadToken
      const config = await store.loadViewConfig(parsedViewId)
      if (token !== loadToken) {
        return
      }

      const allowedFieldIds = buildAllowedFieldIdSet(orderedFields.value)
      columnWidths.value = normalizeColumnWidths(config?.columnWidths, allowedFieldIds)
    },
    { immediate: true }
  )

  return {
    columns,
    columnWidths,
    gridTemplateColumns,
    setColumnWidth,
    persistColumnWidths
  }
}
