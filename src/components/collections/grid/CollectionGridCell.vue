<template>
  <div ref="cellRef" class="cell flex h-10 w-full items-center px-3 text-base text-[var(--text-primary)]"
    :class="isSelected ? 'ring-1 ring-inset ring-[var(--accent-primary)]' : ''" data-grid-cell @click="onSelect"
    @dblclick="onDoubleClick">
    <template
      v-if="isEditing && field && field.type !== 'boolean' && field.type !== 'select' && field.type !== 'rating' && field.type !== 'multiselect'">
      <input v-if="field.type === 'text' || field.type === 'longtext' || field.type === 'url' || field.type === 'date'"
        ref="inputRef" v-model="textModel" type="text"
        class="w-full bg-transparent border-none outline-none text-base text-[var(--text-primary)] p-0" @blur="onBlur"
        @keydown="onKeydown" />
      <input v-else-if="field.type === 'number'" ref="inputRef" v-model="numberModel" type="number"
        class="w-full bg-transparent border-none outline-none text-base text-[var(--text-primary)] p-0 text-right"
        @blur="onBlur" @keydown="onKeydown" />
    </template>
    <template v-else>
      <template v-if="field?.type === 'select' && displayText !== '-'">
        <Chip :label="String(displayText)" :style="chipStyle" class="text-base py-3 px-2 h-5 leading-none"
          :pt="{ root: { class: 'rounded-full' } }" />
      </template>
      <template v-else-if="field?.type === 'multiselect' && multiselectDisplay.length > 0">
        <div class="flex items-center gap-1 overflow-hidden">
          <Chip v-for="option in multiselectDisplay" :key="option" :label="option" :style="getMultiChipStyle(option)"
            class="text-base py-3 px-2 h-5 leading-none" :pt="{ root: { class: 'rounded-full' } }" />
        </div>
      </template>
      <template v-else-if="field?.type === 'boolean'">
        <button type="button" class="flex items-center" @click.stop="toggleBoolean">
          <component :is="booleanIconComponent" :size="18" :fill="booleanValue ? 'currentColor' : 'transparent'"
            :stroke-width="booleanValue ? 0 : 1.5"
            :class="booleanValue ? 'text-[var(--p-primary-color)]' : 'text-[var(--text-muted)]'" />
        </button>
      </template>
      <template v-else-if="field?.type === 'url' && displayText !== '-'">
        <div class="flex items-center gap-1">
          <button type="button" :class="isDuplicate ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]'"
            @click.stop="openExternal(displayText as string)" title="Open link">
            <Link :size="12" />
          </button>
          <span :class="['truncate', isDuplicate ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]']">
            {{ displayText }}
          </span>
        </div>
      </template>
      <template v-else-if="field?.type === 'rating' && ratingMax > 0">
        <div class="flex items-center">
          <component v-for="index in ratingMax" :key="index" :is="ratingIconComponent" :size="16"
            :fill="index <= ratingValue ? ratingColor : 'transparent'" :stroke-width="index <= ratingValue ? 0 : 1.5"
            :class="index <= ratingValue ? ratingFilledClass : 'text-[var(--text-muted)]'" />
        </div>
      </template>
      <template v-else>
        <span class="block w-full truncate" :class="field?.type === 'number' ? 'text-right' : ''" :style="displayStyle">
          {{ displayText }}
        </span>
      </template>
    </template>
  </div>
  <Teleport to="body">
    <div v-if="isDropdownEditing" ref="dropdownRef" :style="[dropdownStyle, dropdownSurfaceStyle]"
      class="z-50 rounded-md border border-[var(--border-subtle)] shadow-lg" tabindex="0" @keydown="onKeydown"
      @focusout="onDropdownFocusOut" @mousedown.stop>
      <ul v-if="field?.type === 'select'" class="max-h-60 overflow-auto py-1">
        <li v-if="selectOptions.length === 0" class="px-3 py-2 text-base text-[var(--text-muted)]">
          No options
        </li>
        <li v-for="option in selectOptions" v-else :key="option">
          <button type="button"
            class="flex w-full items-center px-3 py-2 text-left text-base hover:bg-[var(--surface-2)]"
            :class="option === selectModel ? 'bg-[var(--surface-2)] font-medium' : ''" @click="commitSelect(option)">
            <span class="truncate">{{ option }}</span>
          </button>
        </li>
      </ul>
      <ul v-else-if="field?.type === 'multiselect'" class="max-h-60 overflow-auto py-1">
        <li v-if="selectOptions.length === 0" class="px-3 py-2 text-base text-[var(--text-muted)]">
          No options
        </li>
        <li v-for="option in selectOptions" v-else :key="option">
          <button type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-base hover:bg-[var(--surface-2)]"
            :class="isMultiSelected(option) ? 'bg-[var(--surface-2)] font-medium' : ''" @click="toggleMulti(option)">
            <span class="flex h-4 w-4 items-center justify-center rounded border border-[var(--border-subtle)]"
              :class="isMultiSelected(option) ? 'bg-[var(--accent-primary)] text-white' : 'text-transparent'"
              aria-hidden="true">
              ✓
            </span>
            <span class="truncate">{{ option }}</span>
          </button>
        </li>
      </ul>
      <ul v-else-if="field?.type === 'rating'" class="max-h-60 overflow-auto py-1">
        <li v-for="option in ratingSelectOptions" :key="String(option.value)">
          <button type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-base hover:bg-[var(--surface-2)]"
            :class="option.value === ratingModel ? 'bg-[var(--surface-2)] font-medium' : ''"
            @click="commitRating(option.value)">
            <span v-if="option.value === null" class="text-[var(--text-muted)]">None</span>
            <div v-else class="flex items-center">
              <component v-for="index in ratingMax" :key="index" :is="ratingIconComponent" :size="16"
                :fill="index <= option.value ? ratingColor : 'transparent'"
                :stroke-width="index <= option.value ? 0 : 1.5"
                :class="index <= option.value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'" />
            </div>
          </button>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import Chip from 'primevue/chip'
import type { BooleanIcon, DateFieldOptions, Field, ItemDataValue, RatingFieldOptions } from '../../../types/models'
import {
  formatDateWithFieldOptions,
  parseDateValue
} from '../../../utils/date'
import { getChipStyle } from '../../../utils/selectChip'
import { gridEditingKey, gridSelectionKey } from './types'
import { buildGridCellKey } from '../../../composables/collection/grid/useGridSelection'
import { parseFieldOptions } from '../../../utils/fieldOptions'
import { parseMultiselectValue, parseBooleanValue, parseRatingValue } from '../../../utils/fieldValues'
import { normalizeUniqueKey } from '../../../utils/fieldUnique'
import { handleIpc } from '../../../utils/ipc'
import * as icons from 'lucide-vue-next'
import { Link } from 'lucide-vue-next'

const props = defineProps<{
  field?: Field
  value?: ItemDataValue
  rowId: number
  rowIndex: number
  rowIds: number[]
  orderedFields: Field[]
  duplicateMap?: Map<string, Set<string>>
}>()

const selection = inject(gridSelectionKey)
const editing = inject(gridEditingKey)

if (!selection || !editing) {
  throw new Error('Grid selection/editing context not provided')
}

const selectionContext = selection
const editingContext = editing

const fieldOptions = computed(() =>
  props.field ? parseFieldOptions(props.field.type, props.field.options) : null
)

const dateOptions = computed<DateFieldOptions>(() =>
  (fieldOptions.value ?? {}) as DateFieldOptions
)

const ratingFieldOptions = computed<RatingFieldOptions>(() =>
  (fieldOptions.value ?? {}) as RatingFieldOptions
)

const selectOptions = computed(() => {
  const options = fieldOptions.value as { choices?: string[] } | null
  return options?.choices ?? []
})

const ratingMin = computed(() =>
  Number.isFinite(ratingFieldOptions.value.min) ? Number(ratingFieldOptions.value.min) : 0
)
const ratingMax = computed(() => {
  const max = Number.isFinite(ratingFieldOptions.value.max)
    ? Number(ratingFieldOptions.value.max)
    : 5
  return Math.max(max, ratingMin.value)
})

const ratingColor = computed(() => ratingFieldOptions.value.color ?? 'currentColor')
const ratingValue = computed(() => parseRatingValue(props.value ?? null) ?? 0)

const ratingIconComponent = computed(() => {
  const icon = (ratingFieldOptions.value.icon ?? 'star') as BooleanIcon
  return booleanIconMap[icon]
})

const booleanIconComponent = computed(() => {
  const icon = ((fieldOptions.value as { icon?: BooleanIcon })?.icon ?? 'square') as BooleanIcon
  return booleanIconMap[icon]
})

const displayText = computed(() => {
  const field = props.field
  const value = props.value
  if (!field) return '-'
  if (value === null || value === undefined || value === '') return '-'

  if (field.type === 'date') {
    return formatDateWithFieldOptions(value, dateOptions.value)
  }

  return value
})

const shouldHighlightDate = computed(() => {
  const field = props.field
  if (!field || field.type !== 'date') return false
  const highlight = dateOptions.value.highlight
  if (!highlight || !highlight.type || !highlight.date || !highlight.color) return false

  const valueDate = parseDateValue(props.value ?? null)
  const compareDate = parseDateValue(highlight.date)
  if (!valueDate || !compareDate) return false

  if (highlight.type === '<') return valueDate.getTime() < compareDate.getTime()
  return valueDate.getTime() > compareDate.getTime()
})

const uniqueKey = computed(() => {
  const field = props.field
  if (!field) return null
  return normalizeUniqueKey(field, props.value ?? null)
})

const isDuplicate = computed(() => {
  const field = props.field
  if (!field || !uniqueKey.value || !props.duplicateMap) return false
  const dupes = props.duplicateMap.get(field.name)
  return Boolean(dupes?.has(uniqueKey.value))
})

const displayStyle = computed(() => {
  if (isDuplicate.value) {
    return { color: 'var(--danger)' }
  }
  if (shouldHighlightDate.value) {
    return { color: dateOptions.value.highlight?.color ?? undefined }
  }
  return {}
})

const ratingFilledClass = computed(() =>
  (isDuplicate.value ? 'text-[var(--danger)]' : 'text-[var(--p-primary-color)]')
)

const chipStyle = computed(() => {
  const base = getChipStyle(String(displayText.value), selectOptions.value)
  if (isDuplicate.value) {
    return { ...base, '--p-chip-color': 'var(--danger)' }
  }
  return base
})

const multiselectDisplay = computed(() => parseMultiselectValue(props.value ?? null))

function getMultiChipStyle(option: string) {
  const base = getChipStyle(option, selectOptions.value)
  if (isDuplicate.value) {
    return { ...base, '--p-chip-color': 'var(--danger)' }
  }
  return base
}

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

const isDropdownEditing = computed(() =>
  isEditing.value && (props.field?.type === 'select' || props.field?.type === 'rating' || props.field?.type === 'multiselect')
)

type EditValue = ItemDataValue | Date | string[] | null
const editValue = ref<EditValue>('')
const inputRef = ref<HTMLInputElement | null>(null)
const cellRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})
const dropdownSurfaceStyle = computed(() => ({
  backgroundColor: 'var(--bg-secondary, #ffffff)',
  color: 'var(--text-primary, #111111)'
}))

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

const multiselectModel = computed<string[]>({
  get: () => {
    if (Array.isArray(editValue.value)) return editValue.value
    return parseMultiselectValue(editValue.value as ItemDataValue)
  },
  set: value => {
    editValue.value = value
  }
})

const ratingModel = computed<number | null>({
  get: () => parseRatingValue(editValue.value as ItemDataValue),
  set: value => {
    editValue.value = value
  }
})

const ratingSelectOptionsList = computed(() => {
  const options: Array<{ label: string; value: number | null }> = [
    { label: 'None', value: null }
  ]
  for (let i = ratingMin.value; i <= ratingMax.value; i += 1) {
    options.push({ label: `${i} / ${ratingMax.value} *`, value: i })
  }
  return options
})

const ratingSelectOptions = computed(() => ratingSelectOptionsList.value)

const booleanValue = computed(() => parseBooleanValue(props.value ?? null))

watch(
  isEditing,
  next => {
    if (!next) return
    editValue.value = resolveEditValue(props.value, props.field)
    if (!props.field) return
    const fieldType = props.field.type
    if (fieldType === 'select' || fieldType === 'rating' || fieldType === 'multiselect') {
      nextTick(() => {
        updateDropdownPosition()
        dropdownRef.value?.focus()
      })
      return
    }
    if (fieldType === 'text' || fieldType === 'longtext' || fieldType === 'url' || fieldType === 'date' || fieldType === 'number') {
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
  { flush: 'sync' }
)

function resolveEditValue(value: ItemDataValue | undefined, field?: Field): EditValue {
  if (!field) return ''
  if (field.type === 'date') {
    const parsed = parseDateValue(value ?? null)
    if (!parsed) return ''
    return formatDateWithFieldOptions(parsed, dateOptions.value)
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
  if (field.type === 'multiselect') {
    return parseMultiselectValue(value ?? null)
  }
  if (field.type === 'rating') {
    return parseRatingValue(value ?? null)
  }
  return value ?? ''
}

function onSelect() {
  if (!props.field) return
  selectionContext.selectCell(props.rowId, props.field.name)
  if (props.field.type === 'boolean') {
    toggleBoolean()
  }
}

function onDoubleClick() {
  if (!props.field) return
  if (props.field.type === 'boolean') {
    toggleBoolean()
    return
  }
  editingContext.startEdit(props.rowId, props.field.name)
}

function toggleBoolean() {
  if (!props.field) return
  const nextValue = booleanValue.value ? '0' : '1'
  editingContext.startEdit(props.rowId, props.field.name)
  editingContext.commitEdit(nextValue)
}

function onBlur() {
  if (!isEditing.value) return
  editingContext.commitEdit(editValue.value as ItemDataValue)
}

function onDropdownFocusOut(event: FocusEvent) {
  if (!dropdownRef.value) {
    onBlur()
    return
  }
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && dropdownRef.value.contains(nextTarget)) return
  onBlur()
}

function onKeydown(event: Event) {
  if (!(event instanceof KeyboardEvent)) return
  if (!isEditing.value) return

  if (event.key === 'Enter') {
    event.preventDefault()
    editingContext.commitEdit(editValue.value as ItemDataValue)
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
    editingContext.commitEdit(editValue.value as ItemDataValue)
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

function updateDropdownPosition() {
  if (!cellRef.value) return
  const rect = cellRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`
  }
}

function commitSelect(option: string) {
  editingContext.commitEdit(option)
}

function commitRating(value: number | null) {
  editingContext.commitEdit(value)
}

function isMultiSelected(option: string) {
  return multiselectModel.value.includes(option)
}

function toggleMulti(option: string) {
  const current = multiselectModel.value
  if (current.includes(option)) {
    multiselectModel.value = current.filter(entry => entry !== option)
    return
  }
  multiselectModel.value = [...current, option]
}

async function openExternal(url: string) {
  const result = await window.electronAPI.openExternal(url)
  handleIpc(result, 'openExternal', null)
}

const booleanIconMap: Record<BooleanIcon, typeof icons.Square> = {
  square: icons.Square,
  circle: icons.Circle,
  heart: icons.Heart,
  star: icons.Star,
  flame: icons.Flame,
  'thumbs-up': icons.ThumbsUp,
  'thumbs-down': icons.ThumbsDown,
  flag: icons.Flag
}
</script>
