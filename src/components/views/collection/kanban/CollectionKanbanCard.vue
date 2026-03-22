<template>
  <div class="relative">
    <Card :pt="{ root: { class: 'rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-sm' } }"
      draggable="true" data-kanban-card :data-item-id="item.id" @dragstart="onDragStart" @dragend="onDragEnd">
      <template #title>
        <div class="pr-6 text-sm font-semibold text-[var(--text-primary)]">
          {{ titleText }}
        </div>
      </template>
      <template #content>
        <div class="space-y-2">
          <div v-for="field in detailFields" :key="field.id" class="field-row flex items-start gap-2 text-sm">
            <span class="w-24 shrink-0 text-[var(--text-muted)]">{{ field.name }}</span>
            <span class="flex-1 text-[var(--text-primary)]">
              <template v-if="field.type === 'select'">
                <Chip v-if="getDisplayText(field)" :label="getDisplayText(field)"
                  :style="getChipStyle(String(getDisplayText(field)), getSelectChoices(field))"
                  class="text-xs py-0 px-2 h-5 leading-none" :pt="{ root: { class: 'rounded-full' } }" />
                <span v-else class="text-[var(--text-muted)]">—</span>
              </template>
              <template v-else-if="field.type === 'multiselect'">
                <div v-if="getMultiValues(field).length > 0" class="flex flex-wrap gap-1">
                  <Chip v-for="option in getMultiValues(field)" :key="option" :label="option"
                    :style="getChipStyle(option, getSelectChoices(field))" class="text-xs py-0 px-2 h-5 leading-none"
                    :pt="{ root: { class: 'rounded-full' } }" />
                </div>
                <span v-else class="text-[var(--text-muted)]">—</span>
              </template>
              <template v-else-if="field.type === 'boolean'">
                <component :is="getBooleanIcon(field)" :size="16" :fill="getBooleanValue(field) ? 'currentColor' : 'transparent'"
                  :stroke-width="getBooleanValue(field) ? 0 : 1.5"
                  :class="getBooleanValue(field) ? 'text-[var(--p-primary-color)]' : 'text-[var(--text-muted)]'" />
              </template>
              <template v-else-if="field.type === 'rating'">
                <div v-if="getRatingMax(field) > 0" class="flex items-center">
                  <component v-for="index in getRatingMax(field)" :key="index" :is="getRatingIcon(field)" :size="14"
                    :fill="index <= (getRatingValue(field) ?? 0) ? getRatingColor(field) : 'transparent'"
                    :stroke-width="index <= (getRatingValue(field) ?? 0) ? 0 : 1.5"
                    :class="index <= (getRatingValue(field) ?? 0) ? 'text-[var(--p-primary-color)]' : 'text-[var(--text-muted)]'" />
                </div>
                <span v-else class="text-[var(--text-muted)]">—</span>
              </template>
              <template v-else>
                <span v-if="getDisplayText(field)" class="block truncate">
                  {{ getDisplayText(field) }}
                </span>
                <span v-else class="text-[var(--text-muted)]">—</span>
              </template>
            </span>
          </div>
        </div>
      </template>
    </Card>
    <Button icon="pi pi-ellipsis-v" text class="absolute right-2 top-2" @click="toggleMenu" />
    <Menu ref="menuRef" :model="menuItems" popup />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Chip from 'primevue/chip'
import type { BooleanIcon, Field, Item, RatingFieldOptions, DateFieldOptions } from '../../../../types/models'
import { formatDateWithFieldOptions } from '../../../../utils/date'
import { parseFieldOptions, getSelectChoices } from '../../../../utils/fieldOptions'
import { parseBooleanValue, parseMultiselectValue, parseRatingValue } from '../../../../utils/fieldValues'
import { getChipStyle } from '../../../../utils/selectChip'
import * as icons from 'lucide-vue-next'

const props = defineProps<{
  item: Item
  viewOrderedFields: Field[]
}>()

const emit = defineEmits<{
  (e: 'edit', value: Item): void
  (e: 'drag-start', id: number): void
}>()

const menuRef = ref<InstanceType<typeof Menu> | null>(null)

const menuItems = computed(() => [
  {
    label: 'Edit',
    icon: 'pi pi-pencil',
    command: () => emit('edit', props.item)
  }
])

const titleField = computed(() => props.viewOrderedFields[0] ?? null)

const titleText = computed(() => {
  const field = titleField.value
  if (!field) {
    return `#${props.item.id}`
  }

  const value = getDisplayText(field)
  return value || `#${props.item.id}`
})

const detailFields = computed(() => props.viewOrderedFields.slice(1))

function getDisplayText(field: Field): string {
  const value = props.item.data[field.name]
  if (value === null || value === undefined || value === '') return ''

  if (field.type === 'date') {
    const options = parseFieldOptions(field.type, field.options) as DateFieldOptions
    return formatDateWithFieldOptions(value, options)
  }

  return String(value)
}

function getBooleanValue(field: Field): boolean {
  return parseBooleanValue(props.item.data[field.name])
}

function getBooleanIcon(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as { icon?: BooleanIcon }
  const icon = (options.icon ?? 'square') as BooleanIcon
  return booleanIconMap[icon]
}

function getMultiValues(field: Field): string[] {
  return parseMultiselectValue(props.item.data[field.name])
}

function getRatingValue(field: Field): number | null {
  return parseRatingValue(props.item.data[field.name])
}

function getRatingMax(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions
  const min = Number.isFinite(options.min) ? Number(options.min) : 0
  const max = Number.isFinite(options.max) ? Number(options.max) : 5
  return Math.max(max, min)
}

function getRatingColor(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions
  return options.color ?? 'currentColor'
}

function getRatingIcon(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions
  const icon = (options.icon ?? 'star') as BooleanIcon
  return booleanIconMap[icon]
}

function toggleMenu(event: MouseEvent) {
  menuRef.value?.toggle(event)
}

function onDragStart(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', String(props.item.id))
    event.dataTransfer.effectAllowed = 'move'
  }
  emit('drag-start', props.item.id)
}

function onDragEnd() {
  // no-op for now
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
