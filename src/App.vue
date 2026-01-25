<template>
  <div id="app">
    <div class="app-container">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <Brain :size="32" />
            <div>
              <h1>Second Brain</h1>
              <p class="subtitle">Personal Organizer</p>
            </div>
          </div>
        </div>

        <nav class="nav-menu">
          <button
            :class="['nav-item', { active: currentView === 'dashboard' }]"
            @click="showDashboard"
          >
            <LayoutDashboard :size="20" />
            <span class="nav-label">Dashboard</span>
          </button>

          <div class="nav-separator"></div>

          <div class="nav-section-title">Collections</div>

          <button
            v-for="collection in collections"
            :key="collection.id"
            :class="['nav-item', { active: currentView === 'collection-' + collection.id }]"
            @click="handleSelectCollection(collection)"
          >
            <component :is="getIcon(collection.icon)" :size="20" />
            <span class="nav-label">{{ collection.name }}</span>
          </button>

          <button class="nav-item nav-add" @click="showNewCollectionModal = true">
            <Plus :size="20" />
            <span class="nav-label">New Collection</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <p>v{{ __APP_VERSION__ }}</p>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div class="content-wrapper">
          <Dashboard 
            v-if="currentView === 'dashboard'" 
            :collections="collections"
            @select-collection="handleSelectCollection"
          />
          <CollectionView 
            v-else-if="selectedCollection"
            :collection="selectedCollection"
            @collection-deleted="handleCollectionDeleted"
          />
        </div>
      </main>
    </div>

    <!-- New Collection Modal -->
    <div v-if="showNewCollectionModal" class="modal-overlay" @click.self="cancelNewCollection">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create New Collection</h3>
          <button @click="cancelNewCollection" class="btn-close">
            <X :size="20" />
          </button>
        </div>
        
        <form @submit.prevent="createCollection">
          <div class="form-group">
            <label>Collection Name *</label>
            <input v-model="newCollection.name" type="text" required placeholder="My Collection" autofocus />
          </div>

          <div class="form-group">
            <label>Icon</label>
            <div class="icon-picker">
              <button
                v-for="icon in iconOptions"
                :key="icon.value"
                type="button"
                :class="['icon-option', { selected: newCollection.icon === icon.value }]"
                @click="newCollection.icon = icon.value"
                :title="icon.label"
              >
                <component :is="icon.component" :size="24" />
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="cancelNewCollection" class="btn-secondary">Cancel</button>
            <button type="submit" class="btn-primary">Create Collection</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from './store'
import { 
  Brain, LayoutDashboard, Plus, X
} from 'lucide-vue-next'
import Dashboard from './components/Dashboard.vue'
import CollectionView from './components/CollectionView.vue'
import { useIcons } from './composables/useIcons'

const { iconOptions, getIcon } = useIcons()
const store = useStore()
const { collections, selectedCollection } = storeToRefs(store)

const currentView = ref('dashboard')
const showNewCollectionModal = ref(false)

const newCollection = ref({
  name: '',
  icon: 'folder'
})

function handleSelectCollection(collection: any) {
  store.selectCollection(collection)
  currentView.value = `collection-${collection.id}`
}

function showDashboard() {
  store.selectCollection(null)
  currentView.value = 'dashboard'
}

async function createCollection() {
  if (!newCollection.value.name.trim()) return
  
  const created = await store.addCollection({
    name: newCollection.value.name,
    icon: newCollection.value.icon
  })
  
  showNewCollectionModal.value = false
  newCollection.value = { name: '', icon: 'folder' }
  
  if (created) {
    handleSelectCollection(created)
  }
}

function cancelNewCollection() {
  showNewCollectionModal.value = false
  newCollection.value = { name: '', icon: 'folder' }
}

function handleCollectionDeleted() {
  showDashboard()
}

onMounted(() => {
  store.loadCollections()
})
</script>

<style>
:root {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #242424;
  --bg-hover: #2a2a2a;
  --border-color: #333;
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent-primary: #8b5cf6;
  --accent-hover: #7c3aed;
  --accent-light: rgba(139, 92, 246, 0.1);
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--accent-primary);
}

.logo h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.subtitle {
  font-size: 12px;
  color: var(--text-muted);
}

.nav-menu {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}

.nav-menu::-webkit-scrollbar {
  width: 6px;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.nav-section-title {
  padding: 12px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.nav-separator {
  height: 1px;
  background: var(--border-color);
  margin: 8px 12px;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 6px;
  text-align: left;
  margin-bottom: 2px;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-light);
  color: var(--accent-primary);
}

.nav-add {
  margin-top: 8px;
  color: var(--text-muted);
  border: 1px dashed var(--border-color);
}

.nav-add:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: var(--accent-light);
}

.nav-label {
  font-size: 14px;
  flex: 1;
}

.sidebar-footer {
  padding: 16px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
}

/* Main Content */
.main-content {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
}

.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.content-wrapper {
  min-height: 100%;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-content form {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: var(--bg-primary);
}

.icon-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.icon-option {
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.icon-option:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  transform: scale(1.05);
}

.icon-option.selected {
  border-color: var(--accent-primary);
  background: var(--accent-light);
  color: var(--accent-primary);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>