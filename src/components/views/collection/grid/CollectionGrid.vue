<template>
  <div class="flex h-full w-full min-h-0 flex-col">
    <CollectionGridToolbar
      v-model:searchQuery="searchModel"
      :multiSortMeta="multiSortMeta"
    />

    <div
      v-if="orderedFields.length === 0"
      class="flex flex-1 flex-col items-center justify-center px-10 py-16 text-center"
    >
      <Columns :size="64" :stroke-width="1.5" class="mb-5 text-[var(--text-muted)]" />
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">No Fields Yet</h3>
      <p class="mt-2 text-sm text-[var(--text-muted)]">
        Define the structure of your collection by adding fields
      </p>
      <Button class="mt-6 min-w-[140px] gap-2 px-4 !text-white" @click="notifyAddField">
        <Plus />
        Add Fields
      </Button>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div
        class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-primary)]"
      >
        <CollectionGridHeader
          :headerGroups="headerGroups"
          :gridTemplateColumns="gridTemplateColumns"
          :multiSortMeta="multiSortMeta"
          @sort="onSort"
          @manage-fields="notifyAddField"
          @set-column-width="onSetColumnWidth"
          @persist-column-widths="onPersistColumnWidths"
        />
        <CollectionGridBody
          class="min-h-0 flex-1"
          :rows="rows"
          :gridTemplateColumns="gridTemplateColumns"
          :itemsTotal="itemsTotal"
          :itemsLoading="itemsLoading"
          :itemsFullyLoaded="itemsFullyLoaded"
          :debouncedSearchQuery="debouncedSearchQuery"
          :orderedFields="orderedFields"
          :loadNextPage="loadNextPage"
          @edit-item="emitEditItem"
          @row-contextmenu="onRowContextMenu"
        />
        <CollectionGridFooter :itemsTotal="itemsTotal" />
      </div>

      <ContextMenu ref="contextMenuRef" :model="contextMenuItems" :pt="contextMenuPt" />
    </div>
  </div>

</template>

<script setup lang="ts">
import { computed, provide, ref, toRef } from 'vue'
import { Columns } from 'lucide-vue-next'
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import { getCoreRowModel, useVueTable, type HeaderGroup, type Row } from '@tanstack/vue-table'
import type {
  Field,
  Item,
  InsertItemAtInput,
  DuplicateItemInput,
  MoveItemInput
} from '../../../../types/models'
import type { MultiSortMeta } from '../types'
import CollectionGridHeader from './CollectionGridHeader.vue'
import CollectionGridBody from './CollectionGridBody.vue'
import CollectionGridFooter from './CollectionGridFooter.vue'
import CollectionGridToolbar from './CollectionGridToolbar.vue'
import { gridEditingKey, gridSelectionKey } from './types'
import { useGridSelection } from '../../../../composables/collection/grid/useGridSelection'
import { useGridEditing } from '../../../../composables/collection/grid/useGridEditing'
import { useGridColumns } from '../../../../composables/collection/grid/useGridColumns'

type RowContextMenuPayload = {
  event: MouseEvent
  row: Item
  rowIndex: number
  totalRows: number
}

const props = defineProps<{
  viewId: number
  items: Item[]
  itemsTotal: number
  itemsLoading: boolean
  itemsFullyLoaded: boolean
  orderedFields: Field[]
  searchQuery: string
  debouncedSearchQuery: string
  multiSortMeta: MultiSortMeta[]
  loadNextPage: () => Promise<void>
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:multiSortMeta': [value: MultiSortMeta[]]
  sort: [value: MultiSortMeta[]]
  'edit-item': [value: Item]
  'delete-item': [value: Item]
  'manage-fields': []
  'open-add-item': []
  'update-item': [value: { id: number; data: Item['data'] }]
  'insert-item-at': [value: InsertItemAtInput]
  'duplicate-item': [value: DuplicateItemInput]
  'move-item': [value: MoveItemInput]
}>()

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

const {
  columns,
  gridTemplateColumns,
  setColumnWidth,
  persistColumnWidths
} = useGridColumns({
  orderedFields: computed(() => props.orderedFields),
  viewId: toRef(props, 'viewId')
})

const selection = useGridSelection()
const editing = useGridEditing({
  items: toRef(props, 'items'),
  orderedFields: toRef(props, 'orderedFields'),
  selection
})

provide(gridSelectionKey, selection)
provide(gridEditingKey, editing)

const table = useVueTable<Item>({
  get data() {
    return props.items
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true
})

const rows = computed<Row<Item>[]>(() => table.getRowModel().rows)
const headerGroups = computed<HeaderGroup<Item>[]>(() => table.getHeaderGroups())

const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const contextMenuRow = ref<Item | null>(null)
const contextMenuRowIndex = ref<number | null>(null)
const contextMenuTotalRows = ref(0)

const contextMenuPt = {
  root: {
    class:
      'rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm shadow-lg'
  },
  rootList: {
    class: 'py-1'
  },
  itemContent: {
    class: 'rounded-md'
  },
  itemLink: {
    class:
      'flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
  },
  separator: {
    class: 'my-1 border-t border-[var(--border-color)]'
  }
}

const contextMenuItems = computed(() => {
  const row = contextMenuRow.value
  const rowIndex = contextMenuRowIndex.value
  const totalRows = contextMenuTotalRows.value
  const isFirstOnPage = rowIndex === 0
  const isLastOnPage = rowIndex !== null && rowIndex === totalRows - 1
  const collectionId = row?.collection_id

  return [
    {
      label: 'Insert row above',
      command: () => {
        if (!row || collectionId === undefined) return
        const afterOrder = row.order <= 0 ? null : row.order - 1
        emit('insert-item-at', { collectionId, afterOrder })
      }
    },
    {
      label: 'Insert row below',
      command: () => {
        if (!row || collectionId === undefined) return
        emit('insert-item-at', { collectionId, afterOrder: row.order })
      }
    },
    {
      label: 'Duplicate row',
      command: () => {
        if (!row || collectionId === undefined) return
        emit('duplicate-item', { collectionId, itemId: row.id })
      }
    },
    { separator: true },
    {
      label: 'Move up',
      disabled: !row || isFirstOnPage,
      command: () => {
        if (!row || collectionId === undefined || isFirstOnPage) return
        emit('move-item', { collectionId, itemId: row.id, direction: 'up' })
      }
    },
    {
      label: 'Move down',
      disabled: !row || isLastOnPage,
      command: () => {
        if (!row || collectionId === undefined || isLastOnPage) return
        emit('move-item', { collectionId, itemId: row.id, direction: 'down' })
      }
    },
    { separator: true },
    {
      label: 'Delete row',
      command: () => {
        if (!row) return
        emit('delete-item', row)
      }
    }
  ]
})

function onSort(nextMeta: MultiSortMeta[]) {
  emit('update:multiSortMeta', nextMeta)
  emit('sort', nextMeta)
}

function onSetColumnWidth(payload: { fieldId: number; width: number }) {
  setColumnWidth(payload.fieldId, payload.width)
}

function onPersistColumnWidths() {
  void persistColumnWidths()
}

function onRowContextMenu(payload: RowContextMenuPayload) {
  contextMenuRow.value = payload.row
  contextMenuRowIndex.value = payload.rowIndex
  contextMenuTotalRows.value = payload.totalRows
  contextMenuRef.value?.show(payload.event)
}

function emitEditItem(item: Item) {
  emit('edit-item', item)
}

function notifyAddField() {
  emit('manage-fields')
}
</script>
