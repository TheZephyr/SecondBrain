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

    <!-- Search -->
    <div v-else-if="items.length > 0 || searchQuery" class="search-bar">
      <Search :size="18" class="search-icon" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search..."
        class="search-input"
      />
    </div>

    <!-- Items Table -->
    <div v-if="fields.length > 0" class="table-container">
      <table v-if="filteredItems.length > 0">
        <thead>
          <tr>
            <th v-for="field in fields" :key="field.id">{{ field.name }}</th>
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

    <!-- Collection Settings Modal -->
    <div v-if="showCollectionSettings" class="modal-overlay" @click.self="cancelSettings">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Collection Settings</h3>
          <button @click="cancelSettings" class="btn-close">
            <X :size="20" />
          </button>
        </div>
        
        <div class="modal-body">
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

          <div class="danger-zone">
            <div class="danger-header">
              <AlertTriangle :size="20" />
              <h4>Danger Zone</h4>
            </div>
            <p class="danger-text">Once you delete a collection, there is no going back.</p>
            <button @click="confirmDeleteCollection" class="btn-danger">
              <Trash2 :size="16" />
              <span>Delete Collection</span>
            </button>
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
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from '../store'
import {
  Settings, Plus, MoreVertical, Columns, Search,
  Pencil, Trash2, X, FileText, Database,
  GripVertical, AlertTriangle
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

const filteredItems = computed(() => {
  if (!searchQuery.value) return items.value

  const query = searchQuery.value.toLowerCase()
  return items.value.filter(item => {
    return Object.values(item.data).some(value =>
      String(value).toLowerCase().includes(query)
    )
  })
})

const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  variant: 'danger' as 'danger' | 'warning' | 'info',
  onConfirm: () => {}
})

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
  }
}, { immediate: true })

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

onMounted(() => {
  resetFormData()
  if (props.collection) {
    collectionName.value = props.collection.name
    collectionIcon.value = props.collection.icon
  }
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

/* Search Bar */
.search-bar {
  margin-bottom: 20px;
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
  margin-bottom: 24px;
}

.settings-section label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.settings-section input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
}

/* Danger Zone */
.danger-zone {
  margin-top: 32px;
  padding: 20px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
}

.danger-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--danger);
  margin-bottom: 12px;
}

.danger-header h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.danger-text {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
}
</style>