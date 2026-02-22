<template>
  <div class="flex h-full min-h-0 flex-col">
    <div v-if="orderedFields.length === 0"
      class="flex flex-col items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-10 py-16 text-center">
      <Columns :size="64" :stroke-width="1.5" class="mb-5 text-[var(--text-muted)]" />
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">No Fields Yet</h3>
      <p class="mt-2 text-sm text-[var(--text-muted)]">
        Define the structure of your collection by adding fields
      </p>
      <Button class="mt-6 gap-2 min-w-[140px] px-4 !text-white" @click="$emit('open-fields-drawer')">
        <Plus />
        Add Fields
      </Button>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div
        class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-color)]">
        <DataTable :value="tableRows" dataKey="id" stripedRows sortMode="multiple" removableSort contextMenu
          v-model:multiSortMeta="sortModel" :rowHover="true" lazy :rows="itemsRows"
          :first="itemsPage * itemsRows" :totalRecords="itemsTotal" :loading="itemsLoading" editMode="cell"
          :rowClass="getRowClass" v-model:contextMenuSelection="contextMenuSelection"
          @row-contextmenu="onRowContextMenu" @sort="onSort" @cell-edit-init="onCellEditInit"
          @cell-edit-complete="onCellEditComplete" @cell-edit-cancel="onCellEditCancel" :pt="dataTablePt"
          scrollable scrollHeight="flex" class="flex-1"
          tableStyle="table-layout: fixed; width: 100%">
          <Column style="width: 60px">
            <template #body="{ index }">
              <div class="relative flex items-center justify-end pr-2">
                <span class="text-right text-xs text-[var(--text-muted)] transition-opacity"
                  :class="'group-hover:opacity-0'">
                  {{ getAbsoluteIndex(index) }}
                </span>
                <div class="absolute right-1 flex items-center gap-1">
                  <Button text
                    class="h-6 w-6 p-0 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    title="Expand" @click.stop="notifyRowDetail">
                    <ChevronRight :size="14" />
                  </Button>
                </div>
              </div>
            </template>
          </Column>

          <Column v-for="field in orderedFields" :key="field.id" :field="getFieldKey(field.name)" :header="field.name"
            sortable :style="{ width: dataColumnWidth }">
            <template #body="{ data }">
              <div class="flex h-full w-full items-center rounded-sm px-3 py-2 text-sm outline-none transition hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                tabindex="0" :class="isActiveCell(getCellKey(data, field)) ? 'ring-1 ring-[var(--accent-primary)]' : ''"
                @click="event => onCellPreviewClick(event, getCellKey(data, field))"
                @keydown.enter.prevent.stop="event => activateEditor(event, getCellKey(data, field))"
                @focus="setActiveCell(getCellKey(data, field))">
                <span class="block max-w-[320px] truncate">
                  {{ formatFieldValue(getRowFieldValue(data, field), field.type) }}
                </span>
              </div>
            </template>
            <template #editor="{ data }">
              <InputText v-if="field.type === 'text'" :modelValue="getTextEditorValue(data, field)"
                @update:modelValue="value => setTextEditorValue(data, field, value)" class="w-full"
                :ref="el => setEditorRef(getCellKey(data, field), el)" />
              <Textarea v-else-if="field.type === 'textarea'" :modelValue="getTextEditorValue(data, field)"
                @update:modelValue="value => setTextEditorValue(data, field, value)" rows="2" class="w-full"
                :ref="el => setEditorRef(getCellKey(data, field), el)" />
              <InputNumber v-else-if="field.type === 'number'" :modelValue="getNumberEditorValue(data, field)"
                @update:modelValue="value => setNumberEditorValue(data, field, value)" inputClass="w-full" class="w-full"
                :ref="el => setEditorRef(getCellKey(data, field), el)" />
              <DatePicker v-else-if="field.type === 'date'" :modelValue="getDateEditorValue(data, field)"
                @update:modelValue="value => setDateEditorValue(data, field, value)" dateFormat="yy-mm-dd"
                inputClass="w-full" class="w-full" :ref="el => setEditorRef(getCellKey(data, field), el)" />
              <Select v-else-if="field.type === 'select'" :modelValue="getSelectEditorValue(data, field)"
                @update:modelValue="value => setSelectEditorValue(data, field, value)" :options="getSelectOptions(field)"
                class="w-full" :ref="el => setEditorRef(getCellKey(data, field), el)" />
            </template>
          </Column>

          <Column style="width: 48px">
            <template #header>
              <Button text class="h-8 w-8 p-0" title="Add field" @click.stop="notifyAddField">
                <Plus :size="14" />
              </Button>
            </template>
          </Column>

          <template #empty>
            <div class="flex flex-col items-center gap-3 py-10 text-[var(--text-muted)]">
              <component :is="itemsTotal === 0 && !debouncedSearchQuery ? FileText : Search" :size="40"
                :stroke-width="1.5" />
              <p class="text-sm">
                {{ itemsTotal === 0 && !debouncedSearchQuery ?
                  "No items yet. Click \"Add Item\" to get started!" :
                  "No items match your search."
                }}
              </p>
            </div>
          </template>
        </DataTable>

        <div class="flex items-center justify-between px-3 py-2 text-xs text-[var(--text-muted)]">
          <span>{{ itemsTotal }} records</span>
          <Paginator :rows="itemsRows" :first="itemsPage * itemsRows" :totalRecords="itemsTotal"
            :rowsPerPageOptions="[25, 50, 100]"
            template="RowsPerPageDropdown FirstPageLink PrevPageLink NextPageLink LastPageLink" :pt="paginatorPt"
            @page="onPage" />
        </div>
      </div>

      <ContextMenu ref="contextMenuRef" :model="contextMenuItems" :pt="contextMenuPt" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  Columns,
  Plus,
  Search,
  FileText,
  ChevronRight
} from 'lucide-vue-next'
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Paginator from 'primevue/paginator'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import type { MenuItem } from 'primevue/menuitem'
import { formatDateForDisplay, formatDateForStorage, parseDateValue } from '../../../utils/date'
import type {
  Field,
  FieldType,
  Item,
  ItemData,
  ItemDataValue,
  InsertItemAtInput,
  DuplicateItemInput,
  MoveItemInput
} from '../../../types/models'
import type {
  MultiSortMeta,
  TablePageEventLike,
  TableSortEventLike
} from './types'

type TableRowValue = ItemDataValue | Date | null
type TableRow = Item & Record<`data.${string}`, TableRowValue>

type CellEditInitEvent = {
  originalEvent: Event
  data: TableRow
  field: string
  index: number
}

type CellEditCompleteEvent = CellEditInitEvent & {
  newData: TableRow
  value: unknown
  newValue: unknown
  type: string
}

type RowContextMenuEvent = {
  originalEvent: Event
  data: TableRow
  index: number
}

const props = defineProps<{
  items: Item[]
  itemsTotal: number
  itemsLoading: boolean
  itemsPage: number
  itemsRows: number
  orderedFields: Field[]
  debouncedSearchQuery: string
  multiSortMeta: MultiSortMeta[]
}>()

const emit = defineEmits<{
  'update:multiSortMeta': [value: MultiSortMeta[]]
  page: [value: TablePageEventLike]
  sort: [value: TableSortEventLike]
  'delete-item': [value: Item]
  'update-item': [value: { id: number; data: ItemData }]
  'open-fields-drawer': []
  'insert-item-at': [value: InsertItemAtInput]
  'duplicate-item': [value: DuplicateItemInput]
  'move-item': [value: MoveItemInput]
}>()

const toast = useToast()

const sortModel = computed({
  get: () => props.multiSortMeta,
  set: value => emit('update:multiSortMeta', (value ?? []) as MultiSortMeta[])
})

const activeCellKey = ref<string | null>(null)
const editingCellKey = ref<string | null>(null)
const editorRefs = new Map<string, unknown>()
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const contextMenuSelection = ref<TableRow | null>(null)
const contextMenuRow = ref<TableRow | null>(null)
const contextMenuRowIndex = ref<number | null>(null)

const dataTablePt = {
  root: {
    class: 'flex h-full min-h-0 flex-col border-0 bg-transparent'
  },
  tableContainer: {
    class: 'flex-1 min-h-0 overflow-auto'
  }
}

const paginatorPt = {
  root: {
    class: 'border-0 bg-transparent p-0'
  },
  paginatorContainer: {
    class: 'flex items-center gap-1'
  },
  content: {
    class: 'flex items-center gap-1'
  },
  first: {
    class:
      'h-7 w-7 rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
  },
  prev: {
    class:
      'h-7 w-7 rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
  },
  next: {
    class:
      'h-7 w-7 rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
  },
  last: {
    class:
      'h-7 w-7 rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
  },
  page: ({ context }: { context: { active: boolean } }) => ({
    class: [
      'h-7 w-7 rounded-md text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
      context.active
        ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
    ].join(' ')
  }),
  pcRowPerPageDropdown: {
    root: {
      class: 'h-7 text-xs'
    },
    label: {
      class: 'text-xs'
    },
    dropdown: {
      class: 'h-7 w-7'
    }
  }
}

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

const dataColumnWidth = computed(() => {
  const fieldCount = Math.max(props.orderedFields.length, 1)
  return `calc((100% - 108px) / ${fieldCount})`
})

const tableRows = computed(() => {
  return props.items.map(item => buildTableRow(item, props.orderedFields))
})

const contextMenuItems = computed<MenuItem[]>(() => {
  const row = contextMenuRow.value
  const rowIndex = contextMenuRowIndex.value
  const totalRows = tableRows.value.length
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
        emit('delete-item', row as Item)
      }
    }
  ]
})

watch(editingCellKey, async key => {
  if (!key) return
  await nextTick()
  focusEditor(key)
})

function getFieldKey(fieldName: string): `data.${string}` {
  return `data.${fieldName}`
}

function getCellKey(row: TableRow, field: Field) {
  return `${row.id}::${getFieldKey(field.name)}`
}

function stripFieldKey(fieldKey: string) {
  return fieldKey.startsWith('data.') ? fieldKey.slice(5) : fieldKey
}

function getRowFieldValue(row: TableRow, field: Field): TableRowValue | undefined {
  return row[getFieldKey(field.name)]
}

function buildTableRow(item: Item, fields: Field[]): TableRow {
  const row = { ...item } as TableRow
  fields.forEach(field => {
    const rawValue = item.data[field.name]
    if (field.type === 'date') {
      row[getFieldKey(field.name)] = parseDateValue(rawValue)
      return
    }
    if (field.type === 'number') {
      if (rawValue === '' || rawValue === null || rawValue === undefined) {
        row[getFieldKey(field.name)] = null
        return
      }
      const parsed = Number(rawValue)
      row[getFieldKey(field.name)] = Number.isFinite(parsed) ? parsed : null
      return
    }
    row[getFieldKey(field.name)] = rawValue ?? ''
  })
  return row
}

function toStoredValue(field: Field, value: unknown): ItemDataValue {
  if (field.type === 'date') {
    return formatDateForStorage(value as ItemDataValue | Date | null | undefined)
  }
  if (field.type === 'number') {
    if (value === null || value === undefined || value === '') return ''
    if (typeof value === 'number') return Number.isFinite(value) ? value : ''
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : ''
  }
  if (value === null || value === undefined) return ''
  return String(value)
}

function getSelectOptions(field: Field) {
  if (!field.options) return []
  return field.options
    .split(',')
    .map(option => option.trim())
    .filter(Boolean)
}

function getAbsoluteIndex(index: number) {
  return props.itemsPage * props.itemsRows + index + 1
}

function getRowClass(_row: Item) {
  return 'group transition-colors hover:bg-[var(--bg-hover)]'
}

function isActiveCell(cellKey: string) {
  return activeCellKey.value === cellKey
}

function setActiveCell(cellKey: string) {
  activeCellKey.value = cellKey
}

function onCellPreviewClick(event: MouseEvent, cellKey: string) {
  if (activeCellKey.value !== cellKey) {
    activeCellKey.value = cellKey
    event.stopPropagation()
  }
}

function activateEditor(event: Event, cellKey: string) {
  activeCellKey.value = cellKey
  const target = event.currentTarget as HTMLElement | null
  const cell = target?.closest('td')
  cell?.click()
}

function setEditorRef(cellKey: string, value: unknown) {
  if (!value) {
    editorRefs.delete(cellKey)
    return
  }
  editorRefs.set(cellKey, value)
}

function focusEditor(cellKey: string) {
  const raw = editorRefs.get(cellKey)
  const element = (raw as { $el?: HTMLElement } | undefined)?.$el ?? raw
  if (!element) return
  if (element instanceof HTMLElement) {
    if (typeof element.focus === 'function') {
      element.focus()
      return
    }
    const input = element.querySelector('input,textarea,select,button') as HTMLElement | null
    input?.focus()
  }
}

function getTextEditorValue(row: TableRow, field: Field) {
  const value = row[getFieldKey(field.name)]
  if (value === null || value === undefined) return ''
  return String(value)
}

function setTextEditorValue(row: TableRow, field: Field, value: string | null | undefined) {
  row[getFieldKey(field.name)] = value ?? ''
}

function getSelectEditorValue(row: TableRow, field: Field) {
  const value = row[getFieldKey(field.name)]
  if (value === null || value === undefined) return ''
  return String(value)
}

function setSelectEditorValue(row: TableRow, field: Field, value: string | null | undefined) {
  row[getFieldKey(field.name)] = value ?? ''
}

function getNumberEditorValue(row: TableRow, field: Field) {
  const value = row[getFieldKey(field.name)]
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function setNumberEditorValue(row: TableRow, field: Field, value: number | null | undefined) {
  row[getFieldKey(field.name)] = value ?? null
}

function getDateEditorValue(row: TableRow, field: Field) {
  const value = row[getFieldKey(field.name)]
  if (value instanceof Date) return value
  return parseDateValue(value as ItemDataValue)
}

function setDateEditorValue(row: TableRow, field: Field, value: unknown) {
  row[getFieldKey(field.name)] = value instanceof Date ? value : null
}

function formatFieldValue(value: TableRowValue | undefined, type: FieldType) {
  if (value === null || value === undefined || value === '') return '-'
  if (type === 'date') {
    return formatDateForDisplay(value)
  }
  return value
}

function onPage(event: unknown) {
  emit('page', event as TablePageEventLike)
}

function onSort(event: unknown) {
  emit('sort', event as TableSortEventLike)
}

function onCellEditInit(event: CellEditInitEvent) {
  const cellKey = `${event.data.id}::${event.field}`
  activeCellKey.value = cellKey
  editingCellKey.value = cellKey
}

function onCellEditComplete(event: CellEditCompleteEvent) {
  const fieldName = stripFieldKey(event.field)
  const field = props.orderedFields.find(item => item.name === fieldName)
  activeCellKey.value = null
  editingCellKey.value = null

  if (!field) return

  const nextValue = toStoredValue(field, event.newValue)
  const prevValue = toStoredValue(field, event.value)

  if (nextValue === prevValue) {
    return
  }

  const nextData = {
    ...event.data.data,
    [fieldName]: nextValue
  }

  emit('update-item', { id: event.data.id, data: nextData })
}

function onCellEditCancel() {
  activeCellKey.value = null
  editingCellKey.value = null
}

function onRowContextMenu(event: RowContextMenuEvent) {
  contextMenuSelection.value = event.data
  contextMenuRow.value = event.data
  contextMenuRowIndex.value = event.index
  contextMenuRef.value?.show(event.originalEvent)
}

function notifyRowDetail() {
  toast.add({
    severity: 'info',
    summary: 'Row detail coming soon',
    life: 2000
  })
}

function notifyAddField() {
  emit('open-fields-drawer')
}
</script>
