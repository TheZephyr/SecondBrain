<template>
  <div class="space-y-4">
    <template v-if="type === 'longtext'">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm text-[var(--text-secondary)]">Enable rich text</div>
        <div title="Coming soon" class="cursor-not-allowed opacity-60">
          <ToggleSwitch :modelValue="false" disabled />
        </div>
      </div>
    </template>

    <template v-if="type === 'date'">
      <div class="space-y-3">
        <div>
          <div class="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Format</div>
          <Select
            :modelValue="dateFormat"
            @update:modelValue="value => updateDateFormat(value)"
            :options="dateFormatOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>

        <div>
          <div class="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Highlight Dates</div>
          <div class="flex flex-col gap-2 md:flex-row">
            <Select
              :modelValue="highlightType"
              @update:modelValue="value => updateHighlight('type', value)"
              :options="highlightTypeOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full md:w-24"
            />
            <DatePicker
              :modelValue="highlightDateModel"
              @update:modelValue="value => updateHighlightDate(normalizeDateValue(value))"
              dateFormat="yy-mm-dd"
              inputClass="w-full"
              class="w-full"
            />
            <InputText
              :modelValue="highlightColor"
              @update:modelValue="value => updateHighlight('color', value)"
              placeholder="#ff4400"
              class="w-full md:w-40"
            />
          </div>
          <div v-if="highlightIncomplete" class="mt-1 text-xs text-[var(--danger)]">
            Type, date, and color are all required when using a highlight rule.
          </div>
        </div>
      </div>
    </template>

    <template v-if="type === 'select' || type === 'multiselect'">
      <div>
        <div class="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">Options</div>
        <div class="space-y-2">
          <div v-for="(choice, index) in choices" :key="`${choice}-${index}`" class="space-y-1">
            <div class="flex items-center gap-2">
              <InputText
                :modelValue="choice"
                @update:modelValue="value => updateChoice(index, value)"
                class="flex-1"
              />
              <Button
                text
                class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                title="Delete option"
                @click="requestRemoveChoice(choice)"
              >
                <Trash2 :size="14" />
              </Button>
            </div>
            <div v-if="confirmingChoice === choice" class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 text-xs">
              <div class="mb-2 text-[var(--text-secondary)]">
                {{ confirmingCount }} items use this option. Removing it will clear those values. Remove anyway?
              </div>
              <div class="flex items-center gap-2">
                <Button size="small" @click="confirmRemoveChoice">Confirm</Button>
                <Button size="small" severity="secondary" text @click="cancelRemoveChoice">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
        <Button text class="mt-2" @click="addChoice">
          <Plus :size="14" />
          Add option
        </Button>
      </div>
    </template>

    <template v-if="type !== 'boolean'">
      <div>
        <div class="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Default Value</div>
        <template v-if="type === 'text' || type === 'longtext' || type === 'url'">
          <InputText
            :modelValue="stringDefault"
            @update:modelValue="value => updateDefaultValue(value)"
            class="w-full"
          />
        </template>
        <template v-else-if="type === 'number'">
          <InputNumber
            :modelValue="numberDefault"
            @update:modelValue="value => updateDefaultValue(value)"
            inputClass="w-full"
            class="w-full"
          />
        </template>
        <template v-else-if="type === 'date'">
          <div class="space-y-2">
            <Select
              :modelValue="dateDefaultMode"
              @update:modelValue="value => updateDateDefaultMode(value)"
              :options="dateDefaultOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
            <DatePicker
              v-if="dateDefaultMode === 'custom'"
              :modelValue="dateDefaultModel"
              @update:modelValue="value => updateDateDefaultValue(normalizeDateValue(value))"
              dateFormat="yy-mm-dd"
              inputClass="w-full"
              class="w-full"
            />
          </div>
        </template>
        <template v-else-if="type === 'select'">
          <Select
            :modelValue="selectDefault"
            @update:modelValue="value => updateDefaultValue(value)"
            :options="selectDefaultOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </template>
        <template v-else-if="type === 'multiselect'">
          <MultiSelect
            :modelValue="multiselectDefault"
            @update:modelValue="value => updateDefaultValue(value)"
            :options="choices"
            display="chip"
            class="w-full"
          />
        </template>
        <template v-else-if="type === 'rating'">
          <Select
            :modelValue="ratingDefault"
            @update:modelValue="value => updateDefaultValue(value)"
            :options="ratingDefaultOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
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
      </div>
    </template>

    <template v-if="type === 'boolean'">
      <div>
        <div class="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">Icon</div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="icon in booleanIcons"
            :key="icon"
            type="button"
            class="flex items-center justify-center gap-2 rounded-md border border-[var(--border-color)] p-2"
            :class="booleanIcon === icon ? 'bg-[var(--bg-hover)]' : ''"
            @click="updateBooleanIcon(icon)"
          >
            <component :is="booleanIconMap[icon]" :size="18" class="text-[var(--text-muted)]" />
            <component
              :is="booleanIconMap[icon]"
              :size="18"
              fill="currentColor"
              :stroke-width="0"
              class="text-[var(--text-primary)]"
            />
          </button>
        </div>
      </div>
    </template>

    <template v-if="type === 'rating'">
      <div>
        <div class="mb-2 text-xs font-semibold uppercase text-[var(--text-muted)]">Icon</div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="icon in booleanIcons"
            :key="icon"
            type="button"
            class="flex items-center justify-center gap-2 rounded-md border border-[var(--border-color)] p-2"
            :class="ratingIcon === icon ? 'bg-[var(--bg-hover)]' : ''"
            @click="updateRatingIcon(icon)"
          >
            <component :is="booleanIconMap[icon]" :size="18" class="text-[var(--text-muted)]" />
            <component
              :is="booleanIconMap[icon]"
              :size="18"
              fill="currentColor"
              :stroke-width="0"
              class="text-[var(--text-primary)]"
            />
          </button>
        </div>
      </div>
      <div>
        <div class="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Colour</div>
        <InputText
          :modelValue="ratingColor"
          @update:modelValue="value => updateRatingColor(value)"
          placeholder="currentColor"
          class="w-full"
        />
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <div class="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Min</div>
          <InputNumber
            :modelValue="ratingMin"
            @update:modelValue="value => updateRatingMin(value)"
            inputClass="w-full"
            class="w-full"
          />
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Max</div>
          <InputNumber
            :modelValue="ratingMax"
            @update:modelValue="value => updateRatingMax(value)"
            inputClass="w-full"
            class="w-full"
          />
        </div>
      </div>
    </template>

    <template v-if="type !== 'boolean'">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm text-[var(--text-secondary)]">Check for unique values</div>
        <ToggleSwitch :modelValue="uniqueCheck" @update:modelValue="value => updateUniqueCheck(value)" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import * as icons from 'lucide-vue-next'
import { Plus, Trash2 } from 'lucide-vue-next'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import type {
  BooleanIcon,
  DateFieldOptions,
  FieldOptions,
  FieldType,
  Item,
  RatingFieldOptions
} from '../../../types/models'
import { parseDateValue, formatDateForStorage } from '../../../utils/date'
import { parseMultiselectValue } from '../../../utils/fieldValues'

const props = defineProps<{
  type: FieldType
  modelValue: FieldOptions
  items?: Item[]
  fieldName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: FieldOptions): void
}>()

const confirmingChoice = ref<string | null>(null)
const confirmingCount = ref(0)

const booleanIcons: BooleanIcon[] = [
  'square',
  'circle',
  'heart',
  'star',
  'flame',
  'thumbs-up',
  'thumbs-down',
  'flag'
]

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

const choices = computed(() => (props.modelValue as { choices?: string[] }).choices ?? [])

const stringDefault = computed(() => (props.modelValue as { defaultValue?: string | null }).defaultValue ?? '')
const numberDefault = computed(() => (props.modelValue as { defaultValue?: number | null }).defaultValue ?? null)
const selectDefault = computed(() => (props.modelValue as { defaultValue?: string | null }).defaultValue ?? null)
const multiselectDefault = computed(() => (props.modelValue as { defaultValue?: string[] | null }).defaultValue ?? [])
const ratingDefault = computed(() => (props.modelValue as { defaultValue?: number | null }).defaultValue ?? null)

const uniqueCheck = computed(() => Boolean((props.modelValue as { uniqueCheck?: boolean }).uniqueCheck))

const dateFormat = computed(() => (props.modelValue as DateFieldOptions).format ?? 'YYYY-MM-DD')

const highlightType = computed(() => (props.modelValue as DateFieldOptions).highlight?.type ?? '')
const highlightColor = computed(() => (props.modelValue as DateFieldOptions).highlight?.color ?? '')
const highlightDateModel = computed(() => {
  const date = (props.modelValue as DateFieldOptions).highlight?.date
  return date ? parseDateValue(date) : null
})

const highlightIncomplete = computed(() => {
  const highlight = (props.modelValue as DateFieldOptions).highlight
  if (!highlight) return false
  const hasType = Boolean(highlight.type)
  const hasDate = Boolean(highlight.date)
  const hasColor = Boolean(highlight.color)
  return (hasType || hasDate || hasColor) && !(hasType && hasDate && hasColor)
})

const dateDefaultMode = computed(() => {
  const value = (props.modelValue as DateFieldOptions).defaultValue
  if (value === 'current') return 'current'
  if (typeof value === 'string' && value) return 'custom'
  return 'none'
})

const dateDefaultModel = computed(() => {
  const value = (props.modelValue as DateFieldOptions).defaultValue
  if (typeof value === 'string' && value && value !== 'current') {
    return parseDateValue(value)
  }
  return null
})

const selectDefaultOptions = computed(() => {
  return [{ label: 'None', value: null }, ...choices.value.map(choice => ({ label: choice, value: choice }))]
})

const ratingMin = computed(() => {
  const options = props.modelValue as RatingFieldOptions
  return Number.isFinite(options.min) ? Number(options.min) : 0
})

const ratingMax = computed(() => {
  const options = props.modelValue as RatingFieldOptions
  const max = Number.isFinite(options.max) ? Number(options.max) : 5
  return Math.max(max, ratingMin.value)
})

const ratingColor = computed(() => (props.modelValue as RatingFieldOptions).color ?? 'currentColor')
const ratingIcon = computed(() => ((props.modelValue as RatingFieldOptions).icon ?? 'star') as BooleanIcon)
const ratingIconComponent = computed(() => booleanIconMap[ratingIcon.value])

const ratingDefaultOptions = computed(() => {
  const options: Array<{ label: string; value: number | null }> = [{ label: 'None', value: null }]
  for (let i = ratingMin.value; i <= ratingMax.value; i += 1) {
    options.push({ label: `${i} / ${ratingMax.value} *`, value: i })
  }
  return options
})

const booleanIcon = computed(() => ((props.modelValue as { icon?: BooleanIcon }).icon ?? 'square') as BooleanIcon)

function emitOptions(next: FieldOptions) {
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

function updateDefaultValue(value: unknown) {
  if (props.type === 'multiselect') {
    const next =
      Array.isArray(value) && value.length > 0 ? value : null
    emitOptions({ ...props.modelValue, defaultValue: next as never })
    return
  }
  emitOptions({ ...props.modelValue, defaultValue: value as never })
}

function updateUniqueCheck(value: boolean) {
  emitOptions({ ...props.modelValue, uniqueCheck: value })
}

function updateDateFormat(value: string | null | undefined) {
  const format = value ?? 'YYYY-MM-DD'
  emitOptions({ ...props.modelValue, format } as FieldOptions)
}

function updateHighlight(key: 'type' | 'color', value: string | null | undefined) {
  const safeValue = value ?? ''
  if (key === 'type' && !safeValue) {
    emitOptions({ ...props.modelValue, highlight: null } as FieldOptions)
    return
  }
  const current = (props.modelValue as DateFieldOptions).highlight ?? { type: '', date: '', color: '' }
  const next = { ...current, [key]: safeValue }
  const allEmpty = !next.type && !next.date && !next.color
  emitOptions({ ...props.modelValue, highlight: allEmpty ? null : next } as FieldOptions)
}

function updateHighlightDate(value: Date | null) {
  const date = value ? formatDateForStorage(value) : ''
  const current = (props.modelValue as DateFieldOptions).highlight ?? { type: '', date: '', color: '' }
  const next = { ...current, date }
  const allEmpty = !next.type && !next.date && !next.color
  emitOptions({ ...props.modelValue, highlight: allEmpty ? null : next } as FieldOptions)
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
    const existing = (props.modelValue as DateFieldOptions).defaultValue
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

function updateChoice(index: number, value: string | null | undefined) {
  const nextValue = value ?? ''
  const next = [...choices.value]
  const previous = next[index]
  next[index] = nextValue
  let nextOptions: FieldOptions = { ...props.modelValue, choices: next } as FieldOptions

  if (props.type === 'select') {
    if (selectDefault.value === previous) {
      nextOptions = { ...nextOptions, defaultValue: nextValue || null } as FieldOptions
    }
  }

  if (props.type === 'multiselect') {
    const current = multiselectDefault.value
    if (current.includes(previous)) {
      const updated = current.map(entry => (entry === previous ? nextValue : entry)).filter(Boolean)
      nextOptions = { ...nextOptions, defaultValue: updated.length > 0 ? updated : null } as FieldOptions
    }
  }

  emitOptions(nextOptions)
}

function addChoice() {
  emitOptions({ ...props.modelValue, choices: [...choices.value, ''] } as FieldOptions)
}

function requestRemoveChoice(choice: string) {
  if (!props.items || !props.fieldName) {
    removeChoice(choice)
    return
  }

  const count = countItemsUsingChoice(choice)
  if (count === 0) {
    removeChoice(choice)
    return
  }

  confirmingChoice.value = choice
  confirmingCount.value = count
}

function confirmRemoveChoice() {
  if (!confirmingChoice.value) return
  removeChoice(confirmingChoice.value)
  confirmingChoice.value = null
  confirmingCount.value = 0
}

function cancelRemoveChoice() {
  confirmingChoice.value = null
  confirmingCount.value = 0
}

function removeChoice(choice: string) {
  const next = choices.value.filter(option => option !== choice)
  let nextOptions: FieldOptions = { ...props.modelValue, choices: next } as FieldOptions

  if (props.type === 'select') {
    if (selectDefault.value === choice) {
      nextOptions = { ...nextOptions, defaultValue: null } as FieldOptions
    }
  }

  if (props.type === 'multiselect') {
    if (multiselectDefault.value.includes(choice)) {
      const updated = multiselectDefault.value.filter(entry => entry !== choice)
      nextOptions = { ...nextOptions, defaultValue: updated.length > 0 ? updated : null } as FieldOptions
    }
  }

  emitOptions(nextOptions)
  if (confirmingChoice.value === choice) {
    confirmingChoice.value = null
    confirmingCount.value = 0
  }
}

function countItemsUsingChoice(choice: string) {
  if (!props.items || !props.fieldName) return 0
  let count = 0
  for (const item of props.items) {
    const value = item.data[props.fieldName]
    if (props.type === 'select') {
      if (typeof value === 'string' && value === choice) {
        count += 1
      }
      continue
    }

    if (props.type === 'multiselect') {
      const parsed = parseMultiselectValue(value ?? null)
      if (parsed.includes(choice)) {
        count += 1
      }
    }
  }
  return count
}

function updateBooleanIcon(icon: BooleanIcon) {
  emitOptions({ ...props.modelValue, icon } as FieldOptions)
}

function updateRatingIcon(icon: BooleanIcon) {
  emitOptions({ ...props.modelValue, icon } as FieldOptions)
}

function updateRatingColor(value: string | null | undefined) {
  emitOptions({ ...props.modelValue, color: value ?? '' } as FieldOptions)
}

function updateRatingMin(value: number | null) {
  const min = Number.isFinite(value) ? Number(value) : 0
  const max = Math.max(ratingMax.value, min)
  const next: RatingFieldOptions = {
    ...(props.modelValue as RatingFieldOptions),
    min,
    max
  }
  if (next.defaultValue !== undefined && next.defaultValue !== null) {
    if (next.defaultValue < min || next.defaultValue > max) {
      next.defaultValue = null
    }
  }
  emitOptions(next)
}

function updateRatingMax(value: number | null) {
  const min = ratingMin.value
  const max = Math.max(Number.isFinite(value) ? Number(value) : 5, min)
  const next: RatingFieldOptions = {
    ...(props.modelValue as RatingFieldOptions),
    min,
    max
  }
  if (next.defaultValue !== undefined && next.defaultValue !== null) {
    if (next.defaultValue < min || next.defaultValue > max) {
      next.defaultValue = null
    }
  }
  emitOptions(next)
}
</script>
