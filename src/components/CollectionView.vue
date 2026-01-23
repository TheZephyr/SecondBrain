<template>
  <div class="collection-view">
    <div class="header">
      <div class="header-left">
        <h2>{{ collection.icon }} {{ collection.name }}</h2>
        <button @click="showFieldsManager = true" class="btn-manage-fields">⚙️ Manage Fields</button>
      </div>
      <div class="header-right">
        <button @click="showAddItemForm = true" class="btn-add">+ Add Item</button>
        <button @click="showCollectionSettings = true" class="btn-settings">⋯</button>
      </div>
    </div>

    <!-- Empty Fields State -->
    <div v-if="fields.length === 0" class="empty-fields">
      <div class="empty-icon">📋</div>
      <h3>No Fields Yet</h3>
      <p>Add fields to define the structure of your collection</p>
      <button @click="showFieldsManager = true" class="btn-primary">Add Fields</button>
    </div>

    <!-- Search -->
    <div v-else-if="items.length > 0 || searchQuery" class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="🔍 Search..."
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
              {{ formatFieldValue(item.data[field.name], field.type) }}
            </td>
            <td class="actions-cell">
              <button @click="editItem(item)" class="btn-edit">✏️</button>
              <button @click="deleteItem(item.id)" class="btn-delete">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="items.length === 0" class="empty-state">
        <p>No items yet. Click "Add Item" to get started! 📝</p>
      </div>
      <div v-else class="empty-state">
        <p>No items match your search.</p>
      </div>
    </div>

    <div v-if="items.length > 0" class="stats">
      Total Items: {{ items.length }} | Showing: {{ filteredItems.length }}
    </div>

    <!-- Add/Edit Item Modal -->
    <div v-if="showAddItemForm" class="modal">
      <div class="modal-content">
        <h3>{{ editingItem ? 'Edit Item' : 'Add New Item' }}</h3>
        <form @submit.prevent="saveItem">
          <div v-for="field in fields" :key="field.id" class="form-group">
            <label>{{ field.name }}</label>
            <input
              v-if="field.type === 'text'"
              v-model="formData[field.name]"
              type="text"
            />
            <textarea
              v-else-if="field.type === 'textarea'"
              v-model="formData[field.name]"
              rows="3"
            ></textarea>
            <input
              v-else-if="field.type === 'number'"
              v-model.number="formData[field.name]"
              type="number"
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
            <button type="button" @click="cancelItemForm" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">{{ editingItem ? 'Update' : 'Add' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Fields Manager Modal -->
    <div v-if="showFieldsManager" class="modal">
      <div class="modal-content modal-large">
        <h3>Manage Fields</h3>
        
        <div class="fields-list">
          <div v-for="field in fields" :key="field.id" class="field-item">
            <span class="field-name">{{ field.name }}</span>
            <span class="field-type">{{ field.type }}</span>
            <button @click="deleteField(field.id)" class="btn-delete-small">🗑️</button>
          </div>
          <div v-if="fields.length === 0" class="no-fields">
            <p>No fields yet. Add your first field below.</p>
          </div>
        </div>

        <div class="add-field-form">
          <h4>Add New Field</h4>
          <div class="form-row">
            <input
              v-model="newField.name"
              type="text"
              placeholder="Field name"
              class="field-name-input"
            />
            <select v-model="newField.type" class="field-type-select">
              <option value="text">Text</option>
              <option value="textarea">Text Area</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
            </select>
            <button @click="addField" class="btn-add-field">Add</button>
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

        <div class="form-actions">
          <button @click="showFieldsManager = false" class="btn-save">Done</button>
        </div>
      </div>
    </div>

    <!-- Collection Settings Modal -->
    <div v-if="showCollectionSettings" class="modal">
      <div class="modal-content">
        <h3>Collection Settings</h3>
        
        <div class="settings-section">
          <h4>Rename Collection</h4>
          <input v-model="collectionName" type="text" class="settings-input" />
        </div>

        <div class="settings-section">
          <h4>Change Icon</h4>
          <div class="icon-picker">
            <button
              v-for="icon in iconOptions"
              :key="icon"
              :class="['icon-option', { selected: collectionIcon === icon }]"
              @click="collectionIcon = icon"
            >
              {{ icon }}
            </button>
          </div>
        </div>

        <div class="danger-zone">
          <h4>Danger Zone</h4>
          <button @click="confirmDeleteCollection" class="btn-danger">Delete Collection</button>
        </div>

        <div class="form-actions">
          <button @click="cancelSettings" class="btn-cancel">Cancel</button>
          <button @click="saveSettings" class="btn-save">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps<{
  collection: any
}>()

const emit = defineEmits(['collection-deleted'])

const fields = ref<any[]>([])
const items = ref<any[]>([])
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

const iconOptions = ['📁', '🎮', '📚', '🎬', '🎵', '🍳', '💪', '✈️', '📝', '💼', '🎨', '🔧', '🏠', '💰', '📊', '🎯']

const filteredItems = computed(() => {
  if (!searchQuery.value) return items.value

  const query = searchQuery.value.toLowerCase()
  return items.value.filter(item => {
    return Object.values(item.data).some(value =>
      String(value).toLowerCase().includes(query)
    )
  })
})

async function loadFields() {
  fields.value = await window.electronAPI.getFields(props.collection.id)
}

async function loadItems() {
  items.value = await window.electronAPI.getItems(props.collection.id)
}

async function addField() {
  if (!newField.value.name.trim()) return

  await window.electronAPI.addField({
    collectionId: props.collection.id,
    name: newField.value.name,
    type: newField.value.type,
    options: newField.value.type === 'select' ? newField.value.options : null,
    orderIndex: fields.value.length
  })

  await loadFields()
  newField.value = { name: '', type: 'text', options: '' }
}

async function deleteField(fieldId: number) {
  if (!confirm('Delete this field? All data in this field will be lost.')) return
  
  await window.electronAPI.deleteField(fieldId)
  await loadFields()
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
  if (editingItem.value) {
    await window.electronAPI.updateItem({
      id: editingItem.value.id,
      data: formData.value
    })
  } else {
    await window.electronAPI.addItem({
      collectionId: props.collection.id,
      data: formData.value
    })
  }

  await loadItems()
  cancelItemForm()
}

function editItem(item: any) {
  editingItem.value = item
  formData.value = { ...item.data }
  showAddItemForm.value = true
}

async function deleteItem(itemId: number) {
  if (!confirm('Delete this item?')) return
  
  await window.electronAPI.deleteItem(itemId)
  await loadItems()
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
  await window.electronAPI.updateCollection({
    id: props.collection.id,
    name: collectionName.value,
    icon: collectionIcon.value
  })
  
  showCollectionSettings.value = false
  window.location.reload() // Reload to update sidebar
}

async function confirmDeleteCollection() {
  if (!confirm(`Delete "${props.collection.name}" and all its data? This cannot be undone.`)) return
  
  await window.electronAPI.deleteCollection(props.collection.id)
  emit('collection-deleted')
}

watch(() => props.collection, () => {
  loadFields()
  loadItems()
  collectionName.value = props.collection.name
  collectionIcon.value = props.collection.icon
}, { immediate: true })

onMounted(() => {
  resetFormData()
  collectionName.value = props.collection.name
  collectionIcon.value = props.collection.icon
})
</script>

<style scoped>
.collection-view {
  padding: 30px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-right {
  display: flex;
  gap: 10px;
}

.header h2 {
  font-size: 32px;
  color: #2c3e50;
  margin: 0;
}

.btn-manage-fields {
  padding: 8px 16px;
  background: #f0f0f0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-manage-fields:hover {
  background: #e0e0e0;
}

.btn-add {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
}

.btn-add:hover {
  background: #5568d3;
}

.btn-settings {
  background: #f0f0f0;
  border: none;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 20px;
}

.btn-settings:hover {
  background: #e0e0e0;
}

.empty-fields {
  text-align: center;
  padding: 80px 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-fields h3 {
  font-size: 24px;
  color: #2c3e50;
  margin-bottom: 10px;
}

.empty-fields p {
  color: #666;
  margin-bottom: 20px;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
}

.search-bar {
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
}

.table-container {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
}

th {
  padding: 15px;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e0e0e0;
}

.actions-col {
  width: 100px;
}

td {
  padding: 15px;
  border-bottom: 1px solid #f0f0f0;
}

tr:hover {
  background: #f8f9fa;
}

.actions-cell {
  white-space: nowrap;
}

.btn-edit,
.btn-delete {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 5px 10px;
  opacity: 0.7;
}

.btn-edit:hover,
.btn-delete:hover {
  opacity: 1;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #999;
}

.stats {
  margin-top: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 800px;
}

.modal-content h3 {
  margin-top: 0;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 25px;
}

.btn-cancel,
.btn-save {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.btn-cancel {
  background: #e0e0e0;
  color: #666;
}

.btn-save {
  background: #667eea;
  color: white;
}

/* Fields Manager */
.fields-list {
  margin-bottom: 30px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  min-height: 100px;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 8px;
}

.field-name {
  flex: 1;
  font-weight: 600;
}

.field-type {
  color: #666;
  font-size: 14px;
  background: white;
  padding: 4px 12px;
  border-radius: 4px;
}

.btn-delete-small {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
}

.btn-delete-small:hover {
  opacity: 1;
}

.no-fields {
  text-align: center;
  color: #999;
  padding: 20px;
}

.add-field-form h4 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.form-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.field-name-input {
  flex: 2;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
}

.field-type-select {
  flex: 1;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: white;
}

.btn-add-field {
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.select-options {
  margin-top: 10px;
}

.options-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
}

/* Settings */
.settings-section {
  margin-bottom: 30px;
}

.settings-section h4 {
  margin-bottom: 10px;
  color: #2c3e50;
}

.settings-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.icon-picker {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}

.icon-option {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 24px;
  transition: all 0.2s;
}

.icon-option:hover {
  border-color: #667eea;
}

.icon-option.selected {
  border-color: #667eea;
  background: #f0f0ff;
}

.danger-zone {
  margin-top: 40px;
  padding-top: 30px;
  border-top: 2px solid #ffebee;
}

.danger-zone h4 {
  color: #d32f2f;
  margin-bottom: 15px;
}

.btn-danger {
  background: #d32f2f;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-danger:hover {
  background: #b71c1c;
}
</style>