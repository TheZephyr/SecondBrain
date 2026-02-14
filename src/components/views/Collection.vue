<template>
  <div class="mx-auto max-w-6xl px-10 py-8">
    <Toolbar class="mb-6">
      <template #start>
        <div class="flex items-center gap-4">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent-primary)]">
            <component :is="getIcon(collection.icon)" :size="26" />
          </div>
          <div>
            <h2 class="text-2xl font-semibold text-[var(--text-primary)]">
              {{ collection.name }}
            </h2>
          </div>
        </div>
      </template>
      <template #end>
        <div class="flex items-center gap-2">
          <Button text title="Manage Fields" @click="showFieldsManager = true">
            <Settings />
            Manage fields
          </Button>
          <Button @click="showAddItemForm = true">
            <Plus />
            Add Item
          </Button>
          <Button text title="Collection Settings" @click="showCollectionSettings = true">
            <MoreVertical />
            More
          </Button>
        </div>
      </template>
    </Toolbar>

    <div v-if="safeFields.length === 0"
      class="flex flex-col items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-10 py-16 text-center">
      <Columns :size="64" :stroke-width="1.5" class="mb-5 text-[var(--text-muted)]" />
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">No Fields Yet</h3>
      <p class="mt-2 text-sm text-[var(--text-muted)]">
        Define the structure of your collection by adding fields
      </p>
      <Button class="mt-6 gap-2 min-w-[140px] px-4 !text-white" @click="showFieldsManager = true">
        <Plus />
        Add Fields
      </Button>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <InputText v-model="searchQuery" class="pl-10" type="text" placeholder="Search..." />
        </div>
        <p class="text-xs text-[var(--text-muted)]">
          Tip: hold Shift/Ctrl while clicking headers to add multiple sorts.
        </p>
      </div>

      <DataTable :value="items" dataKey="id" stripedRows sortMode="multiple" removableSort
        v-model:multiSortMeta="multiSortMeta" :rowHover="true" lazy paginator :rows="itemsRows"
        :first="itemsPage * itemsRows" :totalRecords="itemsTotal" :rowsPerPageOptions="[25, 50, 100]"
        :loading="itemsLoading" @page="onItemsPage" @sort="onItemsSort" tableStyle="table-layout: fixed; width: 100%">
        <Column v-for="field in orderedFields" :key="field.id" :field="getFieldPath(field.name)" :header="field.name"
          sortable :style="{ width: `${100 / (orderedFields.length + 1)}%` }">
          <template #body="{ data }">
            <span class="block max-w-[320px] truncate">
              {{ formatFieldValue(data.data[field.name], field.type) }}
            </span>
          </template>
        </Column>

        <Column header=" " style="width: 60px; text-align: right">
          <template #body="{ data }">
            <div class="flex items-center justify-end gap-2">
              <Button text class="h-8 w-8 p-0" title="Edit" @click="editItem(data)">
                <Pencil />
              </Button>
              <Button text class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[rgba(239,68,68,0.12)]" title="Delete"
                @click="deleteItem(data)">
                <Trash2 />
              </Button>
            </div>
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
    </div>

    <div v-if="itemsTotal > 0" class="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <Database :size="14" />
      <span>{{ itemsTotal }} total - {{ items.length }} on page</span>
    </div>

    <Dialog v-model:visible="showAddItemForm" :header="editingItem ? 'Edit Item' : 'Add New Item'" modal
      :draggable="false" class="max-w-2xl" @hide="cancelItemForm">
      <form @submit.prevent="saveItem">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div v-for="field in orderedFields" :key="field.id" :class="field.type === 'textarea' ? 'md:col-span-2' : ''">
            <FloatLabel class="w-full" variant="in">
              <InputText v-if="field.type === 'text'" :id="getFieldInputId(field)"
                :modelValue="getTextValue(field.name)" @update:modelValue="value => setTextValue(field.name, value)"
                type="text" class="w-full" />
              <Textarea v-else-if="field.type === 'textarea'" :id="getFieldInputId(field)"
                :modelValue="getTextValue(field.name)" @update:modelValue="value => setTextValue(field.name, value)"
                rows="3" class="w-full" />
              <InputNumber v-else-if="field.type === 'number'" :inputId="getFieldInputId(field)"
                :modelValue="getNumberValue(field.name)" @update:modelValue="value => setNumberValue(field.name, value)"
                inputClass="w-full" class="w-full" />
              <DatePicker v-else-if="field.type === 'date'" :inputId="getFieldInputId(field)"
                :modelValue="getDateValue(field.name)" @update:modelValue="value => setDateValue(field.name, value)"
                dateFormat="yy-mm-dd" inputClass="w-full" class="w-full" />
              <Select v-else-if="field.type === 'select'" :inputId="getFieldInputId(field)"
                :modelValue="getSelectValue(field.name)" @update:modelValue="value => setSelectValue(field.name, value)"
                :options="getSelectOptions(field)" class="w-full" />
              <label :for="getFieldInputId(field)">{{ field.name }}</label>
            </FloatLabel>
          </div>
        </div>
      </form>
      <template #footer>
        <Button severity="secondary" text @click="cancelItemForm">Cancel</Button>
        <Button @click="saveItem">{{ editingItem ? 'Update' : 'Add' }}</Button>
      </template>
    </Dialog>

    <Dialog v-model:visible="showFieldsManager" header="Manage Fields" modal :draggable="false" class="max-w-4xl">
      <div class="space-y-6">
        <DataTable :value="orderedFields" dataKey="id" reorderableRows @row-reorder="onFieldsReorder">
          <Column rowReorder headerStyle="width: 3rem" />
          <Column field="name" header="Field" />
          <Column header="Type">
            <template #body="{ data }">
              <Tag class="uppercase">{{ data.type }}</Tag>
            </template>
          </Column>
          <Column header="Actions" style="width: 120px">
            <template #body="{ data }">
              <Button text class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[rgba(239,68,68,0.12)]" title="Delete field"
                @click="deleteField(data)">
                <Trash2 />
              </Button>
            </template>
          </Column>
        </DataTable>

        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
          <div
            class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            <Plus :size="14" />
            Add New Field
          </div>
          <div class="flex flex-col gap-3 md:flex-row md:items-center">
            <InputText v-model="newField.name" type="text" placeholder="Field name" class="flex-1" />
            <Select v-model="newField.type" :options="fieldTypeOptions" optionLabel="label" optionValue="value"
              class="w-full md:w-48" />
            <Button class="md:self-stretch" @click="addField">Add</Button>
          </div>
          <div v-if="newField.type === 'select'" class="mt-3">
            <InputText v-model="newField.options" type="text"
              placeholder="Options (comma-separated: Option1, Option2)" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button @click="showFieldsManager = false">Done</Button>
      </template>
    </Dialog>

    <Dialog v-model:visible="showCollectionSettings" header="Collection Settings" modal :draggable="false"
      class="w-full max-w-4xl" @hide="cancelSettings">
      <Accordion value="0">
        <AccordionPanel value="0">
          <AccordionHeader>
            <div class="flex items-center gap-2">
              <Settings2 :size="16" />
              <span>Collection Settings</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-xs font-medium text-[var(--text-secondary)]">Collection Name </label>
                <InputText v-model="collectionName" type="text" placeholder="Collection name" />
              </div>

              <div class="space-y-2">
                <label class="text-xs font-medium text-[var(--text-secondary)]">Icon</label>
                <Listbox v-model="collectionIcon" :options="iconOptions" optionLabel="label" optionValue="value"
                  :pt="iconListboxPt" class="w-full">
                  <template #option="{ option }">
                    <div class="flex flex-col items-center gap-1">
                      <component :is="option.component" :size="20" />
                    </div>
                  </template>
                </Listbox>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="1">
          <AccordionHeader>
            <div class="flex items-center gap-2">
              <Upload :size="16" />
              <span>Export Data</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-xs font-medium text-[var(--text-secondary)]">Export Format</label>
                <Select v-model="exportFormat" :options="exportFormatOptions" optionLabel="label" optionValue="value" />
              </div>
              <div
                class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-xs text-[var(--text-secondary)]">
                <p v-if="exportFormat === 'csv'">
                  Export all items as a CSV file. All values will be enclosed in quotes for compatibility.
                </p>
                <p v-else>
                  Export all items as a JSON file. Data will be exported as an array of objects with full type
                  preservation.
                </p>
              </div>
              <Button class="w-full justify-center gap-2" :disabled="isExporting" @click="handleExport">
                <Download v-if="!isExporting" />
                <span v-if="isExporting">Exporting...</span>
                <span v-else>Export {{ itemsTotal }} {{ itemsTotal === 1 ? 'item' : 'items' }}</span>
              </Button>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="2">
          <AccordionHeader>
            <div class="flex items-center gap-2">
              <Download :size="16" />
              <span>Import Data</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="space-y-4">
              <div v-if="!importPreview" class="space-y-4">
                <div class="space-y-2">
                  <label class="text-xs font-medium text-[var(--text-secondary)]">Import Format</label>
                  <Select v-model="importFormat" :options="exportFormatOptions" optionLabel="label"
                    optionValue="value" />
                </div>

                <div class="space-y-2">
                  <label class="text-xs font-medium text-[var(--text-secondary)]">Import Mode</label>
                  <div class="flex gap-2">
                    <label
                      class="flex flex-1 items-start gap-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)]">
                      <RadioButton v-model="importMode" value="append" />
                      <div>
                        <div class="font-medium text-[var(--text-primary)]">Append</div>
                        <div class="text-xs text-[var(--text-muted)]">Add imported items to existing data</div>
                      </div>
                    </label>
                    <label
                      class="flex flex-1 items-start gap-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)]">
                      <RadioButton v-model="importMode" value="replace" />
                      <div>
                        <div class="font-medium text-[var(--text-primary)]">Replace</div>
                        <div class="text-xs text-[var(--text-muted)]">Delete all existing items and import new data
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <Button class="w-full justify-center gap-2" @click="handleSelectFile">
                  <Download />
                  Select File to Import
                </Button>
              </div>

              <div v-else class="space-y-4">
                <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                  <div class="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                    <FileText :size="18" />
                    Import Preview
                  </div>
                  <Button text class="h-8 w-8 p-0" title="Cancel" @click="cancelImport">
                    <X />
                  </Button>
                </div>

                <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-xs">
                  <div class="flex justify-between text-[var(--text-secondary)]">
                    <span>Items to import:</span>
                    <span class="font-semibold text-[var(--text-primary)]">{{ importPreview.itemCount }}</span>
                  </div>
                  <div class="mt-2 flex justify-between text-[var(--text-secondary)]">
                    <span>Import mode:</span>
                    <span class="font-semibold text-[var(--text-primary)]">{{ importMode === 'append' ? 'Append' :
                      'Replace'
                    }}</span>
                  </div>
                </div>

                <div v-if="safeFields.length === 0"
                  class="flex items-start gap-2 rounded-md border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.12)] p-3 text-xs text-[var(--text-secondary)]">
                  <AlertTriangle :size="16" />
                  This collection has no fields. Fields will be automatically created from the import file.
                </div>

                <div v-if="importPreview.matchedFields.length > 0" class="space-y-2">
                  <div class="text-xs font-semibold text-[var(--text-primary)]">
                    Matched Fields ({{ importPreview.matchedFields.length }})
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Tag v-for="field in importPreview.matchedFields" :key="field"
                      class="bg-[rgba(16,185,129,0.2)] text-[var(--success)]">
                      {{ field }}
                    </Tag>
                  </div>
                </div>

                <div v-if="importPreview.newFields.length > 0" class="space-y-2">
                  <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <AlertTriangle :size="14" />
                    New Fields ({{ importPreview.newFields.length }})
                  </div>
                  <p class="text-xs text-[var(--text-muted)]">These fields will be added to your collection:</p>
                  <div class="flex flex-wrap gap-2">
                    <Tag v-for="field in importPreview.newFields" :key="field"
                      class="bg-[rgba(245,158,11,0.2)] text-[var(--warning)]">
                      {{ field }}
                    </Tag>
                  </div>
                </div>

                <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-xs">
                  <div class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Sample Data (first 3 items)
                  </div>
                  <div class="flex gap-2">
                    <div v-for="(item, index) in importPreview.sample" :key="index"
                      class="flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] p-2">
                      <div class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Item {{ index + 1 }}
                      </div>
                      <div class="space-y-1">
                        <div v-for="(value, key) in item" :key="key" class="flex gap-2">
                          <span class="min-w-[80px] text-[var(--text-muted)]">{{ key }}:</span>
                          <span class="text-[var(--text-primary)]">{{ value || '(empty)' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 border-t border-[var(--border-color)] pt-4">
                  <Button severity="secondary" text @click="cancelImport">Cancel</Button>
                  <Button class="gap-2" :disabled="isImporting" @click="handleImport">
                    <Upload v-if="!isImporting" :size="16" />
                    <span v-if="isImporting">Importing...</span>
                    <span v-else>Import {{ importPreview.itemCount }} items</span>
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionPanel>

        <AccordionPanel value="3">
          <AccordionHeader>
            <div class="flex items-center gap-2">
              <AlertTriangle :size="16" />
              <span>Danger Zone</span>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div class="space-y-3">
              <p class="text-xs text-[var(--text-muted)]">
                Once you delete a collection, there is no going back.
              </p>
              <Button severity="danger" class="gap-2 min-w-[180px]" @click="confirmDeleteCollection">
                <Trash2 />
                Delete Collection
              </Button>
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>

      <template #footer>
        <Button severity="secondary" text @click="cancelSettings">Cancel</Button>
        <Button @click="saveSettings">Save Changes</Button>
      </template>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, toRef } from 'vue'
import { refDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useStore } from '../../store'
import { useNotificationsStore } from '../../stores/notifications'
import {
  Settings,
  Plus,
  MoreVertical,
  Columns,
  Search,
  Pencil,
  Trash2,
  X,
  FileText,
  Database,
  AlertTriangle,
  Download,
  Settings2,
  Upload
} from 'lucide-vue-next'
import { useIcons } from '../../composables/useIcons'
import { useCollectionImportExport } from '../../composables/useCollectionImportExport'
import { useConfirm } from 'primevue/useconfirm'
import Accordion from 'primevue/accordion'
import AccordionContent from 'primevue/accordioncontent'
import AccordionHeader from 'primevue/accordionheader'
import AccordionPanel from 'primevue/accordionpanel'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import DataTable from 'primevue/datatable'
import type { DataTablePageEvent, DataTableSortEvent } from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Listbox from 'primevue/listbox'
import RadioButton from 'primevue/radiobutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import Toolbar from 'primevue/toolbar'
import Column from 'primevue/column'
import { isSafeFieldName } from '../../validation/fieldNames'
import {
  fieldNameSchema,
  collectionNameSchema,
  iconSchema
} from '../../validation/schemas'
import {
  parseDateValue,
  formatDateForStorage,
  formatDateForDisplay
} from '../../utils/date'
import type {
  Collection,
  Field,
  Item,
  ItemSortSpec,
  FieldType,
  ItemData,
  ItemDataValue,
} from '../../types/models'

const { getIcon, iconOptions } = useIcons()
const store = useStore()
const { fields, items, itemsTotal, itemsLoading, itemsPage, itemsRows } = storeToRefs(store)
const confirm = useConfirm()
const notifications = useNotificationsStore()

const props = defineProps<{
  collection: Collection
}>()

const emit = defineEmits(['collection-deleted'])

const searchQuery = ref('')
const debouncedSearchQuery = refDebounced(searchQuery, 200)
const showAddItemForm = ref(false)
const showFieldsManager = ref(false)
const showCollectionSettings = ref(false)
const editingItem = ref<Item | null>(null)
const formData = ref<FormData>(Object.create(null) as FormData)
const newField = ref<{ name: string; type: FieldType; options: string }>({
  name: '',
  type: 'text',
  options: ''
})
const collectionName = ref('')
const collectionIcon = ref('')
const warnedUnsafeFields = new Set<number>()

type FormValue = ItemDataValue | Date
type FormData = Record<string, FormValue>
type RowReorderEvent = { value: Field[] }
type LoadItemsOptions = {
  page?: number
  rows?: number
  search?: string
  sort?: ItemSortSpec[]
}
type RawSortMeta = { field?: string; order?: 1 | -1 | 0 | null }
type MultiSortMeta = { field: string; order: 1 | -1 }

function createEmptyFormData(): FormData {
  return Object.create(null) as FormData
}

const multiSortMeta = ref<MultiSortMeta[]>([])


const fieldTypeOptions: Array<{ label: string; value: FieldType }> = [
  { label: 'Text', value: 'text' },
  { label: 'Text Area', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Select', value: 'select' }
]

const {
  exportFormat,
  exportFormatOptions,
  isExporting,
  handleExport,
  importFormat,
  importMode,
  isImporting,
  importPreview,
  handleSelectFile,
  handleImport,
  cancelImport
} = useCollectionImportExport({
  collection: toRef(props, 'collection'),
  fields
})


const iconListboxPt = {
  root: {
    class:
      'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)]'
  },
  list: {
    class: 'grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] justify-items-center gap-1 p-2'
  },
  item: ({ context }: { context: { selected: boolean } }) => ({
    class: [
      'flex w-full flex-col items-center justify-center gap-1 rounded-md border p-1.5 text-[11px] transition',
      context.selected
        ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
        : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]'
    ].join(' ')
  })
}

const safeFields = computed(() => {
  return fields.value.filter(field => isSafeFieldName(field.name))
})

const orderedFields = computed(() => {
  return [...safeFields.value].sort((a, b) => a.order_index - b.order_index)
})

function getFieldPath(fieldName: string) {
  return `data.${fieldName}`
}

function getFieldInputId(field: Field) {
  return `field-input-${field.id}`
}

function normalizeSortMeta(meta: RawSortMeta[]): MultiSortMeta[] {
  return meta
    .filter(item => {
      if (!item.field) return false
      if (item.order !== 1 && item.order !== -1) return false
      const fieldName = item.field.startsWith('data.') ? item.field.slice(5) : item.field
      return safeFields.value.some(f => f.name === fieldName)
    })
    .map(item => ({
      field: item.field as string,
      order: item.order as 1 | -1
    }))
}

function areSortMetaEqual(a: MultiSortMeta[], b: MultiSortMeta[]): boolean {
  if (a.length !== b.length) return false
  return a.every((entry, index) => entry.field === b[index]?.field && entry.order === b[index]?.order)
}

function toItemSort(meta: MultiSortMeta[]): ItemSortSpec[] {
  return meta.map(entry => ({ field: entry.field, order: entry.order }))
}

async function loadCollectionItems(options: LoadItemsOptions = {}) {
  await store.loadItems(props.collection.id, options)
}

async function onItemsPage(event: DataTablePageEvent) {
  const rows = event.rows || itemsRows.value
  const page = rows > 0 ? Math.floor(event.first / rows) : 0
  await loadCollectionItems({ page, rows })
}

async function onItemsSort(event: DataTableSortEvent) {
  const nextMeta = normalizeSortMeta((event.multiSortMeta || []) as RawSortMeta[])
  multiSortMeta.value = nextMeta
  await loadCollectionItems({
    page: 0,
    sort: toItemSort(nextMeta)
  })
}

function getSortStorageKey(collectionId: number): string {
  return `multi_sort_${collectionId}`
}

function saveSortPreferences() {
  if (!props.collection) return
  localStorage.setItem(getSortStorageKey(props.collection.id), JSON.stringify(multiSortMeta.value))
}

function loadSortPreferences() {
  if (!props.collection) {
    multiSortMeta.value = []
    return
  }

  const saved = localStorage.getItem(getSortStorageKey(props.collection.id))
  if (!saved) {
    multiSortMeta.value = []
    return
  }

  try {
    const parsed = JSON.parse(saved) as RawSortMeta[]
    multiSortMeta.value = normalizeSortMeta(parsed)
  } catch {
    multiSortMeta.value = []
  }
}

watch(multiSortMeta, () => saveSortPreferences(), { deep: true })

watch(debouncedSearchQuery, async (query) => {
  await loadCollectionItems({
    page: 0,
    search: query
  })
})

watch(
  () => fields.value,
  (nextFields) => {
    const unsafeFields = nextFields.filter(field => !isSafeFieldName(field.name))
    if (unsafeFields.length === 0) return

    for (const field of unsafeFields) {
      if (warnedUnsafeFields.has(field.id)) continue
      warnedUnsafeFields.add(field.id)
      notifications.push({
        severity: 'warn',
        summary: 'Unsafe field hidden',
        detail: `Field "${field.name}" is not supported and has been hidden.`,
        life: 7000
      })
    }
  },
  { immediate: true }
)

async function addField() {
  const nameResult = fieldNameSchema.safeParse(newField.value.name)
  if (!nameResult.success) {
    notifications.push({
      severity: 'warn',
      summary: 'Invalid field name',
      detail: nameResult.error.issues[0]?.message || 'Please enter a valid field name.',
      life: 5000
    })
    return
  }

  const nextOrderIndex = fields.value.reduce(
    (maxOrder, field) => Math.max(maxOrder, field.order_index),
    -1
  ) + 1

  await store.addField({
    collectionId: props.collection.id,
    name: nameResult.data,
    type: newField.value.type,
    options: newField.value.type === 'select' ? newField.value.options : null,
    orderIndex: nextOrderIndex
  })

  newField.value = { name: '', type: 'text', options: '' }
}

async function deleteField(field: Field) {
  confirm.require({
    header: 'Delete Field',
    message: `Delete "${field.name}" field? All data in this field will be lost.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: async () => {
      await store.deleteField(field.id)
    }
  })
}

function getSelectOptions(field: Field) {
  if (!field.options) return []
  return field.options.split(',').map((opt: string) => opt.trim())
}

function getTextValue(fieldName: string): string | null {
  const value = formData.value[fieldName]
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return String(value)
}

function setTextValue(fieldName: string, value: string | null | undefined) {
  formData.value[fieldName] = value ?? ''
}

function getSelectValue(fieldName: string): string | null {
  const value = formData.value[fieldName]
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

function setSelectValue(fieldName: string, value: string | null | undefined) {
  formData.value[fieldName] = value ?? ''
}

function getNumberValue(fieldName: string): number | null {
  const value = formData.value[fieldName]
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function setNumberValue(fieldName: string, value: number | null | undefined) {
  formData.value[fieldName] = value ?? ''
}

type DateModelValue = Date | Array<Date> | Array<Date | null> | null | undefined

function getDateValue(fieldName: string): Date | null {
  const value = formData.value[fieldName]
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value
  return parseDateValue(value)
}

function setDateValue(fieldName: string, value: DateModelValue) {
  if (value instanceof Date) {
    formData.value[fieldName] = value
    return
  }
  formData.value[fieldName] = null
}

function resetFormData() {
  const data = createEmptyFormData()
  safeFields.value.forEach(field => {
    data[field.name] = field.type === 'date' ? null : ''
  })
  formData.value = data
}

function cancelItemForm() {
  showAddItemForm.value = false
  editingItem.value = null
  resetFormData()
}

async function saveItem() {
  const plainData = Object.create(null) as ItemData
  safeFields.value.forEach(field => {
    if (field.type === 'date') {
      plainData[field.name] = formatDateForStorage(formData.value[field.name])
      return
    }

    const value = formData.value[field.name]
    plainData[field.name] =
      value === null || value === undefined ? '' : (value as ItemDataValue)
  })

  if (editingItem.value) {
    await store.updateItem({
      id: editingItem.value.id,
      data: plainData as ItemData
    })
  } else {
    await store.addItem({
      collectionId: props.collection.id,
      data: plainData as ItemData
    })
  }

  cancelItemForm()
}

function editItem(item: Item) {
  editingItem.value = item
  const data = createEmptyFormData()
  safeFields.value.forEach(field => {
    const currentValue = item.data[field.name]
    if (field.type === 'date') {
      data[field.name] = parseDateValue(currentValue)
    } else if (field.type === 'number' && currentValue !== '' && currentValue !== null && currentValue !== undefined) {
      data[field.name] = Number(currentValue)
    } else {
      data[field.name] = currentValue ?? ''
    }
  })
  formData.value = data
  showAddItemForm.value = true
}

async function deleteItem(item: Item) {
  confirm.require({
    header: 'Delete Item',
    message: 'Are you sure you want to delete this item? This action cannot be undone.',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: async () => {
      await store.deleteItem(item)
    }
  })
}

function formatFieldValue(value: ItemDataValue | undefined, type: FieldType) {
  if (value === null || value === undefined || value === '') return '-'
  if (type === 'date') {
    return formatDateForDisplay(value)
  }
  return value
}

function cancelSettings() {
  showCollectionSettings.value = false
  collectionName.value = props.collection.name
  collectionIcon.value = props.collection.icon
}

async function saveSettings() {
  const nameResult = collectionNameSchema.safeParse(collectionName.value)
  const iconResult = iconSchema.safeParse(collectionIcon.value)

  if (!nameResult.success || !iconResult.success) {
    let detail = 'Please check your collection settings.'
    if (!nameResult.success) {
      detail = nameResult.error.issues[0]?.message || detail
    } else if (!iconResult.success) {
      detail = iconResult.error.issues[0]?.message || detail
    }

    notifications.push({
      severity: 'warn',
      summary: 'Invalid collection settings',
      detail,
      life: 5000
    })
    return
  }

  await store.updateCollection({
    id: props.collection.id,
    name: nameResult.data,
    icon: iconResult.data
  })

  showCollectionSettings.value = false
}

async function confirmDeleteCollection() {
  confirm.require({
    header: 'Delete Collection',
    message: `Delete "${props.collection.name}" and all its data? This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete Collection',
    rejectLabel: 'Cancel',
    accept: async () => {
      await store.deleteCollection(props.collection.id)
      emit('collection-deleted')
    }
  })
}

async function onFieldsReorder(event: RowReorderEvent) {
  const reorderedFields = event.value
  if (!reorderedFields) return

  await store.reorderFields({
    collectionId: props.collection.id,
    fieldOrders: reorderedFields.map((field, index) => ({
      id: field.id,
      orderIndex: index
    }))
  })
}

watch(
  () => props.collection,
  (newCollection) => {
    if (newCollection) {
      store.selectCollection(newCollection)
      searchQuery.value = ''
      collectionName.value = newCollection.name
      collectionIcon.value = newCollection.icon
      setTimeout(() => {
        loadSortPreferences()
        void loadCollectionItems({
          page: 0,
          search: '',
          sort: toItemSort(multiSortMeta.value)
        })
      }, 100)
    }
  },
  { immediate: true }
)

watch(
  () => fields.value,
  () => {
    if (props.collection) {
      const normalized = normalizeSortMeta(multiSortMeta.value)
      if (!areSortMetaEqual(multiSortMeta.value, normalized)) {
        multiSortMeta.value = normalized
        void loadCollectionItems({
          page: 0,
          sort: toItemSort(normalized)
        })
      }
      saveSortPreferences()
    }
  }
)

onMounted(() => {
  resetFormData()
  if (props.collection) {
    collectionName.value = props.collection.name
    collectionIcon.value = props.collection.icon
  }
})
</script>
