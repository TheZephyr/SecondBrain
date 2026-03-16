<template>
  <div class="grid h-10 items-center border-b-2 border-[var(--border-color)] bg-[var(--bg-tertiary)]"
    :style="{ gridTemplateColumns }">
    <div v-for="(header, index) in headers" :key="header.id"
      class="relative flex h-10 items-center border-r border-[var(--border-color)]"
      :class="index === headers.length - 1 ? 'border-r-0' : ''">
      <template v-if="headerMeta(header)?.type === 'rowNumber'">
        <span class="sr-only">Row</span>
      </template>
      <template v-else-if="headerMeta(header)?.type === 'addField'">
        <Button text class="mx-auto h-8 w-8 p-0" title="Add field" @click.stop="$emit('manage-fields')">
          <i class="pi pi-plus text-sm"></i>
        </Button>
      </template>
      <template v-else>
        <button type="button"
          class="flex h-full w-full items-center justify-between gap-2 px-3 text-left text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          @click="event => toggleSort(headerMeta(header)?.field, event)">
          <span class="flex min-w-0 items-center gap-1.5">
            <component :is="iconMap[FIELD_TYPE_META[headerMeta(header)?.field?.type ?? 'text'].icon]" :size="14"
              class="flex-shrink-0 text-[var(--text-muted)]" />
            <span class="truncate">{{ headerMeta(header)?.field?.name ?? header.id }}</span>
          </span>
          <span v-if="getSortEntry(headerMeta(header)?.field)" class="flex items-center gap-1 text-[var(--text-muted)]">
            <ChevronUp v-if="getSortEntry(headerMeta(header)?.field)?.order === 1" :size="12" />
            <ChevronDown v-else-if="getSortEntry(headerMeta(header)?.field)?.order === -1" :size="12" />
            <span v-if="multiSortMeta.length > 1" class="text-[10px]">
              {{ getSortIndex(headerMeta(header)?.field) + 1 }}
            </span>
          </span>
        </button>
        <div v-if="headerMeta(header)?.field"
          class="absolute right-0 top-2 bottom-2 w-px bg-[var(--border-color)] pointer-events-none" />
        <div v-if="headerMeta(header)?.field"
          class="absolute right-0 top-0 h-full w-[1px] cursor-col-resize touch-none bg-transparent hover:bg-[var(--accent-primary)] transition-colors duration-100"
          @pointerdown.stop.prevent="event => startColumnResize(event, headerMeta(header)?.field?.id)"></div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, type Component } from 'vue'
import type { Header, HeaderGroup } from '@tanstack/vue-table'
import * as icons from 'lucide-vue-next'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import Button from 'primevue/button'
import { FIELD_TYPE_META, type Field } from '../../../../types/models'
import type { MultiSortMeta } from '../types'
import type { GridRow, GridColumnMeta } from './types'

const props = defineProps<{
  headerGroups: HeaderGroup<GridRow>[]
  gridTemplateColumns: string
  multiSortMeta: MultiSortMeta[]
}>()

const emit = defineEmits<{
  sort: [value: MultiSortMeta[]]
  'manage-fields': []
  'set-column-width': [value: { fieldId: number; width: number }]
  'persist-column-widths': []
}>()

const headers = computed(() => props.headerGroups[0]?.headers ?? [])
const MIN_COLUMN_WIDTH = 60
const iconMap = icons as unknown as Record<string, Component>

let activeResize:
  | { fieldId: number; startX: number; startWidth: number; pointerId: number }
  | null = null

function stopColumnResize() {
  document.removeEventListener('pointermove', onColumnResizeMove)
  document.removeEventListener('pointerup', onColumnResizeEnd)
  document.removeEventListener('pointercancel', onColumnResizeEnd)
}

function headerMeta(header: Header<GridRow, unknown>): GridColumnMeta | undefined {
  return header.column.columnDef.meta as GridColumnMeta | undefined
}

function getFieldKey(field: Field) {
  return `data.${field.name}`
}

function getSortEntry(field?: Field) {
  if (!field) return null
  return props.multiSortMeta.find(entry => entry.field === getFieldKey(field)) ?? null
}

function getSortIndex(field?: Field) {
  if (!field) return -1
  return props.multiSortMeta.findIndex(entry => entry.field === getFieldKey(field))
}

function toggleSort(field: Field | undefined, event: MouseEvent) {
  if (!field) return
  const fieldKey = getFieldKey(field)
  const current = props.multiSortMeta
  const index = current.findIndex(entry => entry.field === fieldKey)
  const isShift = event.shiftKey

  if (!isShift) {
    if (index === -1) {
      emit('sort', [{ field: fieldKey, order: 1 }])
      return
    }
    const nextOrder = current[index]?.order === 1 ? -1 : null
    if (nextOrder === null) {
      emit('sort', [])
      return
    }
    emit('sort', [{ field: fieldKey, order: nextOrder }])
    return
  }

  if (index === -1) {
    emit('sort', [...current, { field: fieldKey, order: 1 }])
    return
  }

  const currentOrder = current[index]?.order
  if (currentOrder === 1) {
    const next = [...current]
    next[index] = { field: fieldKey, order: -1 }
    emit('sort', next)
    return
  }

  emit('sort', current.filter(entry => entry.field !== fieldKey))
}

function startColumnResize(event: PointerEvent, fieldId: number | undefined) {
  if (!fieldId) return

  const handleElement = event.currentTarget as HTMLElement | null
  const headerCellElement = handleElement?.parentElement
  if (!headerCellElement) return

  const startWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(headerCellElement.getBoundingClientRect().width))
  activeResize = {
    fieldId,
    startX: event.clientX,
    startWidth,
    pointerId: event.pointerId
  }

  document.addEventListener('pointermove', onColumnResizeMove)
  document.addEventListener('pointerup', onColumnResizeEnd)
  document.addEventListener('pointercancel', onColumnResizeEnd)
}

function onColumnResizeMove(event: PointerEvent) {
  if (!activeResize) return
  if (event.pointerId !== activeResize.pointerId) return

  const deltaX = event.clientX - activeResize.startX
  const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(activeResize.startWidth + deltaX))

  emit('set-column-width', {
    fieldId: activeResize.fieldId,
    width: nextWidth
  })
}

function onColumnResizeEnd(event: PointerEvent) {
  if (!activeResize) return
  if (event.pointerId !== activeResize.pointerId) return

  activeResize = null
  stopColumnResize()
  emit('persist-column-widths')
}

onBeforeUnmount(() => {
  activeResize = null
  stopColumnResize()
})
</script>
