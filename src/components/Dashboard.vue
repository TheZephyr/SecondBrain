<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>🏠 Dashboard</h1>
      <p class="subtitle">Welcome to your Second Brain</p>
    </div>

    <div v-if="collections.length === 0" class="empty-state">
      <div class="empty-icon">📦</div>
      <h2>No Collections Yet</h2>
      <p>Get started by creating your first collection!</p>
      <p class="hint">Click "➕ New Collection" in the sidebar to begin</p>
    </div>

    <div v-else class="collections-grid">
      <div
        v-for="collection in collectionsWithStats"
        :key="collection.id"
        class="collection-card"
        @click="$emit('select-collection', collection)"
      >
        <div class="card-icon">{{ collection.icon }}</div>
        <div class="card-content">
          <h3>{{ collection.name }}</h3>
          <p class="item-count">{{ collection.itemCount }} items</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps<{
  collections: any[]
}>()

defineEmits(['select-collection'])

const collectionStats = ref<Map<number, number>>(new Map())

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
}

.dashboard-header h1 {
  font-size: 36px;
  color: #2c3e50;
  margin-bottom: 10px;
}

.subtitle {
  font-size: 18px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 100px 40px;
  color: #999;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.empty-state h2 {
  font-size: 28px;
  color: #666;
  margin-bottom: 10px;
}

.empty-state p {
  font-size: 16px;
  margin-bottom: 8px;
}

.hint {
  color: #999;
  font-style: italic;
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.collection-card {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 20px;
}

.collection-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.card-icon {
  font-size: 48px;
  min-width: 48px;
}

.card-content {
  flex: 1;
}

.card-content h3 {
  font-size: 20px;
  color: #2c3e50;
  margin-bottom: 8px;
}

.item-count {
  font-size: 14px;
  color: #999;
}
</style>