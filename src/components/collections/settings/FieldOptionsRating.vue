<template>
  <div>
    <div class="mb-2 text-base font-semibold uppercase text-[var(--text-muted)]">Icon</div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button v-for="icon in booleanIcons" :key="icon" type="button"
        class="flex items-center justify-center gap-2 rounded-md border border-[var(--border-color)] p-2"
        :class="ratingIcon === icon ? 'bg-[var(--bg-hover)]' : ''" @click="updateRatingIcon(icon)">
        <component :is="booleanIconMap[icon]" :size="18" class="text-[var(--text-muted)]" />
        <component :is="booleanIconMap[icon]" :size="18" fill="currentColor" :stroke-width="0"
          class="text-[var(--text-primary)]" />
      </button>
    </div>
  </div>

  <div class="mt-4">
    <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Colour</div>
    <InputText :modelValue="ratingColor" @update:modelValue="value => updateRatingColor(value)"
      placeholder="currentColor" class="w-full" />
  </div>

  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Min</div>
      <InputNumber :modelValue="ratingMin" @update:modelValue="value => updateRatingMin(value)" inputClass="w-full"
        class="w-full" />
    </div>
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Max</div>
      <InputNumber :modelValue="ratingMax" @update:modelValue="value => updateRatingMax(value)" inputClass="w-full"
        class="w-full" />
    </div>
  </div>

  <div class="mt-4">
    <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Default Value</div>
    <Select :modelValue="ratingDefault" @update:modelValue="value => updateDefaultValue(value)"
      :options="ratingDefaultOptions" optionLabel="label" optionValue="value" class="w-full">
      <template #value="{ value }">
        <div class="flex items-center gap-1">
          <span v-if="value === null" class="text-[var(--text-muted)]">None</span>
          <div v-else class="flex items-center">
            <component v-for="index in ratingMax" :key="index" :is="ratingIconComponent" :size="16"
              :fill="index <= (value ?? 0) ? ratingColor : 'transparent'"
              :stroke-width="index <= (value ?? 0) ? 0 : 1.5"
              :class="index <= (value ?? 0) ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'" />
          </div>
        </div>
      </template>
      <template #option="{ option }">
        <div class="flex items-center gap-2">
          <span v-if="option.value === null" class="text-[var(--text-muted)]">None</span>
          <div v-else class="flex items-center">
            <component v-for="index in ratingMax" :key="index" :is="ratingIconComponent" :size="16"
              :fill="index <= option.value ? ratingColor : 'transparent'"
              :stroke-width="index <= option.value ? 0 : 1.5"
              :class="index <= option.value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'" />
          </div>
          <span class="text-base text-[var(--text-muted)]">{{ option.label }}</span>
        </div>
      </template>
    </Select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import * as icons from 'lucide-vue-next'
import type { RatingFieldOptions, BooleanIcon } from '../../../types/models'

const props = defineProps<{
  modelValue: RatingFieldOptions
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: RatingFieldOptions): void
}>()

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

const ratingMin = computed(() => {
  const options = props.modelValue
  return Number.isFinite(options.min) ? Number(options.min) : 0
})

const ratingMax = computed(() => {
  const options = props.modelValue
  const max = Number.isFinite(options.max) ? Number(options.max) : 5
  return Math.max(max, ratingMin.value)
})

const ratingColor = computed(() => props.modelValue.color ?? 'currentColor')
const ratingIcon = computed(() => (props.modelValue.icon ?? 'star') as BooleanIcon)
const ratingIconComponent = computed(() => booleanIconMap[ratingIcon.value])

const ratingDefault = computed(() => props.modelValue.defaultValue ?? null)

const ratingDefaultOptions = computed(() => {
  const options: Array<{ label: string; value: number | null }> = [{ label: 'None', value: null }]
  for (let i = ratingMin.value; i <= ratingMax.value; i += 1) {
    options.push({ label: `${i} / ${ratingMax.value} *`, value: i })
  }
  return options
})

function emitOptions(next: RatingFieldOptions) {
  emit('update:modelValue', next)
}

function updateDefaultValue(value: unknown) {
  emitOptions({ ...props.modelValue, defaultValue: value as number | null })
}

function updateRatingIcon(icon: BooleanIcon) {
  emitOptions({ ...props.modelValue, icon })
}

function updateRatingColor(value: string | null | undefined) {
  emitOptions({ ...props.modelValue, color: value ?? '' })
}

function updateRatingMin(value: number | null) {
  const min = Number.isFinite(value) ? Number(value) : 0
  const max = Math.max(ratingMax.value, min)
  const next: RatingFieldOptions = {
    ...props.modelValue,
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
    ...props.modelValue,
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