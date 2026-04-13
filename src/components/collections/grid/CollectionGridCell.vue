<template>
  <div
    ref="cellRef"
    class="cell flex h-10 w-full items-center px-3 text-base text-[var(--text-primary)]"
    :class="isSelected ? 'ring-1 ring-inset ring-[var(--accent-primary)]' : ''"
    data-grid-cell
    @click="onSelect"
    @dblclick="onDoubleClick"
  >
    <template v-if="field?.type === 'select' && displayText !== '-'">
      <Chip
        :label="String(displayText)"
        :style="chipStyle"
        class="h-5 px-2 py-3 text-base leading-none"
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
          class="h-5 px-2 py-3 text-base leading-none"
          :pt="{ root: { class: 'rounded-full' } }"
        />
      </div>
    </template>
    <template v-else-if="field?.type === 'boolean'">
      <button type="button" class="flex items-center" @click.stop="toggleBoolean">
        <component
          :is="booleanIconComponent"
          :size="18"
          :fill="booleanValue ? 'currentColor' : 'transparent'"
          :stroke-width="booleanValue ? 0 : 1.5"
          :class="booleanValue ? 'text-[var(--p-primary-color)]' : 'text-[var(--text-muted)]'"
        />
      </button>
    </template>
    <template v-else-if="field?.type === 'url' && displayText !== '-'">
      <div class="flex items-center gap-1">
        <button
          type="button"
          :class="isDuplicate ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]'"
          title="Open link"
          @click.stop="openExternal(displayText as string)"
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
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import Chip from 'primevue/chip'
import type { BooleanIcon, DateFieldOptions, Field, ItemDataValue, RatingFieldOptions } from '../../../types/models'
import { formatDateWithFieldOptions, parseDateValue } from '../../../utils/date'
import { getChipStyle } from '../../../utils/selectChip'
import { gridEditingKey, gridSelectionKey } from './types'
import { parseFieldOptions } from '../../../utils/fieldOptions'
import { parseMultiselectValue, parseBooleanValue, parseRatingValue } from '../../../utils/fieldValues'
import { normalizeUniqueKey } from '../../../utils/fieldUnique'
import * as icons from 'lucide-vue-next'
import { Link } from 'lucide-vue-next'
import { systemRepository } from '../../../repositories/systemRepository'

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
const cellRef = ref<HTMLElement | null>(null)

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
const isSelected = computed(() =>
  props.field ? selectionContext.isSelected(props.rowId, props.field.name) : false
)
const booleanValue = computed(() => parseBooleanValue(props.value ?? null))

function getMultiChipStyle(option: string) {
  const base = getChipStyle(option, selectOptions.value)
  if (isDuplicate.value) {
    return { ...base, '--p-chip-color': 'var(--danger)' }
  }
  return base
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

  editingContext.startEdit(props.rowId, props.field.name, cellRef.value)
}

function toggleBoolean() {
  if (!props.field) return
  const nextValue = booleanValue.value ? '0' : '1'
  editingContext.startEdit(props.rowId, props.field.name, cellRef.value)
  void editingContext.commitEdit(nextValue)
}

async function openExternal(url: string) {
  await systemRepository.openExternal(url)
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
