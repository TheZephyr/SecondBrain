import { ref, type Ref } from 'vue'
import type { Field, Item, ItemData, ItemDataValue } from '../../../types/models'
import { useStore } from '../../../store'
import { formatDateForStorage, parseDateInput } from '../../../utils/date'
import { parseFieldOptions } from '../../../utils/fieldOptions'
import {
  serializeMultiselectValue,
  serializeBooleanValue,
  parseRatingValue,
  serializeRatingValue
} from '../../../utils/fieldValues'
import type { GridCellKey, GridSelectionContext } from '../../../components/collections/grid/types'
import { buildGridCellKey, parseGridCellKey } from './useGridSelection'

type UseGridEditingParams = {
  items: Ref<Item[]>
  orderedFields: Ref<Field[]>
  selection: GridSelectionContext
}

function normalizeValue(field: Field, value: ItemDataValue | Date | null | undefined): ItemDataValue {
  if (field.type === 'date') {
    const options = parseFieldOptions(field.type, field.options) as { format?: string } | null
    const parsed = parseDateInput(value ?? '', options?.format)
    return formatDateForStorage(parsed ?? '')
  }

  if (field.type === 'number') {
    if (value === null || value === undefined || value === '') return ''
    if (typeof value === 'number') return Number.isFinite(value) ? value : ''
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : ''
    }
    return ''
  }

  if (field.type === 'rating') {
    return serializeRatingValue(parseRatingValue(value as ItemDataValue))
  }

  if (field.type === 'multiselect') {
    if (Array.isArray(value)) {
      return serializeMultiselectValue(value) ?? null
    }
    if (typeof value === 'string') return value
    return null
  }

  if (field.type === 'boolean') {
    return serializeBooleanValue(value as ItemDataValue)
  }

  if (field.type === 'select') {
    if (value === null || value === undefined || value === '') return null
    return String(value)
  }

  if (value === null || value === undefined) return ''
  return String(value)
}

export function useGridEditing({ items, orderedFields, selection }: UseGridEditingParams) {
  const store = useStore()
  const editingCellKey = ref<GridCellKey | null>(null)

  function startEdit(rowId: number, fieldName: string) {
    selection.selectCell(rowId, fieldName)
    editingCellKey.value = buildGridCellKey(rowId, fieldName)
  }

  async function commitEdit(value: ItemDataValue | Date | null | undefined) {
    const currentKey = editingCellKey.value
    if (!currentKey) return
    const parsed = parseGridCellKey(currentKey)
    editingCellKey.value = null
    if (!parsed) return

    const field = orderedFields.value.find(entry => entry.name === parsed.fieldName)
    const item = items.value.find(entry => entry.id === parsed.rowId)
    if (!field || !item) return

    const normalized = normalizeValue(field, value)
    const previousValue = (item.data[field.name] ?? '') as ItemDataValue
    if (previousValue === normalized) return

    const nextData: ItemData = {
      ...item.data,
      [field.name]: normalized
    }

    await store.updateItem({
      id: item.id,
      data: { ...nextData }
    })
  }

  function cancelEdit() {
    editingCellKey.value = null
  }

  return {
    editingCellKey,
    startEdit,
    commitEdit,
    cancelEdit
  }
}
