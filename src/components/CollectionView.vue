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
              <button @click="deleteItem(item.id)" class="btn-icon-small danger" title="Delete">
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
              <button @click="deleteField(field.id)" class="btn-icon-small danger" title="Delete field">
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
                @click="$event.target.focus()"
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Settings, Plus, MoreVertical, Columns, Search,
  Pencil, Trash2, X, FileText, Database,
  GripVertical, AlertTriangle,
  Folder, Gamepad2, Book, Film, Music, 
  ChefHat, Dumbbell, Plane, 
  Briefcase, Palette, Wrench, Home, 
  DollarSign, BarChart3, Target
} from 'lucide-vue-next'

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
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const iconOptions = [
  { value: 'folder', component: Folder },
  { value: 'gamepad2', component: Gamepad2 },
  { value: 'book', component: Book },
  { value: 'film', component: Film },
  { value: 'music', component: Music },
  { value: 'chefhat', component: ChefHat },
  { value: 'dumbbell', component: Dumbbell },
  { value: 'plane', component: Plane },
  { value: 'briefcase', component: Briefcase },
  { value: 'palette', component: Palette },
  { value: 'wrench', component: Wrench },
  { value: 'home', component: Home },
  { value: 'dollarsign', component: DollarSign },
  { value: 'barchart3', component: BarChart3 },
  { value: 'target', component: Target }
]

const iconMap: any = {
  folder: Folder,
  gamepad2: Gamepad2,
  book: Book,
  film: Film,
  music: Music,
  chefhat: ChefHat,
  dumbbell: Dumbbell,
  plane: Plane,
  briefcase: Briefcase,
  palette: Palette,
  wrench: Wrench,
  home: Home,
  dollarsign: DollarSign,
  barchart3: BarChart3,
  target: Target
}

function getIcon(iconName: string) {
  return iconMap[iconName] || Folder
}

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
  const plainData = JSON.parse(JSON.stringify(formData.value))
  
  if (editingItem.value) {
    await window.electronAPI.updateItem({
      id: editingItem.value.id,
      data: plainData
    })
  } else {
    await window.electronAPI.addItem({
      collectionId: props.collection.id,
      data: plainData
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
  window.location.reload()
}

async function confirmDeleteCollection() {
  if (!confirm(`Delete "${props.collection.name}" and all its data? This cannot be undone.`)) return
  
  await window.electronAPI.deleteCollection(props.collection.id)
  emit('collection-deleted')
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
    await window.electronAPI.updateField({
      ...reorderedFields[i],
      orderIndex: i
    })
  }

  await loadFields()
  handleDragEnd()
}

watch(() => props.collection, () => {
  loadFields()
  loadItems()
  collectionName.value = props.collection.name
  collectionIcon.value = props.collection.icon
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
  collectionName.value = props.collection.name
  collectionIcon.value = props.collection.icon
})
</script>

<style src="./CollectionView.css" scoped></style>