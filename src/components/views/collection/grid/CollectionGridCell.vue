<template>
  <div class="cell flex h-10 w-full items-center px-3 text-sm text-[var(--text-primary)]"
    :class="isSelected ? 'ring-1 ring-inset ring-[var(--accent-primary)]' : ''" data-grid-cell @click="onSelect"
    @dblclick="onDoubleClick">
    <template v-if="isEditing && field">
      <InputText v-if="field.type === 'text' || field.type === 'textarea'" v-model="textModel" class="h-9 w-full"
        @blur="onBlur" @keydown="onKeydown" />
      <InputNumber v-else-if="field.type === 'number'" v-model="numberModel" inputClass="h-9 w-full" class="h-9 w-full"
        @blur="onBlur" @keydown="onKeydown" />
      <DatePicker v-else-if="field.type === 'date'" v-model="dateModel" dateFormat="yy-mm-dd" inputClass="h-9 w-full"
        class="h-9 w-full" @blur="onBlur" @keydown="onKeydown" />
      <Select v-else-if="field.type === 'select'" v-model="selectModel" :options="selectOptions" class="h-9 w-full"
        @blur="onBlur" @keydown="onKeydown" />
    </template>
    <template v-else>
      <template v-if="field?.type === 'select' && displayValue !== '-'">
        <Chip :label="String(displayValue)" :style="getChipStyle(String(displayValue), selectOptions)"
          class="text-xs !py-0 !px-2 h-5 leading-none" :pt="{ root: { class: 'rounded-full' } }" />
      </template>
      <template v-else>
        <span class="block w-full truncate">
          {{ displayValue }}
        </span>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Chip from 'primevue/chip'
import type { Field, ItemDataValue } from '../../../../types/models'
import { formatDateForDisplay, parseDateValue } from '../../../../utils/date'
import { getChipStyle } from '../../../../utils/selectChip'
import { gridEditingKey, gridSelectionKey } from './types'
import { buildGridCellKey } from '../../../../composables/collection/grid/useGridSelection'

const props = defineProps<{
  field?: Field
  value?: ItemDataValue
  rowId: number
  rowIndex: number
  rowIds: number[]
  orderedFields: Field[]
}>()

const selection = inject(gridSelectionKey)
const editing = inject(gridEditingKey)

if (!selection || !editing) {
  throw new Error('Grid selection/editing context not provided')
}

const selectionContext = selection
const editingContext = editing

const displayValue = computed(() => {
  const field = props.field
  const value = props.value
  if (!field) return '-'
  if (value === null || value === undefined || value === '') return '-'

  if (field.type === 'date') {
    return formatDateForDisplay(value)
  }

  return value
})

const cellKey = computed(() =>
  props.field ? buildGridCellKey(props.rowId, props.field.name) : null
)

const isSelected = computed(() =>
  props.field ? selectionContext.isSelected(props.rowId, props.field.name) : false
)

const isEditing = computed(
  () =>
    cellKey.value !== null &&
    editingContext.editingCellKey.value === cellKey.value
)

const editValue = ref<ItemDataValue | Date | null>('')

const textModel = computed<string>({
  get: () => (editValue.value ?? '') as string,
  set: value => {
    editValue.value = value
  }
})

const numberModel = computed<number | null>({
  get: () => {
    const value = editValue.value
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  },
  set: value => {
    editValue.value = value ?? null
  }
})

const dateModel = computed<Date | null>({
  get: () => {
    const value = editValue.value
    if (value instanceof Date) return value
    return parseDateValue(value as ItemDataValue)
  },
  set: value => {
    editValue.value = value ?? null
  }
})

const selectModel = computed<string>({
  get: () => {
    const value = editValue.value
    if (value === null || value === undefined) return ''
    return String(value)
  },
  set: value => {
    editValue.value = value
  }
})

const selectOptions = computed(() => {
  if (!props.field?.options) return []
  return props.field.options.split(',').map(option => option.trim())
})

watch(
  isEditing,
  next => {
    if (!next) return
    editValue.value = resolveEditValue(props.value, props.field)
  },
  { flush: 'sync' }
)

function resolveEditValue(value: ItemDataValue | undefined, field?: Field) {
  if (!field) return ''
  if (field.type === 'date') {
    return parseDateValue(value ?? null)
  }
  if (field.type === 'number') {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }
  return value ?? ''
}

function onSelect() {
  if (!props.field) return
  selectionContext.selectCell(props.rowId, props.field.name)
}

function onDoubleClick() {
  if (!props.field) return
  editingContext.startEdit(props.rowId, props.field.name)
}

function onBlur() {
  if (!isEditing.value) return
  editingContext.commitEdit(editValue.value)
}

function onKeydown(event: Event) {
  if (!(event instanceof KeyboardEvent)) return
  if (!isEditing.value) return

  if (event.key === 'Enter') {
    event.preventDefault()
    editingContext.commitEdit(editValue.value)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    editingContext.cancelEdit()
    return
  }

  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault()
    const nextCell = getNextCell()
    editingContext.commitEdit(editValue.value)
    if (nextCell) {
      selectionContext.selectCell(nextCell.rowId, nextCell.fieldName)
    }
  }
}

function getNextCell() {
  if (!props.field) return null
  if (props.orderedFields.length === 0) return null

  const fieldIndex = props.orderedFields.findIndex(
    entry => entry.name === props.field?.name
  )
  if (fieldIndex === -1) return null

  if (fieldIndex < props.orderedFields.length - 1) {
    return {
      rowId: props.rowId,
      fieldName: props.orderedFields[fieldIndex + 1].name
    }
  }

  if (props.rowIndex < props.rowIds.length - 1) {
    return {
      rowId: props.rowIds[props.rowIndex + 1],
      fieldName: props.orderedFields[0].name
    }
  }

  return null
}
</script>
