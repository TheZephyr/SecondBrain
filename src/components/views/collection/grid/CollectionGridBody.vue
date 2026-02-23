<template>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-auto bg-[var(--bg-primary)]">
    <div v-if="rows.length === 0 && !itemsLoading" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-3 py-10 text-[var(--text-muted)]">
        <component
          :is="itemsTotal === 0 && !debouncedSearchQuery ? FileText : Search"
          :size="40"
          :stroke-width="1.5"
        />
        <p class="text-sm text-center">
          {{
            itemsTotal === 0 && !debouncedSearchQuery
              ? 'No items yet. Click the + row below to get started!'
              : 'No items match your search.'
          }}
        </p>
      </div>
    </div>

    <div class="min-w-full">
      <CollectionGridRow
        v-for="(row, index) in rows"
        :key="row.id"
        :row="row"
        :rowIndex="index"
        :totalRows="rows.length"
        :gridTemplateColumns="gridTemplateColumns"
        :orderedFields="orderedFields"
        :rowIds="rowIds"
        @edit-item="$emit('edit-item', $event)"
        @row-contextmenu="$emit('row-contextmenu', $event)"
      />
      <CollectionGridAddRow
        :gridTemplateColumns="gridTemplateColumns"
        :orderedFields="orderedFields"
      />
    </div>

    <div
      v-if="itemsLoading && rows.length === 0"
      class="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg-primary)_70%,transparent)] text-xs text-[var(--text-muted)]"
    >
      Loading...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Row } from '@tanstack/vue-table'
import { FileText, Search } from 'lucide-vue-next'
import type { Field, Item } from '../../../../types/models'
import CollectionGridRow from './CollectionGridRow.vue'
import CollectionGridAddRow from './CollectionGridAddRow.vue'

type RowContextMenuPayload = {
  event: MouseEvent
  row: Item
  rowIndex: number
  totalRows: number
}

const props = defineProps<{
  rows: Row<Item>[]
  gridTemplateColumns: string
  itemsTotal: number
  itemsLoading: boolean
  debouncedSearchQuery: string
  orderedFields: Field[]
}>()

const rowIds = computed(() => props.rows.map(row => row.original.id))

defineEmits<{
  'edit-item': [value: Item]
  'row-contextmenu': [value: RowContextMenuPayload]
}>()
</script>
