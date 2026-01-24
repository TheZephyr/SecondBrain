<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <div>
        <h1>Dashboard</h1>
        <p class="subtitle">Welcome to your Second Brain</p>
      </div>
    </div>

    <div v-if="collections.length === 0" class="empty-state">
      <div class="empty-icon">
        <FolderOpen :size="64" :stroke-width="1.5" />
      </div>
      <h2>No Collections Yet</h2>
      <p>Get started by creating your first collection</p>
      <p class="hint">Click "New Collection" in the sidebar to begin</p>
    </div>

    <div v-else class="collections-grid">
      <div
        v-for="collection in collectionsWithStats"
        :key="collection.id"
        class="collection-card"
        @click="$emit('select-collection', collection)"
      >
        <div class="card-icon">
          <component :is="getIcon(collection.icon)" :size="32" :stroke-width="1.5" />
        </div>
        <div class="card-content">
          <h3>{{ collection.name }}</h3>
          <div class="card-stats">
            <Database :size="14" />
            <span>{{ collection.itemCount }} items</span>
          </div>
        </div>
        <div class="card-arrow">
          <ChevronRight :size="20" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { 
  FolderOpen, Database, ChevronRight,
  Folder, Gamepad2, Book, Film, Music, 
  ChefHat, Dumbbell, Plane, FileText, 
  Briefcase, Palette, Wrench, Home, 
  DollarSign, BarChart3, Target
} from 'lucide-vue-next'

const props = defineProps<{
  collections: any[]
}>()

defineEmits(['select-collection'])

const collectionStats = ref<Map<number, number>>(new Map())

const iconMap: any = {
  folder: Folder,
  gamepad2: Gamepad2,
  book: Book,
  film: Film,
  music: Music,
  chefhat: ChefHat,
  dumbbell: Dumbbell,
  plane: Plane,
  filetext: FileText,
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

const collectionsWithStats = computed(() => {
  return props.collections.map(collection => ({
    ...collection,
    itemCount: collectionStats.value.get(collection.id) || 0
  }))
})

async function loadStats() {
  for (const collection of props.collections) {
    const items = await window.electronAPI.getItems(collection.id)
    collectionStats.value.set(collection.id, items.length)
  }
}

watch(() => props.collections, () => {
  loadStats()
}, { immediate: true })

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.dashboard {
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: 100px 40px;
  color: var(--text-muted);
}

.empty-icon {
  color: var(--text-muted);
  margin-bottom: 24px;
  opacity: 0.5;
}

.empty-state h2 {
  font-size: 24px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  font-weight: 600;
}

.empty-state p {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--text-muted);
}

.hint {
  font-size: 13px !important;
  font-style: italic;
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.collection-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 16px;
}

.collection-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-primary);
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.1);
}

.card-icon {
  width: 56px;
  height: 56px;
  background: var(--accent-light);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.card-arrow {
  color: var(--text-muted);
  opacity: 0;
  transition: all 0.2s;
}

.collection-card:hover .card-arrow {
  opacity: 1;
  transform: translateX(4px);
}
</style>