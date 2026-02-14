import { computed, ref, type Ref } from 'vue'
import type {
  Field,
  Item,
  ItemData,
  ItemDataValue
} from '../../types/models'
import { formatDateForStorage, parseDateValue } from '../../utils/date'

export type FormValue = ItemDataValue | Date
export type ItemFormData = Record<string, FormValue>
export type DateModelValue = Date | Array<Date> | Array<Date | null> | null | undefined

export function createEmptyItemFormData(): ItemFormData {
  return Object.create(null) as ItemFormData
}

export function createDefaultItemFormData(fields: Field[]): ItemFormData {
  const data = createEmptyItemFormData()
  fields.forEach(field => {
    data[field.name] = field.type === 'date' ? null : ''
  })
  return data
}

export function buildItemFormDataFromItem(item: Item, fields: Field[]): ItemFormData {
  const data = createEmptyItemFormData()
  fields.forEach(field => {
    const currentValue = item.data[field.name]
    if (field.type === 'date') {
      data[field.name] = parseDateValue(currentValue)
    } else if (
      field.type === 'number' &&
      currentValue !== '' &&
      currentValue !== null &&
      currentValue !== undefined
    ) {
      data[field.name] = Number(currentValue)
    } else {
      data[field.name] = currentValue ?? ''
    }
  })
  return data
}

export function buildItemDataFromForm(formData: ItemFormData, fields: Field[]): ItemData {
  const plainData = Object.create(null) as ItemData
  fields.forEach(field => {
    if (field.type === 'date') {
      plainData[field.name] = formatDateForStorage(formData[field.name])
      return
    }

    const value = formData[field.name]
    plainData[field.name] = value === null || value === undefined ? '' : (value as ItemDataValue)
  })
  return plainData
}

export function useCollectionItemForm(fields: Ref<Field[]>) {
  const formData = ref<ItemFormData>(createDefaultItemFormData(fields.value))
  const editingItem = ref<Item | null>(null)
  const isEditing = computed(() => editingItem.value !== null)

  function resetFormData() {
    formData.value = createDefaultItemFormData(fields.value)
  }

  function startCreate() {
    editingItem.value = null
    resetFormData()
  }

  function startEdit(item: Item) {
    editingItem.value = item
    formData.value = buildItemFormDataFromItem(item, fields.value)
  }

  function cancelForm() {
    editingItem.value = null
    resetFormData()
  }

  function toItemData(): ItemData {
    return buildItemDataFromForm(formData.value, fields.value)
  }

  function getFieldInputId(field: Field) {
    return `field-input-${field.id}`
  }

  function getSelectOptions(field: Field) {
    if (!field.options) return []
    return field.options.split(',').map((opt: string) => opt.trim())
  }

  function getTextValue(fieldName: string): string | null {
    const value = formData.value[fieldName]
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    return String(value)
  }

  function setTextValue(fieldName: string, value: string | null | undefined) {
    formData.value[fieldName] = value ?? ''
  }

  function getSelectValue(fieldName: string): string | null {
    const value = formData.value[fieldName]
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    return String(value)
  }

  function setSelectValue(fieldName: string, value: string | null | undefined) {
    formData.value[fieldName] = value ?? ''
  }

  function getNumberValue(fieldName: string): number | null {
    const value = formData.value[fieldName]
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  function setNumberValue(fieldName: string, value: number | null | undefined) {
    formData.value[fieldName] = value ?? ''
  }

  function getDateValue(fieldName: string): Date | null {
    const value = formData.value[fieldName]
    if (value === null || value === undefined || value === '') return null
    if (value instanceof Date) return value
    return parseDateValue(value)
  }

  function setDateValue(fieldName: string, value: DateModelValue) {
    if (value instanceof Date) {
      formData.value[fieldName] = value
      return
    }
    formData.value[fieldName] = null
  }

  return {
    formData,
    editingItem,
    isEditing,
    startCreate,
    startEdit,
    cancelForm,
    resetFormData,
    toItemData,
    getFieldInputId,
    getSelectOptions,
    getTextValue,
    setTextValue,
    getSelectValue,
    setSelectValue,
    getNumberValue,
    setNumberValue,
    getDateValue,
    setDateValue
  }
}
