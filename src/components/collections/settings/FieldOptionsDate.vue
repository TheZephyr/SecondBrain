<template>
  <div class="space-y-3">
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Format</div>
      <Select :modelValue="dateFormat" @update:modelValue="updateDateFormat"
        :options="dateFormatOptions" optionLabel="label" optionValue="value" class="w-full" />
    </div>

    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Highlight Dates</div>
      <div class="flex flex-col gap-2 md:flex-row">
        <Select :modelValue="highlightType" @update:modelValue="value => updateHighlight('type', value)"
          :options="highlightTypeOptions" optionLabel="label" optionValue="value" class="w-full md:w-24" />
        <DatePicker :modelValue="highlightDateModel"
          @update:modelValue="value => updateHighlightDate(normalizeDateValue(value))" dateFormat="yy-mm-dd"
          inputClass="w-full" class="w-full" />
        <InputText :modelValue="highlightColor" @update:modelValue="value => updateHighlight('color', value)"
          placeholder="#ff4400" class="w-full md:w-40" />
      </div>
      <div v-if="highlightIncomplete" class="mt-1 text-base text-[var(--danger)]">
        Type, date, and color are all required when using a highlight rule.
      </div>
    </div>

    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Default Value</div>
      <div class="space-y-2">
        <Select :modelValue="dateDefaultMode" @update:modelValue="updateDateDefaultMode"
          :options="dateDefaultOptions" optionLabel="label" optionValue="value" class="w-full" />
        <DatePicker v-if="dateDefaultMode === 'custom'" :modelValue="dateDefaultModel"
          @update:modelValue="value => updateDateDefaultValue(normalizeDateValue(value))" dateFormat="yy-mm-dd"
          inputClass="w-full" class="w-full" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import type { DateFieldOptions, DateHighlightRule, DateFormat } from '../../../types/models'
import { parseDateValue, formatDateForStorage } from '../../../utils/date'

const props = defineProps<{
  modelValue: DateFieldOptions
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: DateFieldOptions): void
}>()

const dateFormatOptions = [
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'YYYY.MM.DD', value: 'YYYY.MM.DD' },
  { label: 'DD-MM-YYYY', value: 'DD-MM-YYYY' },
  { label: 'DD.MM.YYYY', value: 'DD.MM.YYYY' }
]

const highlightTypeOptions = [
  { label: 'None', value: '' },
  { label: '<', value: '<' },
  { label: '>', value: '>' }
]

const dateDefaultOptions = [
  { label: 'None', value: 'none' },
  { label: 'Current date', value: 'current' },
  { label: 'Custom date', value: 'custom' }
]

const dateFormat = computed(() => (props.modelValue.format ?? 'YYYY-MM-DD') as DateFormat)
const highlightType = computed(() => props.modelValue.highlight?.type ?? '')
const highlightColor = computed(() => props.modelValue.highlight?.color ?? '')
const highlightDateModel = computed(() => {
  const date = props.modelValue.highlight?.date
  return date ? parseDateValue(date) : null
})

const highlightIncomplete = computed(() => {
  const highlight = props.modelValue.highlight
  if (!highlight) return false
  const hasType = Boolean(highlight.type)
  const hasDate = Boolean(highlight.date)
  const hasColor = Boolean(highlight.color)
  return (hasType || hasDate || hasColor) && !(hasType && hasDate && hasColor)
})

const dateDefaultMode = computed(() => {
  const value = props.modelValue.defaultValue
  if (value === 'current') return 'current'
  if (typeof value === 'string' && value) return 'custom'
  return 'none'
})

const dateDefaultModel = computed(() => {
  const value = props.modelValue.defaultValue
  if (typeof value === 'string' && value && value !== 'current') {
    return parseDateValue(value)
  }
  return null
})

function emitOptions(next: DateFieldOptions) {
  emit('update:modelValue', next)
}

function normalizeDateValue(
  value: Date | Date[] | (Date | null)[] | null | undefined
): Date | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] ?? null
    return first instanceof Date ? first : null
  }
  return value instanceof Date ? value : null
}

function updateDateFormat(value: string | null | undefined) {
  const format = (value ?? 'YYYY-MM-DD') as DateFormat
  emitOptions({ ...props.modelValue, format })
}

function updateHighlight(key: 'type' | 'color', value: string | null | undefined) {
  const safeValue = value ?? ''
  const current = props.modelValue.highlight
  
  if (key === 'type' && !safeValue) {
    emitOptions({ ...props.modelValue, highlight: null })
    return
  }
  
  const next = current
    ? { ...current, [key]: safeValue } as DateHighlightRule
    : { type: '<' as const, date: '', color: '' } as DateHighlightRule
  
  if (key === 'type') {
    next.type = safeValue as '<' | '>'
  } else {
    next.color = safeValue
  }
  
  const allEmpty = !next.type && !next.date && !next.color
  emitOptions({ ...props.modelValue, highlight: allEmpty ? null : next })
}

function updateHighlightDate(value: Date | null) {
  const date = value ? formatDateForStorage(value) : ''
  const current = props.modelValue.highlight
  
  const next = current
    ? { ...current, date } as DateHighlightRule
    : { type: '<' as const, date: '', color: '' } as DateHighlightRule
  
  next.date = date
  
  const allEmpty = !next.type && !next.date && !next.color
  emitOptions({ ...props.modelValue, highlight: allEmpty ? null : next })
}

function updateDateDefaultMode(mode: string | null | undefined) {
  const safeMode = mode ?? 'none'
  if (safeMode === 'none') {
    emitOptions({ ...props.modelValue, defaultValue: null })
    return
  }
  if (safeMode === 'current') {
    emitOptions({ ...props.modelValue, defaultValue: 'current' })
    return
  }
  if (safeMode === 'custom') {
    const existing = props.modelValue.defaultValue
    if (typeof existing === 'string' && existing && existing !== 'current') {
      emitOptions({ ...props.modelValue, defaultValue: existing })
      return
    }
    const today = formatDateForStorage(new Date())
    emitOptions({ ...props.modelValue, defaultValue: today })
  }
}

function updateDateDefaultValue(value: Date | null) {
  emitOptions({ ...props.modelValue, defaultValue: value ? formatDateForStorage(value) : null })
}
</script>