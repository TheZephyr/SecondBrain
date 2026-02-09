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

    <div v-if="fields.length === 0"
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

      <DataTable :value="filteredItems" dataKey="id" stripedRows sortMode="multiple" removableSort
        v-model:multiSortMeta="multiSortMeta" :rowHover="true" tableStyle="table-layout: fixed; width: 100%">
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
            <component :is="items.length === 0 ? FileText : Search" :size="40" :stroke-width="1.5" />
            <p class="text-sm">
              {{ items.length === 0 ? "No items yet. Click \"Add Item\" to get started!" : "No items match your search."
              }}
            </p>
          </div>
        </template>
      </DataTable>
    </div>

    <div v-if="items.length > 0" class="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <Database :size="14" />
      <span>{{ items.length }} total - {{ filteredItems.length }} showing</span>
    </div>

    <Dialog v-model:visible="showAddItemForm" :header="editingItem ? 'Edit Item' : 'Add New Item'" modal
      :draggable="false" class="max-w-2xl" @hide="cancelItemForm">
      <form @submit.prevent="saveItem">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div v-for="field in orderedFields" :key="field.id" :class="field.type === 'textarea' ? 'md:col-span-2' : ''">
            <FloatLabel class="w-full" variant="in">
              <InputText v-if="field.type === 'text'" :id="getFieldInputId(field)" v-model="formData[field.name]"
                type="text" class="w-full" />
              <Textarea v-else-if="field.type === 'textarea'" :id="getFieldInputId(field)"
                v-model="formData[field.name]" rows="3" class="w-full" />
              <InputNumber v-else-if="field.type === 'number'" :inputId="getFieldInputId(field)"
                v-model="formData[field.name]" inputClass="w-full" class="w-full" />
              <DatePicker v-else-if="field.type === 'date'" :inputId="getFieldInputId(field)"
                v-model="formData[field.name]" dateFormat="yy-mm-dd" inputClass="w-full" class="w-full" />
              <Select v-else-if="field.type === 'select'" :inputId="getFieldInputId(field)"
                v-model="formData[field.name]" :options="getSelectOptions(field)" class="w-full" />
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
                <span v-else>Export {{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}</span>
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

                <div v-if="fields.length === 0"
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
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from '../../store'
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
import { useConfirm } from 'primevue/useconfirm'
import Accordion from 'primevue/accordion'
import AccordionContent from 'primevue/accordioncontent'
import AccordionHeader from 'primevue/accordionheader'
import AccordionPanel from 'primevue/accordionpanel'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import DataTable from 'primevue/datatable'
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
import type {
  Collection,
  Field,
  Item,
  FieldType,
  ItemData,
  ItemDataValue,
  ExportFormat,
  ImportMode
} from '../../types/models'

const { getIcon, iconOptions } = useIcons()
const store = useStore()
const { fields, items } = storeToRefs(store)
const confirm = useConfirm()

const props = defineProps<{
  collection: Collection
}>()

const emit = defineEmits(['collection-deleted'])

const searchQuery = ref('')
const showAddItemForm = ref(false)
const showFieldsManager = ref(false)
const showCollectionSettings = ref(false)
const editingItem = ref<Item | null>(null)
const formData = ref<FormData>({})
const newField = ref<{ name: string; type: FieldType; options: string }>({
  name: '',
  type: 'text',
  options: ''
})
const collectionName = ref('')
const collectionIcon = ref('')

type FormValue = ItemDataValue | Date
type FormData = Record<string, FormValue>
type ImportRow = Record<string, ItemDataValue | undefined>
type ImportPreview = {
  itemCount: number
  fields: string[]
  newFields: string[]
  matchedFields: string[]
  sample: ImportRow[]
}
type RowReorderEvent = { value: Field[] }

type MultiSortMeta = { field: string; order: 1 | -1 }
const multiSortMeta = ref<MultiSortMeta[]>([])

// Export state
const exportFormat = ref<ExportFormat>('csv')
const isExporting = ref(false)

// Import state
const importFormat = ref<ExportFormat>('csv')
const importMode = ref<ImportMode>('append')
const isImporting = ref(false)
const selectedFile = ref<string | null>(null)
const importPreview = ref<ImportPreview | null>(null)

const fieldTypeOptions: Array<{ label: string; value: FieldType }> = [
  { label: 'Text', value: 'text' },
  { label: 'Text Area', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Select', value: 'select' }
]

const exportFormatOptions = [
  { label: 'CSV', value: 'csv' },
  { label: 'JSON', value: 'json' }
]

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

const orderedFields = computed(() => {
  return [...fields.value].sort((a, b) => a.order_index - b.order_index)
})

const filteredItems = computed(() => {
  let result = items.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item => {
      return Object.values(item.data).some(value =>
        String(value).toLowerCase().includes(query)
      )
    })
  }

  return result
})

function getFieldPath(fieldName: string) {
  return `data.${fieldName}`
}

function getFieldInputId(field: Field) {
  return `field-input-${field.id}`
}

function normalizeSortMeta(meta: MultiSortMeta[]): MultiSortMeta[] {
  return meta.filter(item => {
    if (!item.field) return false
    const fieldName = item.field.startsWith('data.') ? item.field.slice(5) : item.field
    return fields.value.some(f => f.name === fieldName)
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
    const parsed = JSON.parse(saved) as MultiSortMeta[]
    multiSortMeta.value = normalizeSortMeta(parsed)
  } catch (e) {
    multiSortMeta.value = []
  }
}

watch(multiSortMeta, () => saveSortPreferences(), { deep: true })

// Export functions
function escapeCSVValue(value: ItemDataValue | undefined): string {
  if (value === null || value === undefined) {
    return '""'
  }

  const stringValue = String(value)
  const escapedValue = stringValue.replace(/"/g, '""')
  return `"${escapedValue}"`
}

function generateCSV(): string {
  const ordered = [...fields.value].sort((a, b) => a.order_index - b.order_index)
  const headers = ordered.map(field => escapeCSVValue(field.name))
  const csvLines = [headers.join(',')]

  for (const item of items.value) {
    const row = ordered.map(field => {
      const value = item.data[field.name]
      return escapeCSVValue(value)
    })
    csvLines.push(row.join(','))
  }

  return csvLines.join('\n')
}

function generateJSON(): string {
  const ordered = [...fields.value].sort((a, b) => a.order_index - b.order_index)
  const exportData = items.value.map(item => {
    const orderedData: ItemData = {}
    for (const field of ordered) {
      orderedData[field.name] = item.data[field.name] ?? ''
    }
    return orderedData
  })

  return JSON.stringify(exportData, null, 2)
}

function getDefaultFilename(): string {
  const date = new Date().toISOString().split('T')[0]
  const safeName = props.collection.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const extension = exportFormat.value
  return `${safeName}-${date}.${extension}`
}

async function handleExport() {
  isExporting.value = true

  try {
    const extension = exportFormat.value
    const filters = [
      {
        name: exportFormat.value === 'csv' ? 'CSV Files' : 'JSON Files',
        extensions: [extension]
      },
      { name: 'All Files', extensions: ['*'] }
    ]

    const filePath = await window.electronAPI.showSaveDialog({
      title: `Export ${props.collection.name}`,
      defaultPath: getDefaultFilename(),
      filters
    })

    if (!filePath) {
      isExporting.value = false
      return
    }

    let content: string
    if (exportFormat.value === 'csv') {
      content = generateCSV()
    } else {
      content = generateJSON()
    }

    const success = await window.electronAPI.writeFile(filePath, content)

    if (success) {
      console.log('Export successful!')
    } else {
      console.error('Export failed')
    }
  } catch (error) {
    console.error('Export error:', error)
  } finally {
    isExporting.value = false
  }
}

// ==================== IMPORT FUNCTIONS ====================

async function handleSelectFile() {
  try {
    const extension = importFormat.value
    const filters = [
      {
        name: importFormat.value === 'csv' ? 'CSV Files' : 'JSON Files',
        extensions: [extension]
      },
      { name: 'All Files', extensions: ['*'] }
    ]

    const filePath = await window.electronAPI.showOpenDialog({
      title: 'Select File to Import',
      filters
    })

    if (!filePath) {
      return
    }

    selectedFile.value = filePath

    const content = await window.electronAPI.readFile(filePath)
    if (content === null) {
      console.error('Failed to read file')
      return
    }

    if (!content.trim()) {
      alert('The selected file is empty.')
      selectedFile.value = null
      return
    }

    let parsedData: ImportRow[] = []
    let fileFields: string[] = []

    if (importFormat.value === 'csv') {
      const lines = content.trim().split('\n')
      if (lines.length === 0) {
        console.error('Empty CSV file')
        return
      }

      const headerLine = lines[0]
      fileFields = parseCSVLine(headerLine)

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const row: ImportRow = {}
        for (let j = 0; j < fileFields.length; j++) {
          row[fileFields[j]] = values[j] || ''
        }
        parsedData.push(row)
      }
    } else {
      parsedData = JSON.parse(content) as ImportRow[]
      if (!Array.isArray(parsedData)) {
        console.error('JSON must be an array')
        return
      }

      if (parsedData.length > 0) {
        fileFields = Object.keys(parsedData[0])
      }
    }

    const matchedFields: string[] = []
    const newFields: string[] = []
    const fieldMap = new Map()
    fields.value.forEach(f => fieldMap.set(f.name.toLowerCase(), f.name))

    fileFields.forEach(fileField => {
      if (fieldMap.has(fileField.toLowerCase())) {
        matchedFields.push(fileField)
      } else {
        newFields.push(fileField)
      }
    })

    importPreview.value = {
      itemCount: parsedData.length,
      fields: fileFields,
      newFields,
      matchedFields,
      sample: parsedData.slice(0, 3)
    }
  } catch (error) {
    console.error('Error selecting file:', error)
    selectedFile.value = null
    importPreview.value = null
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function cancelImport() {
  selectedFile.value = null
  importPreview.value = null
  importFormat.value = 'csv'
  importMode.value = 'append'
}

async function handleImport() {
  if (!selectedFile.value || !importPreview.value) {
    return
  }

  isImporting.value = true

  try {
    const content = await window.electronAPI.readFile(selectedFile.value)
    if (!content) {
      console.error('Failed to read file')
      return
    }

    let parsedData: ImportRow[] = []
    let fileFields: string[] = []

    if (importFormat.value === 'csv') {
      const lines = content.trim().split('\n')
      const headerLine = lines[0]
      fileFields = parseCSVLine(headerLine)

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const row: ImportRow = {}
        for (let j = 0; j < fileFields.length; j++) {
          row[fileFields[j]] = values[j] || ''
        }
        parsedData.push(row)
      }
    } else {
      parsedData = JSON.parse(content) as ImportRow[]
      if (parsedData.length > 0) {
        fileFields = Object.keys(parsedData[0])
      }
    }

    if (importMode.value === 'replace') {
      const itemsToDelete = [...items.value]
      for (const item of itemsToDelete) {
        await window.electronAPI.deleteItem(item.id)
      }
      await store.loadItems(props.collection.id)
    }

    const fieldMap = new Map<string, string>()
    fields.value.forEach(f => fieldMap.set(f.name.toLowerCase(), f.name))

    const newFieldNames = fileFields.filter(f => !fieldMap.has(f.toLowerCase()))

    if (fields.value.length === 0) {
      for (let i = 0; i < fileFields.length; i++) {
        await store.addField({
          collectionId: props.collection.id,
          name: fileFields[i],
          type: 'text',
          options: null,
          orderIndex: i
        })
      }
    } else if (newFieldNames.length > 0) {
      const nextOrderIndex = Math.max(...fields.value.map(f => f.order_index), -1) + 1
      for (let i = 0; i < newFieldNames.length; i++) {
        await store.addField({
          collectionId: props.collection.id,
          name: newFieldNames[i],
          type: 'text',
          options: null,
          orderIndex: nextOrderIndex + i
        })
      }
    }

    fieldMap.clear()
    fields.value.forEach(f => fieldMap.set(f.name.toLowerCase(), f.name))
    const currentFieldNames = fields.value.map(f => f.name)

    const itemsToAdd = parsedData.map(row => {
      const itemData: ItemData = {}
      for (const fieldName of currentFieldNames) {
        itemData[fieldName] = ''
      }

      for (const csvHeader of fileFields) {
        const val = row[csvHeader]
        const targetFieldName = fieldMap.get(csvHeader.toLowerCase())

        if (targetFieldName) {
          itemData[targetFieldName] = val !== undefined && val !== null ? val : ''
        }
      }

      return {
        collectionId: props.collection.id,
        data: itemData
      }
    })

    for (const item of itemsToAdd) {
      await store.addItem(item)
    }

    cancelImport()
    console.log(`Successfully imported ${itemsToAdd.length} items`)
  } catch (error) {
    console.error('Import error:', error)
  } finally {
    isImporting.value = false
  }
}

async function addField() {
  if (!newField.value.name.trim()) return

  await store.addField({
    collectionId: props.collection.id,
    name: newField.value.name,
    type: newField.value.type,
    options: newField.value.type === 'select' ? newField.value.options : null,
    orderIndex: fields.value.length
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

function resetFormData() {
  formData.value = {}
  fields.value.forEach(field => {
    formData.value[field.name] = field.type === 'date' ? null : ''
  })
}

function cancelItemForm() {
  showAddItemForm.value = false
  editingItem.value = null
  resetFormData()
}

async function saveItem() {
  const plainData = JSON.parse(JSON.stringify(formData.value)) as Record<string, unknown>
  fields.value.forEach(field => {
    if (field.type === 'date') {
      plainData[field.name] = formatDateForStorage(formData.value[field.name])
    }
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
  const data: FormData = {}
  fields.value.forEach(field => {
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

function parseDateValue(value: ItemDataValue | Date | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2]) - 1
      const day = Number(match[3])
      const date = new Date(year, month, day)
      return Number.isNaN(date.getTime()) ? null : date
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateForStorage(value: FormValue | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = value instanceof Date ? value : parseDateValue(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateForDisplay(value: ItemDataValue | Date | undefined): string {
  const date = parseDateValue(value)
  if (!date) return '-'
  return date.toLocaleDateString()
}

function cancelSettings() {
  showCollectionSettings.value = false
  collectionName.value = props.collection.name
  collectionIcon.value = props.collection.icon
}

async function saveSettings() {
  await store.updateCollection({
    id: props.collection.id,
    name: collectionName.value,
    icon: collectionIcon.value
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

  for (let i = 0; i < reorderedFields.length; i++) {
    await store.updateField({
      ...reorderedFields[i],
      orderIndex: i
    })
  }
}

watch(
  () => props.collection,
  (newCollection) => {
    if (newCollection) {
      store.selectCollection(newCollection)
      collectionName.value = newCollection.name
      collectionIcon.value = newCollection.icon
      setTimeout(() => {
        loadSortPreferences()
      }, 100)
    }
  },
  { immediate: true }
)

watch(
  () => fields.value,
  () => {
    if (props.collection) {
      multiSortMeta.value = normalizeSortMeta(multiSortMeta.value)
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
