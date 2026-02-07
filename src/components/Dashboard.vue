<template>
  <div class="mx-auto max-w-6xl px-10 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-semibold text-[var(--text-primary)]">Dashboard</h1>
      <p class="mt-2 text-sm text-[var(--text-muted)]">Welcome to your Second Brain</p>
    </div>

    <div
      v-if="collections.length === 0"
      class="flex flex-col items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-10 py-20 text-center"
    >
      <FolderOpen :size="64" :stroke-width="1.5" class="mb-6 text-[var(--text-muted)]" />
      <h2 class="text-xl font-semibold text-[var(--text-secondary)]">No Collections Yet</h2>
      <p class="mt-2 text-sm text-[var(--text-muted)]">
        Get started by creating your first collection
      </p>
      <p class="mt-1 text-xs italic text-[var(--text-muted)]">
        Click "New Collection" in the sidebar to begin
      </p>
    </div>

    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="collection in collectionsWithStats"
        :key="collection.id"
        class="cursor-pointer border border-[var(--border-color)] bg-[var(--bg-secondary)] transition hover:-translate-y-0.5 hover:border-[var(--accent-primary)] hover:shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
        @click="$emit('select-collection', collection)"
      >
        <template #content>
          <div class="flex items-center gap-4">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent-primary)]"
            >
              <component :is="getIcon(collection.icon)" :size="28" :stroke-width="1.5" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-base font-semibold text-[var(--text-primary)]">
                {{ collection.name }}
              </h3>
              <div class="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Database :size="14" />
                <span>{{ collection.itemCount }} items</span>
              </div>
            </div>
            <ChevronRight :size="20" class="text-[var(--text-muted)]" />
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from '../store'
import {
  FolderOpen, Database, ChevronRight
} from 'lucide-vue-next'
import Card from 'primevue/card'
import { useIcons } from '../composables/useIcons'

const { getIcon } = useIcons()
const store = useStore()
const { collections } = storeToRefs(store)

defineEmits(['select-collection'])

const collectionStats = ref<Map<number, number>>(new Map())

const collectionsWithStats = computed(() => {
  return collections.value.map(collection => ({
    ...collection,
    itemCount: collectionStats.value.get(collection.id) || 0
  }))
})

async function loadStats() {
  for (const collection of collections.value) {
    // This is a temporary solution to get the item count.
    // A better approach would be to have a dedicated API endpoint for this.
    const items = await window.electronAPI.getItems(collection.id)
    collectionStats.value.set(collection.id, items.length)
  }
}

onMounted(() => {
  loadStats()
})

watch(collections, () => {
  loadStats()
}, { immediate: true })
</script>
