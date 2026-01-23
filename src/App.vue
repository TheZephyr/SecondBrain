<template>
  <div id="app">
    <div class="app-container">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h1>🧠 Second Brain</h1>
          <p class="subtitle">Your Personal Organizer</p>
        </div>

        <nav class="nav-menu">
          <button
            :class="['nav-item', { active: currentView === 'dashboard' }]"
            @click="currentView = 'dashboard'"
          >
            <span class="nav-icon">🏠</span>
            <span class="nav-label">Dashboard</span>
          </button>

          <div class="nav-separator"></div>

          <button
            v-for="collection in collections"
            :key="collection.id"
            :class="['nav-item', { active: currentView === 'collection-' + collection.id }]"
            @click="selectCollection(collection)"
          >
            <span class="nav-icon">{{ collection.icon }}</span>
            <span class="nav-label">{{ collection.name }}</span>
          </button>

          <button class="nav-item nav-add" @click="showNewCollectionModal = true">
            <span class="nav-icon">➕</span>
            <span class="nav-label">New Collection</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <p>v0.2.0</p>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div class="content-wrapper">
          <Dashboard 
            v-if="currentView === 'dashboard'" 
            :collections="collections"
            @select-collection="selectCollection"
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
    <div v-if="showNewCollectionModal" class="modal">
      <div class="modal-content">
        <h3>Create New Collection</h3>
        <form @submit.prevent="createCollection">
          <div class="form-group">
            <label>Collection Name *</label>
            <input v-model="newCollection.name" type="text" required placeholder="My Collection" />
          </div>

          <div class="form-group">
            <label>Icon</label>
            <div class="icon-picker">
              <button
                v-for="icon in iconOptions"
                :key="icon"
                type="button"
                :class="['icon-option', { selected: newCollection.icon === icon }]"
                @click="newCollection.icon = icon"
              >
                {{ icon }}
              </button>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="cancelNewCollection" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">Create</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Dashboard from './components/Dashboard.vue'
import CollectionView from './components/CollectionView.vue'

const currentView = ref('dashboard')
const collections = ref<any[]>([])
const selectedCollection = ref<any>(null)
const showNewCollectionModal = ref(false)

const newCollection = ref({
  name: '',
  icon: '📁'
})

const iconOptions = ['📁', '🎮', '📚', '🎬', '🎵', '🍳', '💪', '✈️', '📝', '💼', '🎨', '🔧', '🏠', '💰', '📊', '🎯']

async function loadCollections() {
  collections.value = await window.electronAPI.getCollections()
}

function selectCollection(collection: any) {
  selectedCollection.value = collection
  currentView.value = 'collection-' + collection.id
}

async function createCollection() {
  if (!newCollection.value.name.trim()) return
  
  const created = await window.electronAPI.addCollection({
    name: newCollection.value.name,
    icon: newCollection.value.icon
  })
  
  await loadCollections()
  showNewCollectionModal.value = false
  newCollection.value = { name: '', icon: '📁' }
  
  // Auto-select the newly created collection
  selectCollection(created)
}

function cancelNewCollection() {
  showNewCollectionModal.value = false
  newCollection.value = { name: '', icon: '📁' }
}

function handleCollectionDeleted() {
  loadCollections()
  currentView.value = 'dashboard'
  selectedCollection.value = null
}

onMounted(() => {
  loadCollections()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
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
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  padding: 30px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h1 {
  font-size: 28px;
  margin-bottom: 5px;
}

.subtitle {
  font-size: 14px;
  opacity: 0.8;
}

.nav-menu {
  flex: 1;
  padding: 20px 0;
  overflow-y: auto;
}

.nav-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 10px 20px;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px 25px;
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  border-left: 3px solid transparent;
  text-align: left;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  border-left-color: white;
  font-weight: 600;
}

.nav-add {
  margin-top: 10px;
  opacity: 0.8;
}

.nav-add:hover {
  opacity: 1;
}

.nav-icon {
  font-size: 24px;
  min-width: 24px;
}

.nav-label {
  font-size: 16px;
}

.sidebar-footer {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  opacity: 0.6;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Main Content */
.main-content {
  flex: 1;
  overflow: auto;
  background: #f5f5f5;
}

.content-wrapper {
  min-height: 100%;
}

/* Modal */
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
  max-width: 500px;
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
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

.form-group input {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
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
  transform: scale(1.1);
}

.icon-option.selected {
  border-color: #667eea;
  background: #f0f0ff;
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

.btn-save:hover {
  background: #5568d3;
}
</style>