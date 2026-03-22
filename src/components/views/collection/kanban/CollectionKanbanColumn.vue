<template>
  <div class="flex h-full min-h-0 w-[240px] flex-shrink-0 flex-col rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]">
    <div class="flex items-center gap-2 px-3 py-2" :class="headerDragOver ? 'bg-[var(--bg-hover)]' : ''"
      @dragover="onHeaderDragOver" @drop="onHeaderDrop" @dragleave="onHeaderDragLeave">
      <div class="flex-1">
        <Chip :label="column.label" :style="chipStyle" class="text-xs py-0 px-2 h-5 leading-none"
          :pt="{ root: { class: 'rounded-full' } }" />
      </div>
      <Button icon="pi pi-plus" text class="h-7 w-7" @click="emit('add-item', column.key)" />
      <span v-if="!isUncategorized" class="flex size-6 items-center justify-center text-[var(--text-muted)]"
        title="Drag to reorder" draggable="true" @dragstart="onHeaderDragStart" @dragend="onHeaderDragEnd"
        @mousedown.stop>
        <GripVertical :size="14" />
      </span>
    </div>

    <div ref="bodyRef" class="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 pb-3" data-kanban-scroll
      @dragover="onBodyDragOver" @drop="onBodyDrop" @dragleave="onBodyDragLeave">
      <div v-if="column.items.length === 0" class="py-4 text-sm text-[var(--text-muted)]">No items</div>

      <template v-for="(item, index) in column.items" :key="item.id">
        <div v-if="dropIndicatorIndex === index" class="h-0.5 w-full rounded bg-[var(--accent-primary)]"></div>
        <CollectionKanbanCard :item="item" :viewOrderedFields="viewOrderedFields"
          @edit="emit('edit-item', $event)" @drag-start="onCardDragStart" />
      </template>
      <div v-if="dropIndicatorIndex === column.items.length" class="h-0.5 w-full rounded bg-[var(--accent-primary)]"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import { GripVertical } from 'lucide-vue-next'
import type { Field, Item } from '../../../../types/models'
import type { KanbanColumn } from '../../../../composables/collection/kanban/useCollectionKanban'
import { getChipStyle } from '../../../../utils/selectChip'
import CollectionKanbanCard from './CollectionKanbanCard.vue'

const props = defineProps<{
  column: KanbanColumn
  viewOrderedFields: Field[]
  isUncategorized: boolean
  colorOptions: string[]
}>()

const emit = defineEmits<{
  (e: 'add-item', value: string | null): void
  (e: 'edit-item', value: Item): void
  (e: 'card-drop', value: { itemId: number; targetColumnKey: string | null; afterItemId?: number | null }): void
  (e: 'column-drop', value: { fromKey: string; toKey: string }): void
}>()

const bodyRef = ref<HTMLElement | null>(null)
const dropIndicatorIndex = ref<number | null>(null)
const headerDragOver = ref(false)

const chipStyle = computed(() => {
  if (props.isUncategorized) {
    return { '--p-chip-background': 'var(--surface-2)', '--p-chip-color': 'var(--text-muted)' }
  }
  return getChipStyle(props.column.label, props.colorOptions)
})

function onHeaderDragStart(event: DragEvent) {
  if (!props.column.key) {
    return
  }
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', String(props.column.key))
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onHeaderDragEnd() {
  headerDragOver.value = false
}

function onHeaderDragOver(event: DragEvent) {
  if (!props.column.key) {
    return
  }
  headerDragOver.value = true
  event.preventDefault()
}

function onHeaderDragLeave() {
  headerDragOver.value = false
}

function onHeaderDrop(event: DragEvent) {
  event.preventDefault()
  headerDragOver.value = false
  const fromKey = event.dataTransfer?.getData('text/plain')
  if (!fromKey || !props.column.key || fromKey === props.column.key) {
    return
  }
  emit('column-drop', { fromKey, toKey: props.column.key })
}

function onCardDragStart() {
  dropIndicatorIndex.value = null
}

function onBodyDragOver(event: DragEvent) {
  const target = event.target as HTMLElement | null
  const cardEl = target?.closest('[data-kanban-card]') as HTMLElement | null

  if (cardEl && cardEl.dataset.itemId) {
    const rect = cardEl.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    const cardId = Number(cardEl.dataset.itemId)
    const index = props.column.items.findIndex(item => item.id === cardId)
    if (index >= 0) {
      dropIndicatorIndex.value = event.clientY > midpoint ? index + 1 : index
    } else {
      dropIndicatorIndex.value = props.column.items.length
    }
  } else {
    dropIndicatorIndex.value = props.column.items.length
  }

  event.preventDefault()
}

function onBodyDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null
  if (related && bodyRef.value?.contains(related)) {
    return
  }
  dropIndicatorIndex.value = null
}

function onBodyDrop(event: DragEvent) {
  event.preventDefault()
  const itemIdRaw = event.dataTransfer?.getData('text/plain')
  const itemId = Number(itemIdRaw)
  if (!Number.isInteger(itemId) || itemId <= 0) {
    dropIndicatorIndex.value = null
    return
  }

  const index = dropIndicatorIndex.value ?? props.column.items.length
  const afterItemId = index > 0 ? props.column.items[index - 1]?.id ?? null : null
  emit('card-drop', {
    itemId,
    targetColumnKey: props.column.key,
    afterItemId
  })
  dropIndicatorIndex.value = null
}
</script>
