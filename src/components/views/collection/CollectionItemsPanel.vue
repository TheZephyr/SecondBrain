<template>
  <div v-if="orderedFields.length === 0"
    class="flex flex-col items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-10 py-16 text-center">
    <Columns :size="64" :stroke-width="1.5" class="mb-5 text-[var(--text-muted)]" />
    <h3 class="text-lg font-semibold text-[var(--text-primary)]">No Fields Yet</h3>
    <p class="mt-2 text-sm text-[var(--text-muted)]">
      Define the structure of your collection by adding fields
    </p>
    <Button class="mt-6 gap-2 min-w-[140px] px-4 !text-white" @click="$emit('manage-fields')">
      <Plus />
      Add Fields
    </Button>
  </div>

  <div v-else class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <InputText v-model="searchModel" class="pl-10" type="text" placeholder="Search..." />
      </div>
      <p class="text-xs text-[var(--text-muted)]">
        Tip: hold Shift/Ctrl while clicking headers to add multiple sorts.
      </p>
    </div>

    <DataTable :value="items" dataKey="id" stripedRows sortMode="multiple" removableSort v-model:multiSortMeta="sortModel"
      :rowHover="true" lazy paginator :rows="itemsRows" :first="itemsPage * itemsRows" :totalRecords="itemsTotal"
      :rowsPerPageOptions="[25, 50, 100]" :loading="itemsLoading" @page="onPage" @sort="onSort"
      tableStyle="table-layout: fixed; width: 100%">
      <Column v-for="field in orderedFields" :key="field.id" :field="getFieldPath(field.name)" :header="field.name" sortable
        :style="{ width: `${100 / (orderedFields.length + 1)}%` }">
        <template #body="{ data }">
          <span class="block max-w-[320px] truncate">
            {{ formatFieldValue(data.data[field.name], field.type) }}
          </span>
        </template>
      </Column>

      <Column header=" " style="width: 60px; text-align: right">
        <template #body="{ data }">
          <div class="flex items-center justify-end gap-2">
            <Button text class="h-8 w-8 p-0" title="Edit" @click="$emit('edit-item', data)">
              <Pencil />
            </Button>
            <Button text class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[rgba(239,68,68,0.12)]" title="Delete"
              @click="$emit('delete-item', data)">
              <Trash2 />
            </Button>
          </div>
        </template>
      </Column>

      <template #empty>
        <div class="flex flex-col items-center gap-3 py-10 text-[var(--text-muted)]">
          <component :is="itemsTotal === 0 && !debouncedSearchQuery ? FileText : Search" :size="40" :stroke-width="1.5" />
          <p class="text-sm">
            {{ itemsTotal === 0 && !debouncedSearchQuery ?
              "No items yet. Click \"Add Item\" to get started!" :
              "No items match your search."
            }}
          </p>
        </div>
      </template>
    </DataTable>
  </div>

  <div v-if="itemsTotal > 0" class="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
    <Database :size="14" />
    <span>{{ itemsTotal }} total - {{ items.length }} on page</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Columns,
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Database
} from 'lucide-vue-next'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Column from 'primevue/column'
import { formatDateForDisplay } from '../../../utils/date'
import type { Field, FieldType, Item, ItemDataValue } from '../../../types/models'
import type {
  MultiSortMeta,
  TablePageEventLike,
  TableSortEventLike
} from './types'

const props = defineProps<{
  items: Item[]
  itemsTotal: number
  itemsLoading: boolean
  itemsPage: number
  itemsRows: number
  orderedFields: Field[]
  searchQuery: string
  debouncedSearchQuery: string
  multiSortMeta: MultiSortMeta[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:multiSortMeta': [value: MultiSortMeta[]]
  page: [value: TablePageEventLike]
  sort: [value: TableSortEventLike]
  'manage-fields': []
  'edit-item': [value: Item]
  'delete-item': [value: Item]
}>()

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

const sortModel = computed({
  get: () => props.multiSortMeta,
  set: value => emit('update:multiSortMeta', (value ?? []) as MultiSortMeta[])
})

function getFieldPath(fieldName: string) {
  return `data.${fieldName}`
}

function formatFieldValue(value: ItemDataValue | undefined, type: FieldType) {
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
</script>
