<template>
  <div
    class="grid items-center border-b border-[var(--border-color)] text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] group"
    :style="{ gridTemplateColumns }"
    @contextmenu.prevent="event => emitRowContextMenu(event)"
  >
    <div
      v-for="(cell, cellIndex) in cells"
      :key="cell.id"
      class="flex h-9 items-center border-r border-[var(--border-color)]"
      :class="cellIndex === cells.length - 1 ? 'border-r-0' : ''"
    >
      <template v-if="cellMeta(cell)?.type === 'rowNumber'">
        <div class="relative flex h-9 w-full items-center justify-end pr-2">
          <span class="text-right text-xs text-[var(--text-muted)] transition-opacity group-hover:opacity-0">
            {{ rowIndex + 1 }}
          </span>
          <div class="absolute right-1 flex items-center gap-1">
            <Button
              text
              class="h-6 w-6 p-0 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              title="Expand"
              @click.stop="emitEditItem"
            >
              <ChevronRight :size="14" />
            </Button>
          </div>
        </div>
      </template>
      <template v-else-if="cellMeta(cell)?.type === 'addField'">
        <div class="h-9 w-full"></div>
      </template>
      <template v-else>
        <CollectionGridCell
          :value="getCellValue(cell)"
          :field="cellMeta(cell)?.field"
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
import type { Item, ItemDataValue } from '../../../../types/models'
import type { GridColumnMeta, GridRow } from './types'
import CollectionGridCell from './CollectionGridCell.vue'

const props = defineProps<{
  row: Row<GridRow>
  rowIndex: number
  totalRows: number
  gridTemplateColumns: string
}>()

const emit = defineEmits<{
  'edit-item': [value: Item]
  'row-contextmenu': [value: { event: MouseEvent; row: Item; rowIndex: number; totalRows: number }]
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

function emitRowContextMenu(event: MouseEvent) {
  emit('row-contextmenu', {
    event,
    row: props.row.original,
    rowIndex: props.rowIndex,
    totalRows: props.totalRows
  })
}
</script>
