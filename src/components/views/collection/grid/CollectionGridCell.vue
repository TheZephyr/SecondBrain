<template>
  <div
    class="cell flex h-10 w-full items-center px-3 text-sm text-[var(--text-primary)]"
    :class="isSelected ? 'ring-1 ring-inset ring-[var(--accent-primary)]' : ''"
    data-grid-cell
    @click="onSelect"
    @dblclick="onDoubleClick"
  >
    <template v-if="isEditing && field && field.type !== 'boolean'">
      <InputText
        v-if="field.type === 'text' || field.type === 'longtext' || field.type === 'url' || field.type === 'date'"
        v-model="textModel"
        class="h-9 w-full"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <InputNumber
        v-else-if="field.type === 'number'"
        v-model="numberModel"
        inputClass="h-9 w-full"
        class="h-9 w-full"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <Select
        v-else-if="field.type === 'select'"
        v-model="selectModel"
        :options="selectOptions"
        class="h-9 w-full"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <MultiSelect
        v-else-if="field.type === 'multiselect'"
        v-model="multiselectModel"
        :options="selectOptions"
        class="h-9 w-full"
        display="chip"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <Select
        v-else-if="field.type === 'rating'"
        v-model="ratingModel"
        :options="ratingSelectOptions"
        optionLabel="label"
        optionValue="value"
        class="h-9 w-full"
        @blur="onBlur"
        @keydown="onKeydown"
      >
        <template #value="{ value }">
          <div class="flex items-center gap-1">
            <span v-if="value === null" class="text-[var(--text-muted)]">None</span>
            <div v-else class="flex items-center">
              <component
                v-for="index in ratingMax"
                :key="index"
                :is="ratingIconComponent"
                :size="16"
                :fill="index <= (value ?? 0) ? ratingColor : 'transparent'"
                :stroke-width="index <= (value ?? 0) ? 0 : 1.5"
                :class="index <= (value ?? 0) ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'"
              />
            </div>
          </div>
        </template>
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <span v-if="option.value === null" class="text-[var(--text-muted)]">None</span>
            <div v-else class="flex items-center">
              <component
                v-for="index in ratingMax"
                :key="index"
                :is="ratingIconComponent"
                :size="16"
                :fill="index <= option.value ? ratingColor : 'transparent'"
                :stroke-width="index <= option.value ? 0 : 1.5"
                :class="index <= option.value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'"
              />
            </div>
            <span class="text-xs text-[var(--text-muted)]">{{ option.label }}</span>
          </div>
        </template>
      </Select>
    </template>
    <template v-else>
      <template v-if="field?.type === 'select' && displayText !== '-'">
        <Chip
          :label="String(displayText)"
          :style="chipStyle"
          class="text-xs !py-0 !px-2 h-5 leading-none"
          :pt="{ root: { class: 'rounded-full' } }"
        />
      </template>
      <template v-else-if="field?.type === 'multiselect' && multiselectDisplay.length > 0">
        <div class="flex items-center gap-1 overflow-hidden">
          <Chip
            v-for="option in multiselectDisplay"
            :key="option"
            :label="option"
            :style="getMultiChipStyle(option)"
            class="text-xs !py-0 !px-2 h-5 leading-none"
            :pt="{ root: { class: 'rounded-full' } }"
          />
        </div>
      </template>
      <template v-else-if="field?.type === 'boolean'">
        <button
          type="button"
          class="flex items-center"
          @click.stop="toggleBoolean"
        >
          <component
            :is="booleanIconComponent"
            :size="18"
            :fill="booleanValue ? 'currentColor' : 'transparent'"
            :stroke-width="booleanValue ? 0 : 1.5"
            :class="booleanValue ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'"
          />
        </button>
      </template>
      <template v-else-if="field?.type === 'url' && displayText !== '-'">
        <div class="flex items-center gap-1">
          <button
            type="button"
            :class="isDuplicate ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]'"
            @click.stop="openExternal(displayText as string)"
            title="Open link"
          >
            <Link :size="12" />
          </button>
          <span :class="['truncate', isDuplicate ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]']">
            {{ displayText }}
          </span>
        </div>
      </template>
      <template v-else-if="field?.type === 'rating' && ratingMax > 0">
        <div class="flex items-center">
          <component
            v-for="index in ratingMax"
            :key="index"
            :is="ratingIconComponent"
            :size="16"
            :fill="index <= ratingValue ? ratingColor : 'transparent'"
            :stroke-width="index <= ratingValue ? 0 : 1.5"
            :class="index <= ratingValue ? ratingFilledClass : 'text-[var(--text-muted)]'"
          />
        </div>
      </template>
      <template v-else>
        <span
          class="block w-full truncate"
          :class="field?.type === 'number' ? 'text-right' : ''"
          :style="displayStyle"
        >
          {{ displayText }}
        </span>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Chip from 'primevue/chip'
import type { BooleanIcon, DateFieldOptions, Field, ItemDataValue, RatingFieldOptions } from '../../../../types/models'
import {
  formatDateWithFieldOptions,
  parseDateValue
} from '../../../../utils/date'
import { getChipStyle } from '../../../../utils/selectChip'
import { gridEditingKey, gridSelectionKey } from './types'
import { buildGridCellKey } from '../../../../composables/collection/grid/useGridSelection'
import { parseFieldOptions } from '../../../../utils/fieldOptions'
import { parseMultiselectValue, parseBooleanValue, parseRatingValue } from '../../../../utils/fieldValues'
import { normalizeUniqueKey } from '../../../../utils/fieldUnique'
import { handleIpc } from '../../../../utils/ipc'
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

const ratingFilledClass = computed(() => (isDuplicate.value ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'))

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

type EditValue = ItemDataValue | Date | string[] | null
const editValue = ref<EditValue>('')

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
