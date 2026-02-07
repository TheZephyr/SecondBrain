<template>
  <div class="h-screen w-full">
    <div class="flex h-full overflow-hidden">
      <aside class="flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div class="border-b border-[var(--border-color)] p-5">
          <div class="flex items-center gap-3 text-[var(--accent-primary)]">
            <Brain :size="32" />
            <div>
              <h1 class="text-base font-semibold text-[var(--text-primary)]">Second Brain</h1>
              <p class="text-xs text-[var(--text-muted)]">Personal Organizer</p>
            </div>
          </div>
        </div>

        <nav class="flex-1 space-y-2 overflow-y-auto px-2 py-3">
          <Button text class="w-full justify-start gap-3 rounded-md px-3 py-2 text-sm" :class="currentView === 'dashboard'
            ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
            @click="showDashboard">
            <template #icon>
              <LayoutDashboard :size="18" />
            </template>
            <span>Dashboard</span>
          </Button>

          <div class="h-px bg-[var(--border-color)]/70"></div>
          <div class="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Collections
          </div>

          <Button v-for="collection in collections" :key="collection.id" text
            class="w-full justify-start gap-3 rounded-md px-3 py-2 text-sm" :class="currentView === 'collection-' + collection.id
              ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
            @click="handleSelectCollection(collection)">
            <template #icon>
              <component :is="getIcon(collection.icon)" :size="18" />
            </template>
            <span class="truncate">{{ collection.name }}</span>
          </Button>

          <Button outlined
            class="w-full justify-start gap-3 rounded-md border-dashed px-3 py-2 text-sm text-[var(--text-muted)]"
            @click="showNewCollectionModal = true">
            <template #icon>
              <Plus :size="18" />
            </template>
            <span>New Collection</span>
          </Button>
        </nav>

        <div class="border-t border-[var(--border-color)] p-4 text-center text-[11px] text-[var(--text-muted)]">
          v{{ appVersion }}
        </div>
      </aside>

      <main class="flex-1 overflow-auto bg-[var(--bg-primary)]">
        <div class="min-h-full">
          <Dashboard v-if="currentView === 'dashboard'" :collections="collections"
            @select-collection="handleSelectCollection" />
          <CollectionView v-else-if="selectedCollection" :collection="selectedCollection"
            @collection-deleted="handleCollectionDeleted" />
        </div>
      </main>
    </div>

    <Dialog v-model:visible="showNewCollectionModal" header="Create New Collection" modal :draggable="false"
      class="max-w-xl" @hide="cancelNewCollection">
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-xs font-medium text-[var(--text-secondary)]">Collection Name *</label>
          <InputText v-model="newCollection.name" type="text" placeholder="My Collection" autofocus />
        </div>

        <div class="space-y-2">
          <label class="text-xs font-medium text-[var(--text-secondary)]">Icon</label>
          <Listbox v-model="newCollection.icon" :options="iconOptions" optionLabel="label" optionValue="value"
            :pt="iconListboxPt">
            <template #option="{ option }">
              <div class="flex flex-col items-center gap-1">
                <component :is="option.component" :size="20" />
                <span class="text-[11px]">{{ option.label }}</span>
              </div>
            </template>
          </Listbox>
        </div>
      </div>

      <template #footer>
        <Button severity="secondary" text @click="cancelNewCollection">Cancel</Button>
        <Button @click="createCollection">Create Collection</Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from './store'
import {
  Brain, LayoutDashboard, Plus
} from 'lucide-vue-next'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Listbox from 'primevue/listbox'
import Dashboard from './components/views/Dashboard.vue'
import CollectionView from './components/views/CollectionView.vue'
import { useIcons } from './composables/useIcons'

const { iconOptions, getIcon } = useIcons()
const store = useStore()
const { collections, selectedCollection } = storeToRefs(store)

const appVersion = __APP_VERSION__

const currentView = ref('dashboard')
const showNewCollectionModal = ref(false)

const newCollection = ref({
  name: '',
  icon: 'folder'
})

const iconListboxPt = {
  root: {
    class:
      'rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)]'
  },
  list: {
    class: 'grid grid-cols-3 gap-2 p-2'
  },
  item: ({ context }: { context: { selected: boolean } }) => ({
    class: [
      'flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition',
      context.selected
        ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
        : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]'
    ].join(' ')
  })
}

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
