<template>
  <div class="collection-view">
    <div class="header">
      <div class="header-left">
        <div class="collection-icon">
          <component :is="getIcon(collection.icon)" :size="28" />
        </div>
        <h2>{{ collection.name }}</h2>
      </div>
      <div class="header-right">
        <button @click="showFieldsManager = true" class="btn-icon" title="Manage Fields">
          <Settings :size="18" />
        </button>
        <button @click="showAddItemForm = true" class="btn-primary">
          <Plus :size="18" />
          <span>Add Item</span>
        </button>
        <button @click="showCollectionSettings = true" class="btn-icon" title="Collection Settings">
          <MoreVertical :size="18" />
        </button>
      </div>
    </div>

    <!-- Empty Fields State -->
    <div v-if="fields.length === 0" class="empty-fields">
      <div class="empty-icon">
        <Columns :size="64" :stroke-width="1.5" />
      </div>
      <h3>No Fields Yet</h3>
      <p>Define the structure of your collection by adding fields</p>
      <button @click="showFieldsManager = true" class="btn-primary">
        <Plus :size="18" />
        <span>Add Fields</span>
      </button>
    </div>

    <!-- Search and Sort -->
    <div v-else-if="items.length > 0 || searchQuery" class="search-sort-container">
      <div class="search-bar">
        <Search :size="18" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search..."
          class="search-input"
        />
      </div>
      
      <div class="sort-dropdown-container" v-if="fields.length > 0">
        <button 
          @click="showSortDropdown = !showSortDropdown" 
          class="sort-button"
          :class="{ 'active': sortCriteria.length > 0 }"
        >
          <ArrowUpDown :size="16" />
          <span>Sort</span>
          <ChevronDown :size="14" class="chevron" :class="{ 'open': showSortDropdown }" />
        </button>
        
        <div v-if="showSortDropdown" class="sort-dropdown" @click.stop>
          <div class="sort-dropdown-header">
            <span>Sort by</span>
            <button @click="showSortDropdown = false" class="btn-close-small">
              <X :size="14" />
            </button>
          </div>
          
          <div class="sort-criteria-list">
            <div 
              v-for="(criterion, index) in sortCriteria" 
              :key="index"
              class="sort-criterion-item"
            >
              <div class="criterion-info">
                <span class="criterion-field">{{ criterion.fieldName }}</span>
                <span class="criterion-type">{{ getFieldType(criterion.fieldName) }}</span>
              </div>
              <div class="criterion-actions">
                <button 
                  @click="toggleCriterionDirection(index)"
                  class="btn-icon-small"
                  :title="criterion.direction === 'asc' ? 'Ascending' : 'Descending'"
                >
                  <component :is="criterion.direction === 'asc' ? ArrowUp : ArrowDown" :size="14" />
                </button>
                <button 
                  @click="removeCriterion(index)"
                  class="btn-icon-small danger"
                  title="Remove"
                >
                  <X :size="14" />
                </button>
              </div>
            </div>
            <div v-if="sortCriteria.length === 0" class="no-sort-criteria">
              <p>No sort criteria. Click a column header or add one below.</p>
            </div>
          </div>
          
          <div class="add-sort-section">
            <select 
              v-model="selectedFieldForSort" 
              class="field-select"
              @change="addSortCriterion"
            >
              <option value="">Add sort field...</option>
              <option 
                v-for="field in availableFieldsForSort" 
                :key="field.id" 
                :value="field.name"
              >
                {{ field.name }} ({{ field.type }})
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div v-if="fields.length > 0" class="table-container">
      <table v-if="filteredItems.length > 0">
        <thead>
          <tr>
            <th 
              v-for="field in fields" 
              :key="field.id"
              class="sortable-header"
              @click="handleHeaderClick(field.name)"
            >
              <div class="header-content">
                <span>{{ field.name }}</span>
                <component 
                  :is="getSortIcon(field.name)" 
                  :size="14" 
                  class="sort-icon"
                  :class="{ 'sort-active': getSortDirection(field.name) !== null }"
                />
              </div>
            </th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredItems" :key="item.id">
            <td v-for="field in fields" :key="field.id">
              <span class="cell-content">{{ formatFieldValue(item.data[field.name], field.type) }}</span>
            </td>
            <td class="actions-cell">
              <button @click="editItem(item)" class="btn-icon-small" title="Edit">
                <Pencil :size="16" />
              </button>
              <button @click="deleteItem(item)" class="btn-icon-small danger" title="Delete">
                <Trash2 :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="items.length === 0" class="empty-state">
        <FileText :size="48" :stroke-width="1.5" />
        <p>No items yet. Click "Add Item" to get started!</p>
      </div>
      <div v-else class="empty-state">
        <Search :size="48" :stroke-width="1.5" />
        <p>No items match your search.</p>
      </div>
    </div>

    <div v-if="items.length > 0" class="stats">
      <Database :size="14" />
      <span>{{ items.length }} total • {{ filteredItems.length }} showing</span>
    </div>

    <!-- Add/Edit Item Modal -->
    <div v-if="showAddItemForm" class="modal-overlay" @click.self="cancelItemForm">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingItem ? 'Edit Item' : 'Add New Item' }}</h3>
          <button @click="cancelItemForm" class="btn-close">
            <X :size="20" />
          </button>
        </div>
        
        <form @submit.prevent="saveItem">
          <div v-for="field in fields" :key="field.id" class="form-group">
            <label>{{ field.name }}</label>
            <input
              v-if="field.type === 'text'"
              v-model="formData[field.name]"
              type="text"
              :placeholder="'Enter ' + field.name.toLowerCase()"
            />
            <textarea
              v-else-if="field.type === 'textarea'"
              v-model="formData[field.name]"
              rows="4"
              :placeholder="'Enter ' + field.name.toLowerCase()"
            ></textarea>
            <input
              v-else-if="field.type === 'number'"
              v-model.number="formData[field.name]"
              type="number"
              :placeholder="'Enter ' + field.name.toLowerCase()"
            />
            <input
              v-else-if="field.type === 'date'"
              v-model="formData[field.name]"
              type="date"
            />
            <select
              v-else-if="field.type === 'select'"
              v-model="formData[field.name]"
            >
              <option value="">Select...</option>
              <option v-for="option in getSelectOptions(field)" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <div class="form-actions">
            <button type="button" @click="cancelItemForm" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">
              {{ editingItem ? 'Update' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Fields Manager Modal -->
    <div v-if="showFieldsManager" class="modal-overlay" @click.self="showFieldsManager = false">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h3>Manage Fields</h3>
          <button @click="showFieldsManager = false" class="btn-close">
            <X :size="20" />
          </button>
        </div>
        
        <div class="modal-body">
          <div class="fields-list">
            <div 
              v-for="(field, index) in fields" 
              :key="field.id" 
              class="field-item"
              draggable="true"
              @dragstart="handleDragStart(index)"
              @dragover.prevent="handleDragOver(index)"
              @drop="handleDrop(index)"
              @dragend="handleDragEnd"
              :class="{ 'dragging': draggedIndex === index }"
            >
              <GripVertical :size="16" class="field-grip" />
              <span class="field-name">{{ field.name }}</span>
              <span class="field-type-badge">{{ field.type }}</span>
              <button @click="deleteField(field)" class="btn-icon-small danger" title="Delete field">
                <Trash2 :size="14" />
              </button>
            </div>
            <div v-if="fields.length === 0" class="no-fields">
              <Columns :size="32" :stroke-width="1.5" />
              <p>No fields yet. Add your first field below.</p>
            </div>
          </div>

          <div class="add-field-section">
            <div class="section-title">
              <Plus :size="16" />
              <span>Add New Field</span>
            </div>
            <div class="add-field-form">
              <input
                v-model="newField.name"
                type="text"
                placeholder="Field name"
                class="field-name-input"
                ref="fieldNameInput"
                @click="($event.target as HTMLInputElement).focus()"
              />
              <select v-model="newField.type" class="field-type-select">
                <option value="text">Text</option>
                <option value="textarea">Text Area</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Select</option>
              </select>
              <button @click="addField" type="button" class="btn-primary">Add</button>
            </div>
            
            <div v-if="newField.type === 'select'" class="select-options">
              <input
                v-model="newField.options"
                type="text"
                placeholder="Options (comma-separated: Option1, Option2, Option3)"
                class="options-input"
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="showFieldsManager = false" class="btn-primary">Done</button>
        </div>
      </div>
    </div>

    <!-- Collection Settings Modal (Redesigned) -->
    <div v-if="showCollectionSettings" class="modal-overlay" @click.self="cancelSettings">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Collection Settings</h3>
          <button @click="cancelSettings" class="btn-close">
            <X :size="20" />
          </button>
        </div>
        
        <div class="modal-body">
          <!-- Collection Settings Section -->
          <div class="settings-accordion-section">
            <button 
              class="accordion-header"
              :class="{ 'active': accordionSections.general }"
              @click="toggleAccordion('general')"
            >
              <div class="accordion-title">
                <Settings2 :size="18" />
                <span>Collection Settings</span>
              </div>
              <ChevronDown :size="18" class="accordion-chevron" :class="{ 'open': accordionSections.general }" />
            </button>
            
            <div v-show="accordionSections.general" class="accordion-content">
              <div class="settings-section">
                <label>Collection Name</label>
                <input v-model="collectionName" type="text" placeholder="Collection name" />
              </div>

              <div class="settings-section">
                <label>Icon</label>
                <div class="icon-picker">
                  <button
                    v-for="icon in iconOptions"
                    :key="icon.value"
                    :class="['icon-option', { selected: collectionIcon === icon.value }]"
                    @click="collectionIcon = icon.value"
                    type="button"
                  >
                    <component :is="icon.component" :size="24" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Export Data Section -->
          <div class="settings-accordion-section">
            <button 
              class="accordion-header"
              :class="{ 'active': accordionSections.export }"
              @click="toggleAccordion('export')"
            >
              <div class="accordion-title">
                <Download :size="18" />
                <span>Export Data</span>
              </div>
              <ChevronDown :size="18" class="accordion-chevron" :class="{ 'open': accordionSections.export }" />
            </button>
            
            <div v-show="accordionSections.export" class="accordion-content">
              <div class="settings-section">
                <label>Export Format</label>
                <select v-model="exportFormat" class="export-format-select">
                  <option value="csv">CSV (Comma Separated Values)</option>
                  <option value="json">JSON (JavaScript Object Notation)</option>
                </select>
              </div>

              <div class="export-info">
                <p v-if="exportFormat === 'csv'">
                  Export all items as a CSV file. All values will be enclosed in quotes for compatibility.
                </p>
                <p v-else>
                  Export all items as a JSON file. Data will be exported as an array of objects with full type preservation.
                </p>
              </div>

              <button @click="handleExport" class="btn-primary export-button" :disabled="isExporting">
                <Download :size="16" v-if="!isExporting" />
                <span v-if="isExporting">Exporting...</span>
                <span v-else>Export {{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}</span>
              </button>
            </div>
          </div>

          <!-- Import Data Section -->
          <div class="settings-accordion-section">
            <button 
              class="accordion-header"
              :class="{ 'active': accordionSections.import }"
              @click="toggleAccordion('import')"
            >
              <div class="accordion-title">
                <Upload :size="18" />
                <span>Import Data</span>
              </div>
              <ChevronDown :size="18" class="accordion-chevron" :class="{ 'open': accordionSections.import }" />
            </button>
            
            <div v-show="accordionSections.import" class="accordion-content">
              <!-- File Selection -->
              <div v-if="!importPreview" class="import-select-section">
                <div class="settings-section">
                  <label>Import Format</label>
                  <select v-model="importFormat" class="export-format-select">
                    <option value="csv">CSV (Comma Separated Values)</option>
                    <option value="json">JSON (JavaScript Object Notation)</option>
                  </select>
                </div>

                <div class="settings-section">
                  <label>Import Mode</label>
                  <div class="radio-group">
                    <label class="radio-option">
                      <input type="radio" v-model="importMode" value="append" />
                      <div class="radio-content">
                        <span class="radio-title">Append</span>
                        <span class="radio-desc">Add imported items to existing data</span>
                      </div>
                    </label>
                    <label class="radio-option">
                      <input type="radio" v-model="importMode" value="replace" />
                      <div class="radio-content">
                        <span class="radio-title">Replace</span>
                        <span class="radio-desc">Delete all existing items and import new data</span>
                      </div>
                    </label>
                  </div>
                </div>

                <button @click="handleSelectFile" class="btn-primary export-button">
                  <Upload :size="16" />
                  <span>Select File to Import</span>
                </button>
              </div>

              <!-- Import Preview -->
              <div v-else class="import-preview-section">
                <div class="preview-header">
                  <div class="preview-title">
                    <FileText :size="20" />
                    <span>Import Preview</span>
                  </div>
                  <button @click="cancelImport" class="btn-icon-small" title="Cancel">
                    <X :size="16" />
                  </button>
                </div>

                <div class="preview-stats">
                  <div class="preview-stat">
                    <span class="stat-label">Items to import:</span>
                    <span class="stat-value">{{ importPreview.itemCount }}</span>
                  </div>
                  <div class="preview-stat">
                    <span class="stat-label">Import mode:</span>
                    <span class="stat-value">{{ importMode === 'append' ? 'Append' : 'Replace' }}</span>
                  </div>
                </div>

                <div v-if="fields.length === 0" class="preview-info info">
                  <AlertTriangle :size="16" />
                  <p>This collection has no fields. Fields will be automatically created from the import file.</p>
                </div>

                <div v-if="importPreview.matchedFields.length > 0" class="preview-info success">
                  <div class="info-header">
                    <span>✓ Matched Fields ({{ importPreview.matchedFields.length }})</span>
                  </div>
                  <div class="field-tags">
                    <span v-for="field in importPreview.matchedFields" :key="field" class="field-tag matched">
                      {{ field }}
                    </span>
                  </div>
                </div>

                <div v-if="importPreview.newFields.length > 0" class="preview-info warning">
                  <div class="info-header">
                    <AlertTriangle :size="16" />
                    <span>New Fields ({{ importPreview.newFields.length }})</span>
                  </div>
                  <p>These fields will be added to your collection:</p>
                  <div class="field-tags">
                    <span v-for="field in importPreview.newFields" :key="field" class="field-tag new">
                      {{ field }}
                    </span>
                  </div>
                </div>

                <div class="preview-sample">
                  <div class="sample-header">Sample Data (first 3 items)</div>
                  <div class="sample-items">
                    <div v-for="(item, index) in importPreview.sample" :key="index" class="sample-item">
                      <div class="sample-item-header">Item {{ index + 1 }}</div>
                      <div class="sample-fields">
                        <div v-for="(value, key) in item" :key="key" class="sample-field">
                          <span class="sample-key">{{ key }}:</span>
                          <span class="sample-value">{{ value || '(empty)' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="import-actions">
                  <button @click="cancelImport" class="btn-secondary">Cancel</button>
                  <button @click="handleImport" class="btn-primary" :disabled="isImporting">
                    <Upload :size="16" v-if="!isImporting" />
                    <span v-if="isImporting">Importing...</span>
                    <span v-else>Import {{ importPreview.itemCount }} items</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Danger Zone Section -->
          <div class="settings-accordion-section">
            <button 
              class="accordion-header"
              :class="{ 'active': accordionSections.danger }"
              @click="toggleAccordion('danger')"
            >
              <div class="accordion-title">
                <AlertTriangle :size="18" />
                <span>Danger Zone</span>
              </div>
              <ChevronDown :size="18" class="accordion-chevron" :class="{ 'open': accordionSections.danger }" />
            </button>
            
            <div v-show="accordionSections.danger" class="accordion-content">
              <div class="danger-zone">
                <p class="danger-text">Once you delete a collection, there is no going back.</p>
                <button @click="confirmDeleteCollection" class="btn-danger">
                  <Trash2 :size="16" />
                  <span>Delete Collection</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="cancelSettings" class="btn-secondary">Cancel</button>
          <button @click="saveSettings" class="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirmation Dialog -->
  <ConfirmDialog
    :is-open="confirmDialog.isOpen"
    :title="confirmDialog.title"
    :message="confirmDialog.message"
    :confirm-text="confirmDialog.confirmText"
    :variant="confirmDialog.variant"
    @confirm="confirmDialog.onConfirm"
    @cancel="confirmDialog.isOpen = false"
  />

</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from '../store'
import {
  Settings, Plus, MoreVertical, Columns, Search,
  Pencil, Trash2, X, FileText, Database,
  GripVertical, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown,
  Download, Settings2, Upload
} from 'lucide-vue-next'
import { useIcons } from '../composables/useIcons'
import ConfirmDialog from './ConfirmDialog.vue'

const { getIcon, iconOptions } = useIcons()
const store = useStore()
const { fields, items } = storeToRefs(store)

const props = defineProps<{
  collection: any
}>()

const emit = defineEmits(['collection-deleted'])

const searchQuery = ref('')
const showAddItemForm = ref(false)
const showFieldsManager = ref(false)
const showCollectionSettings = ref(false)
const editingItem = ref<any>(null)
const formData = ref<any>({})
const newField = ref({
  name: '',
  type: 'text',
  options: ''
})
const collectionName = ref('')
const collectionIcon = ref('')
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// Export state
const exportFormat = ref<'csv' | 'json'>('csv')
const isExporting = ref(false)

// Import state
const importFormat = ref<'csv' | 'json'>('csv')
const importMode = ref<'append' | 'replace'>('append')
const isImporting = ref(false)
const selectedFile = ref<string | null>(null)
const importPreview = ref<{
  itemCount: number
  fields: string[]
  newFields: string[]
  matchedFields: string[]
  sample: any[]
} | null>(null)

// Accordion state
const accordionSections = ref({
  general: true,  // Expanded by default
  export: false,
  import: false,
  danger: false
})

function toggleAccordion(section: 'general' | 'export' | 'import' | 'danger') {
  accordionSections.value[section] = !accordionSections.value[section]
}

// Sorting state
type SortDirection = 'asc' | 'desc'
type SortCriterion = {
  fieldName: string
  direction: SortDirection
}

const sortCriteria = ref<SortCriterion[]>([])
const showSortDropdown = ref(false)
const selectedFieldForSort = ref('')

function compareValues(a: any, b: any, fieldType: string, direction: SortDirection): number {
  // Handle null/undefined/empty values - always sort to end
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  
  let comparison = 0
  
  switch (fieldType) {
    case 'number':
      const aNum = parseFloat(String(a))
      const bNum = parseFloat(String(b))
      if (isNaN(aNum) && isNaN(bNum)) comparison = 0
      else if (isNaN(aNum)) comparison = 1
      else if (isNaN(bNum)) comparison = -1
      else comparison = aNum - bNum
      break
      
    case 'date':
      const aDate = new Date(a).getTime()
      const bDate = new Date(b).getTime()
      if (isNaN(aDate) && isNaN(bDate)) comparison = 0
      else if (isNaN(aDate)) comparison = 1
      else if (isNaN(bDate)) comparison = -1
      else comparison = aDate - bDate
      break
      
    case 'text':
    case 'textarea':
    case 'select':
    default:
      comparison = String(a).toLowerCase().localeCompare(String(b).toLowerCase())
      break
  }
  
  return direction === 'asc' ? comparison : -comparison
}

function sortItems(items: any[]): any[] {
  if (sortCriteria.value.length === 0) return items
  
  return [...items].sort((a, b) => {
    for (const criterion of sortCriteria.value) {
      const field = fields.value.find(f => f.name === criterion.fieldName)
      if (!field) continue
      
      const aVal = a.data[criterion.fieldName]
      const bVal = b.data[criterion.fieldName]
      
      const comparison = compareValues(aVal, bVal, field.type, criterion.direction)
      if (comparison !== 0) return comparison
    }
    return 0
  })
}

const filteredItems = computed(() => {
  let result = items.value
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item => {
      return Object.values(item.data).some(value =>
        String(value).toLowerCase().includes(query)
      )
    })
  }
  
  result = sortItems(result)
  
  return result
})

const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  variant: 'danger' as 'danger' | 'warning' | 'info',
  onConfirm: () => {}
})

// Export functions
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '""'
  }
  
  const stringValue = String(value)
  const escapedValue = stringValue.replace(/"/g, '""')
  return `"${escapedValue}"`
}

function generateCSV(): string {
  const orderedFields = [...fields.value].sort((a, b) => a.order_index - b.order_index)
  
  // Header row
  const headers = orderedFields.map(field => escapeCSVValue(field.name))
  const csvLines = [headers.join(',')]
  
  // Data rows
  for (const item of items.value) {
    const row = orderedFields.map(field => {
      const value = item.data[field.name]
      return escapeCSVValue(value)
    })
    csvLines.push(row.join(','))
  }
  
  return csvLines.join('\n')
}

function generateJSON(): string {
  const orderedFields = [...fields.value].sort((a, b) => a.order_index - b.order_index)
  
  const exportData = items.value.map(item => {
    const orderedData: any = {}
    for (const field of orderedFields) {
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
      // Could show a success message here
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
    
    // Read and parse file
    const content = await window.electronAPI.readFile(filePath)
    if (!content) {
      console.error('Failed to read file')
      return
    }
    
    // Parse the file
    let parsedData: any[] = []
    let fileFields: string[] = []
    
    if (importFormat.value === 'csv') {
      // Simple CSV parser
      const lines = content.trim().split('\n')
      if (lines.length === 0) {
        console.error('Empty CSV file')
        return
      }
      
      // Parse header
      const headerLine = lines[0]
      fileFields = parseCSVLine(headerLine)
      
      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const row: any = {}
        for (let j = 0; j < fileFields.length; j++) {
          row[fileFields[j]] = values[j] || ''
        }
        parsedData.push(row)
      }
    } else {
      // JSON parser
      parsedData = JSON.parse(content)
      if (!Array.isArray(parsedData)) {
        console.error('JSON must be an array')
        return
      }
      
      // Extract field names from first item
      if (parsedData.length > 0) {
        fileFields = Object.keys(parsedData[0])
      }
    }
    
    // Generate preview
    const currentFieldNames = fields.value.map(f => f.name)
    const matchedFields = fileFields.filter(f => currentFieldNames.includes(f))
    const newFields = fileFields.filter(f => !currentFieldNames.includes(f))
    
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
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
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
    
    let parsedData: any[] = []
    let fileFields: string[] = []
    
    // Parse file
    if (importFormat.value === 'csv') {
      const lines = content.trim().split('\n')
      const headerLine = lines[0]
      fileFields = parseCSVLine(headerLine)
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const row: any = {}
        for (let j = 0; j < fileFields.length; j++) {
          row[fileFields[j]] = values[j] || ''
        }
        parsedData.push(row)
      }
    } else {
      parsedData = JSON.parse(content)
      // Extract field names from first item
      if (parsedData.length > 0) {
        fileFields = Object.keys(parsedData[0])
      }
    }
    
    // Determine current and new fields
    let currentFieldNames = fields.value.map(f => f.name)
    const newFieldNames = fileFields.filter(f => !currentFieldNames.includes(f))
    
    // Create fields from import file (both for empty collections and new fields)
    if (fields.value.length === 0) {
      // Empty collection - create all fields from import file
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
      // Collection has fields - add only the new ones
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
    
    // Refresh current field names after adding new fields
    currentFieldNames = fields.value.map(f => f.name)
    const itemsToAdd = parsedData.map(row => {
      const itemData: any = {}
      
      // Initialize all fields with empty values
      for (const fieldName of currentFieldNames) {
        itemData[fieldName] = ''
      }
      
      // Fill in matched fields
      for (const fieldName of fileFields) {
        if (currentFieldNames.includes(fieldName)) {
          itemData[fieldName] = row[fieldName] || ''
        }
      }
      
      return {
        collectionId: props.collection.id,
        data: itemData
      }
    })
    
    // Handle replace mode
    if (importMode.value === 'replace') {
      // Delete all existing items
      for (const item of items.value) {
        await store.deleteItem(item.id)
      }
    }
    
    // Add all items
    for (const item of itemsToAdd) {
      await store.addItem(item)
    }
    
    // Success - reset import state
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

async function deleteField(field: any) {
  confirmDialog.value = {
    isOpen: true,
    title: 'Delete Field',
    message: `Delete "${field.name}" field? All data in this field will be lost.`,
    confirmText: 'Delete',
    variant: 'danger',
    onConfirm: async () => {
      await store.deleteField(field.id)
      confirmDialog.value.isOpen = false
    }
  }
}

function getSelectOptions(field: any) {
  if (!field.options) return []
  return field.options.split(',').map((opt: string) => opt.trim())
}

function resetFormData() {
  formData.value = {}
  fields.value.forEach(field => {
    formData.value[field.name] = ''
  })
}

function cancelItemForm() {
  showAddItemForm.value = false
  editingItem.value = null
  resetFormData()
}

async function saveItem() {
  const plainData = JSON.parse(JSON.stringify(formData.value))
  
  if (editingItem.value) {
    await store.updateItem({
      id: editingItem.value.id,
      data: plainData
    })
  } else {
    await store.addItem({
      collectionId: props.collection.id,
      data: plainData
    })
  }

  cancelItemForm()
}

function editItem(item: any) {
  editingItem.value = item
  formData.value = { ...item.data }
  showAddItemForm.value = true
}

async function deleteItem(item: any) {
  confirmDialog.value = {
    isOpen: true,
    title: 'Delete Item',
    message: 'Are you sure you want to delete this item? This action cannot be undone.',
    confirmText: 'Delete',
    variant: 'danger',
    onConfirm: async () => {
      await store.deleteItem(item)
      confirmDialog.value.isOpen = false
    }
  }
}

function formatFieldValue(value: any, type: string) {
  if (value === null || value === undefined || value === '') return '-'
  
  if (type === 'date') {
    return new Date(value).toLocaleDateString()
  }
  
  return value
}

function getSortDirection(fieldName: string): SortDirection | null {
  const criterion = sortCriteria.value.find(c => c.fieldName === fieldName)
  return criterion ? criterion.direction : null
}

function getSortIcon(fieldName: string) {
  const direction = getSortDirection(fieldName)
  if (direction === 'asc') return ArrowUp
  if (direction === 'desc') return ArrowDown
  return ArrowUpDown
}

function getStorageKey(collectionId: number): string {
  return `sort_pref_${collectionId}`
}

function saveSortPreferences() {
  if (!props.collection) return
  const key = getStorageKey(props.collection.id)
  localStorage.setItem(key, JSON.stringify(sortCriteria.value))
}

function loadSortPreferences() {
  if (!props.collection) {
    sortCriteria.value = []
    return
  }
  
  const key = getStorageKey(props.collection.id)
  const saved = localStorage.getItem(key)
  
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      // Validate that saved criteria still match existing fields
      const validCriteria = parsed.filter((c: SortCriterion) => 
        fields.value.some(f => f.name === c.fieldName)
      )
      sortCriteria.value = validCriteria
    } catch (e) {
      sortCriteria.value = []
    }
  } else {
    sortCriteria.value = []
  }
}

const availableFieldsForSort = computed(() => {
  return fields.value.filter(field => 
    !sortCriteria.value.some(c => c.fieldName === field.name)
  )
})

function getFieldType(fieldName: string): string {
  const field = fields.value.find(f => f.name === fieldName)
  return field ? field.type : 'unknown'
}

function addSortCriterion() {
  if (!selectedFieldForSort.value) return
  
  const fieldName = selectedFieldForSort.value
  if (!sortCriteria.value.some(c => c.fieldName === fieldName)) {
    sortCriteria.value.push({ fieldName, direction: 'asc' })
    saveSortPreferences()
  }
  
  selectedFieldForSort.value = ''
}

function toggleCriterionDirection(index: number) {
  const criterion = sortCriteria.value[index]
  criterion.direction = criterion.direction === 'asc' ? 'desc' : 'asc'
  saveSortPreferences()
}

function removeCriterion(index: number) {
  sortCriteria.value.splice(index, 1)
  saveSortPreferences()
}

function handleHeaderClick(fieldName: string) {
  const existingIndex = sortCriteria.value.findIndex(c => c.fieldName === fieldName)
  
  if (existingIndex === -1) {
    // Field not in sort criteria - add it with 'asc'
    sortCriteria.value.push({ fieldName, direction: 'asc' })
  } else {
    const current = sortCriteria.value[existingIndex]
    if (current.direction === 'asc') {
      // Toggle to 'desc'
      current.direction = 'desc'
    } else {
      // Remove from sort criteria
      sortCriteria.value.splice(existingIndex, 1)
    }
  }
  
  saveSortPreferences()
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
  confirmDialog.value = {
    isOpen: true,
    title: 'Delete Collection',
    message: `Delete "${props.collection.name}" and all its data? This cannot be undone.`,
    confirmText: 'Delete Collection',
    variant: 'danger',
    onConfirm: async () => {
      await store.deleteCollection(props.collection.id)
      confirmDialog.value.isOpen = false
      emit('collection-deleted')
    }
  }
}

function handleDragStart(index: number) {
  draggedIndex.value = index
}

function handleDragOver(index: number) {
  dragOverIndex.value = index
}

function handleDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

async function handleDrop(dropIndex: number) {
  if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
    handleDragEnd()
    return
  }

  const reorderedFields = [...fields.value]
  const [movedField] = reorderedFields.splice(draggedIndex.value, 1)
  reorderedFields.splice(dropIndex, 0, movedField)

  // Update order_index for all fields
  for (let i = 0; i < reorderedFields.length; i++) {
    await store.updateField({
      ...reorderedFields[i],
      orderIndex: i
    })
  }

  handleDragEnd()
}

watch(() => props.collection, (newCollection) => {
  if (newCollection) {
    store.selectCollection(newCollection)
    collectionName.value = newCollection.name
    collectionIcon.value = newCollection.icon
    // Load sort preferences after fields are loaded
    setTimeout(() => {
      loadSortPreferences()
    }, 100)
  }
}, { immediate: true })

watch(() => fields.value, () => {
  // Reload preferences when fields change to validate them
  if (props.collection) {
    loadSortPreferences()
  }
})

watch(() => showFieldsManager.value, (isOpen) => {
  if (isOpen) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const input = document.querySelector('.field-name-input') as HTMLInputElement
      if (input) {
        input.focus()
      }
    }, 100)
  }
})

watch(() => showAddItemForm.value, (isOpen) => {
  if (isOpen) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const input = document.querySelector('.modal-content form input') as HTMLInputElement
      if (input) {
        input.focus()
      }
    }, 100)
  }
})

// Close dropdown when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.sort-dropdown-container')) {
    showSortDropdown.value = false
  }
}

onMounted(() => {
  resetFormData()
  if (props.collection) {
    collectionName.value = props.collection.name
    collectionIcon.value = props.collection.icon
  }
  
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* CollectionView-specific styles */

.collection-view {
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header Section */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collection-icon {
  width: 48px;
  height: 48px;
  background: var(--accent-light);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}

.header h2 {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-right {
  display: flex;
  gap: 8px;
}

/* Empty Fields State */
.empty-fields {
  text-align: center;
  padding: 80px 40px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.empty-fields h3 {
  font-size: 20px;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-weight: 600;
}

.empty-fields p {
  color: var(--text-muted);
  margin-bottom: 24px;
  font-size: 14px;
}

/* Search and Sort Container */
.search-sort-container {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;
}

/* Search Bar */
.search-bar {
  flex: 1;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 42px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: var(--bg-tertiary);
}

/* Table Container */
.table-container {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

/* Sortable Headers */
.sortable-header {
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: background-color 0.2s;
}

.sortable-header:hover {
  background-color: var(--bg-tertiary);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sort-icon {
  color: var(--text-muted);
  transition: color 0.2s;
  flex-shrink: 0;
}

.sort-icon.sort-active {
  color: var(--accent-primary);
}

.actions-col {
  width: 100px;
  text-align: right;
}

.cell-content {
  display: block;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions-cell {
  text-align: right;
  white-space: nowrap;
}

/* Fields Manager */
.fields-list {
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  min-height: 100px;
  background: var(--bg-primary);
}

.field-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.2s;
  cursor: move;
  user-select: none;
}

.field-item:hover {
  border-color: var(--accent-primary);
}

.field-item.dragging {
  opacity: 0.5;
  border-color: var(--accent-primary);
  background: var(--accent-light);
}

.field-grip {
  color: var(--text-muted);
  cursor: grab;
  flex-shrink: 0;
}

.field-grip:active {
  cursor: grabbing;
}

.field-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.field-type-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--bg-primary);
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: 4px;
}

.no-fields {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* Add Field Section */
.add-field-section {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-field-form {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.field-name-input {
  flex: 2;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.field-name-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  z-index: 2;
}

.field-type-select {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
}

.select-options {
  margin-top: 8px;
}

.options-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
}

/* Settings Section */
.settings-section {
  margin-bottom: 20px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.settings-section input,
.settings-section select {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
}

/* Accordion Sections */
.settings-accordion-section {
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-primary);
}

.accordion-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--bg-tertiary);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary);
}

.accordion-header:hover {
  background: var(--bg-hover);
}

.accordion-header.active {
  background: var(--bg-hover);
}

.accordion-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
}

.accordion-chevron {
  color: var(--text-muted);
  transition: transform 0.2s;
}

.accordion-chevron.open {
  transform: rotate(180deg);
}

.accordion-content {
  padding: 20px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Export Section */
.export-format-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

.export-info {
  margin: 16px 0;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.export-button {
  width: 100%;
  justify-content: center;
}

.export-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Import Section */
.import-select-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover {
  border-color: var(--accent-primary);
  background: var(--bg-hover);
}

.radio-option input[type="radio"] {
  margin-top: 2px;
  cursor: pointer;
  accent-color: var(--accent-primary);
}

.radio-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.radio-title {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.radio-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Import Preview */
.import-preview-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.preview-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.preview-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  color: var(--text-primary);
  font-weight: 500;
}

.preview-info {
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
}

.preview-info.info {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-info.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: var(--text-secondary);
}

.preview-info.warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--text-secondary);
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.field-tag {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.field-tag.matched {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success);
}

.field-tag.new {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning);
}

.preview-sample {
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.sample-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.sample-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sample-item {
  padding: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.sample-item-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.sample-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sample-field {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.sample-key {
  color: var(--text-muted);
  min-width: 80px;
  font-weight: 500;
}

.sample-value {
  color: var(--text-primary);
  flex: 1;
  word-break: break-word;
}

.import-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

/* Danger Zone */
.danger-zone {
  padding: 0;
}

.danger-text {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
  line-height: 1.5;
}

/* Sort Dropdown */
.sort-dropdown-container {
  position: relative;
}

.sort-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.sort-button:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-primary);
}

.sort-button.active {
  background: var(--accent-light);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.sort-button .chevron {
  transition: transform 0.2s;
  color: var(--text-muted);
}

.sort-button .chevron.open {
  transform: rotate(180deg);
}

.sort-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  z-index: 100;
  max-height: 400px;
  overflow-y: auto;
}

.sort-dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-close-small {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close-small:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.sort-criteria-list {
  padding: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.sort-criterion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 6px;
  gap: 12px;
}

.criterion-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.criterion-field {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.criterion-type {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.criterion-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.no-sort-criteria {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.add-sort-section {
  padding: 12px;
  border-top: 1px solid var(--border-color);
}

.field-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

.field-select:focus {
  outline: none;
  border-color: var(--accent-primary);
}
</style>