<template>
  <div class="mx-auto max-w-6xl px-10 py-8 space-y-4">
    <div class="text-base font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
      Visible Fields
    </div>
    <div class="space-y-2">
      <div v-for="field in orderedFields" :key="field.id"
        class="flex items-center gap-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2"
        :class="dragOverId === field.id ? 'ring-1 ring-[var(--accent-primary)]' : ''"
        @dragover="event => onDragOver(field.id, event)" @drop="event => onDrop(field.id, event)">
        <Checkbox :binary="true" :modelValue="isSelected(field.id)"
          @update:modelValue="value => emit('toggle-field', { id: field.id, selected: value })" />
        <span class="flex-1 truncate text-base text-[var(--text-primary)]">
          {{ field.name }}
        </span>
        <span v-if="isSelected(field.id)" class="flex size-6 items-center justify-center text-[var(--text-muted)]"
          title="Drag to reorder" draggable="true" @dragstart="event => onDragStart(field.id, event)"
          @dragend="onDragEnd" @mousedown.stop>
          <GripVertical :size="14" />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Checkbox from 'primevue/checkbox'
import { GripVertical } from 'lucide-vue-next'
import type { Field } from '../../../types/models'

const props = defineProps<{
  orderedFields: Field[]
  selectedFieldIds: number[]
}>()

const emit = defineEmits<{
  (e: 'toggle-field', payload: { id: number; selected: boolean }): void
  (e: 'reorder-selected', payload: { draggedId: number; targetId: number }): void
}>()

const draggedId = ref<number | null>(null)
const dragOverId = ref<number | null>(null)

const selectedSet = computed(() => new Set(props.selectedFieldIds))

function isSelected(id: number) {
  return selectedSet.value.has(id)
}

function onDragStart(id: number, event: DragEvent) {
  if (!isSelected(id)) return
  draggedId.value = id
  dragOverId.value = null
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', String(id))
    event.dataTransfer.setDragImage?.(event.currentTarget as Element, 0, 0)
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(id: number, event: DragEvent) {
  if (!isSelected(id) || draggedId.value === null || draggedId.value === id) {
    return
  }
  dragOverId.value = id
  event.preventDefault()
}

function onDrop(id: number, event: DragEvent) {
  event.preventDefault()
  if (!isSelected(id) || draggedId.value === null || draggedId.value === id) {
    onDragEnd()
    return
  }
  emit('reorder-selected', { draggedId: draggedId.value, targetId: id })
  onDragEnd()
}

function onDragEnd() {
  draggedId.value = null
  dragOverId.value = null
}
</script>
