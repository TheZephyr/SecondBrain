import { computed, ref, watch, type Ref } from 'vue'
import type {
  Field,
  Item,
  ItemData,
  ItemDataValue,
  SelectFieldOptions,
  MultiselectFieldOptions,
  DateFieldOptions,
  NumberFieldOptions,
  RatingFieldOptions
} from '../../types/models'
import { formatDateForStorage, parseDateValue } from '../../utils/date'
import { parseFieldOptions } from '../../utils/fieldOptions'
import {
  parseMultiselectValue,
  parseBooleanValue,
  parseRatingValue,
  serializeBooleanValue,
  serializeMultiselectValue,
  serializeRatingValue
} from '../../utils/fieldValues'

export type FormValue = ItemDataValue | Date
export type ItemFormData = Record<string, FormValue>
export type DateModelValue = Date | Array<Date> | Array<Date | null> | null | undefined

export function createEmptyItemFormData(): ItemFormData {
  return Object.create(null) as ItemFormData
}

export function createDefaultItemFormData(fields: Field[]): ItemFormData {
  const data = createEmptyItemFormData()
  fields.forEach(field => {
    const options = parseFieldOptions(field.type, field.options)

    if (field.type === 'date') {
      const dateOptions = options as DateFieldOptions
      if (dateOptions.defaultValue === 'current') {
        data[field.name] = new Date()
        return
      }
      if (typeof dateOptions.defaultValue === 'string' && dateOptions.defaultValue) {
        data[field.name] = parseDateValue(dateOptions.defaultValue)
        return
      }
      data[field.name] = null
      return
    }

    if (field.type === 'number') {
      const numberOptions = options as NumberFieldOptions
      data[field.name] =
        typeof numberOptions.defaultValue === 'number' ? numberOptions.defaultValue : ''
      return
    }

    if (field.type === 'rating') {
      const ratingOptions = options as RatingFieldOptions
      data[field.name] =
        typeof ratingOptions.defaultValue === 'number' ? ratingOptions.defaultValue : null
      return
    }

    if (field.type === 'select') {
      const selectOptions = options as SelectFieldOptions
      data[field.name] =
        typeof selectOptions.defaultValue === 'string' ? selectOptions.defaultValue : null
      return
    }

    if (field.type === 'multiselect') {
      const multiselectOptions = options as MultiselectFieldOptions
      const defaultValue = multiselectOptions.defaultValue ?? null
      data[field.name] = serializeMultiselectValue(defaultValue) ?? null
      return
    }

    if (field.type === 'boolean') {
      data[field.name] = '0'
      return
    }

    const defaultValue = (options as { defaultValue?: string | null }).defaultValue
    data[field.name] = typeof defaultValue === 'string' ? defaultValue : ''
  })
  return data
}

export function buildItemFormDataFromItem(item: Item, fields: Field[]): ItemFormData {
  const data = createEmptyItemFormData()
  fields.forEach(field => {
    const currentValue = item.data[field.name]
    if (field.type === 'date') {
      data[field.name] = parseDateValue(currentValue)
      return
    }

    if (field.type === 'number') {
      if (currentValue === '' || currentValue === null || currentValue === undefined) {
        data[field.name] = ''
        return
      }
      const parsed = Number(currentValue)
      data[field.name] = Number.isFinite(parsed) ? parsed : ''
      return
    }

    if (field.type === 'rating') {
      data[field.name] = parseRatingValue(currentValue)
      return
    }

    if (field.type === 'multiselect') {
      if (currentValue === null || currentValue === undefined || currentValue === '') {
        data[field.name] = null
        return
      }
      data[field.name] = String(currentValue)
      return
    }

    if (field.type === 'boolean') {
      data[field.name] = parseBooleanValue(currentValue) ? '1' : '0'
      return
    }

    if (field.type === 'select') {
      data[field.name] =
        currentValue === null || currentValue === undefined || currentValue === ''
          ? null
          : String(currentValue)
      return
    }

    data[field.name] = currentValue ?? ''
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

    if (field.type === 'number') {
      const value = formData[field.name]
      if (value === null || value === undefined || value === '') {
        plainData[field.name] = ''
        return
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        plainData[field.name] = value
        return
      }
      const parsed = Number(value)
      plainData[field.name] = Number.isFinite(parsed) ? parsed : ''
      return
    }

    if (field.type === 'rating') {
      const value = parseRatingValue(formData[field.name] as ItemDataValue)
      plainData[field.name] = serializeRatingValue(value)
      return
    }

    if (field.type === 'multiselect') {
      const value = formData[field.name] as ItemDataValue
      if (value === null || value === undefined || value === '') {
        plainData[field.name] = null
        return
      }
      if (typeof value === 'string') {
        plainData[field.name] = value
        return
      }
      plainData[field.name] = null
      return
    }

    if (field.type === 'boolean') {
      plainData[field.name] = serializeBooleanValue(formData[field.name] as ItemDataValue)
      return
    }

    if (field.type === 'select') {
      const value = formData[field.name]
      plainData[field.name] =
        value === null || value === undefined || value === '' ? null : String(value)
      return
    }

    const value = formData[field.name]
    plainData[field.name] = value === null || value === undefined ? '' : (value as ItemDataValue)
  })
  return plainData
}

function buildItemFormDataFromData(data: ItemData, fields: Field[]): ItemFormData {
  const fakeItem: Item = {
    id: 0,
    collection_id: 0,
    order: 0,
    data
  }
  return buildItemFormDataFromItem(fakeItem, fields)
}

export function useCollectionItemForm(fields: Ref<Field[]>, initialData?: Ref<ItemData | null>) {
  const formData = ref<ItemFormData>(createDefaultItemFormData(fields.value))
  const editingItem = ref<Item | null>(null)
  const isEditing = computed(() => editingItem.value !== null)

  function applyInitialData() {
    const base = createDefaultItemFormData(fields.value)
    const data = initialData?.value ?? null
    if (!data) {
      formData.value = base
      return
    }

    const initialKeys = new Set(Object.keys(data))
    const initialForm = buildItemFormDataFromData(data, fields.value)
    const merged = createEmptyItemFormData()
    fields.value.forEach(field => {
      if (initialKeys.has(field.name)) {
        merged[field.name] = initialForm[field.name]
      } else {
        merged[field.name] = base[field.name]
      }
    })
    formData.value = merged
  }

  function resetFormData() {
    formData.value = createDefaultItemFormData(fields.value)
  }

  function startCreate() {
    editingItem.value = null
    applyInitialData()
  }

  function startEdit(item: Item) {
    editingItem.value = item
    formData.value = buildItemFormDataFromItem(item, fields.value)
  }

  function cancelForm() {
    editingItem.value = null
    applyInitialData()
  }

  function toItemData(): ItemData {
    return buildItemDataFromForm(formData.value, fields.value)
  }

  if (initialData) {
    watch([initialData, isEditing, fields], () => {
      if (isEditing.value) return
      applyInitialData()
    })
  }

  function getFieldInputId(field: Field) {
    return `field-input-${field.id}`
  }

  function getSelectOptions(field: Field) {
    const parsed = parseFieldOptions(field.type, field.options) as SelectFieldOptions
    return parsed.choices ?? []
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
    if (value === null || value === undefined || value === '') {
      formData.value[fieldName] = null
      return
    }
    formData.value[fieldName] = value
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

  function getMultiselectValue(fieldName: string): string[] {
    return parseMultiselectValue(formData.value[fieldName] as ItemDataValue)
  }

  function setMultiselectValue(fieldName: string, value: string[] | null | undefined) {
    formData.value[fieldName] = serializeMultiselectValue(value) ?? null
  }

  function getBooleanValue(fieldName: string): boolean {
    return parseBooleanValue(formData.value[fieldName] as ItemDataValue)
  }

  function setBooleanValue(fieldName: string, value: boolean) {
    formData.value[fieldName] = serializeBooleanValue(value)
  }

  function getRatingValue(fieldName: string): number | null {
    return parseRatingValue(formData.value[fieldName] as ItemDataValue)
  }

  function setRatingValue(fieldName: string, value: number | null | undefined) {
    formData.value[fieldName] = serializeRatingValue(value)
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
    setDateValue,
    getMultiselectValue,
    setMultiselectValue,
    getBooleanValue,
    setBooleanValue,
    getRatingValue,
    setRatingValue
  }
}
