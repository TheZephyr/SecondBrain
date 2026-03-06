<template>
  <div
    class="grid items-center border-b border-[var(--border-color)] text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] group"
    :class="isSelected ? 'bg-[var(--bg-hover)]' : ''"
    :style="{ gridTemplateColumns }"
    :aria-rowindex="virtualIndex + 1"
    @contextmenu.prevent="event => emitRowContextMenu(event)"
  >
    <div
      v-for="(cell, cellIndex) in cells"
      :key="cell.id"
      class="flex h-10 items-center border-r border-[var(--border-color)]"
      :class="cellIndex === cells.length - 1 ? 'border-r-0' : ''"
    >
      <template v-if="cellMeta(cell)?.type === 'rowNumber'">
        <div class="relative flex h-10 w-full items-center justify-end pr-2">
          <span
            class="text-right text-xs text-[var(--text-muted)] transition-opacity"
            :class="isSelected ? 'opacity-0' : 'group-hover:opacity-0'"
          >
            {{ rowIndex + 1 }}
          </span>
          <div
            class="absolute right-1 flex items-center gap-1 transition-opacity"
            :class="isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
          >
            <input
              type="checkbox"
              class="h-3.5 w-3.5 cursor-pointer rounded border border-[var(--border-color)] accent-[var(--accent-primary)]"
              :checked="isSelected"
              @click.stop
              @change="event => emitRowSelectionToggle(event)"
            />
            <Button
              text
              class="h-6 w-6 p-0 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              title="Expand"
              @click.stop="emitEditItem"
            >
              <ChevronRight :size="14" />
            </Button>
          </div>
        </div>
      </template>
      <template v-else-if="cellMeta(cell)?.type === 'addField'">
        <div class="h-10 w-full"></div>
      </template>
      <template v-else>
        <CollectionGridCell
          :value="getCellValue(cell)"
          :field="cellMeta(cell)?.field"
          :rowId="row.original.id"
          :rowIndex="rowIndex"
          :rowIds="rowIds"
          :orderedFields="orderedFields"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Cell, Row } from '@tanstack/vue-table'
import { ChevronRight } from 'lucide-vue-next'
import Button from 'primevue/button'
import type { Field, Item, ItemDataValue } from '../../../../types/models'
import type { GridColumnMeta, GridRow } from './types'
import CollectionGridCell from './CollectionGridCell.vue'

defineOptions({
  inheritAttrs: false
})

const props = defineProps<{
  row: Row<GridRow>
  virtualIndex: number
  rowIndex: number
  totalRows: number
  gridTemplateColumns: string
  orderedFields: Field[]
  rowIds: number[]
  isSelected: boolean
}>()

const emit = defineEmits<{
  'edit-item': [value: Item]
  'row-contextmenu': [value: { event: MouseEvent; row: Item; rowIndex: number; totalRows: number }]
  'toggle-row-selection': [value: { rowId: number; selected: boolean }]
}>()

const cells = computed(() => props.row.getVisibleCells())

function cellMeta(cell: Cell<GridRow, unknown>): GridColumnMeta | undefined {
  return cell.column.columnDef.meta as GridColumnMeta | undefined
}

function getCellValue(cell: Cell<GridRow, unknown>) {
  return cell.getValue() as ItemDataValue
}

function emitEditItem() {
  emit('edit-item', props.row.original)
}

function emitRowSelectionToggle(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  emit('toggle-row-selection', {
    rowId: props.row.original.id,
    selected: target.checked
  })
}

function emitRowContextMenu(event: MouseEvent) {
  emit('row-contextmenu', {
    event,
    row: props.row.original,
    rowIndex: props.rowIndex,
    totalRows: props.totalRows
  })
}
</script>
