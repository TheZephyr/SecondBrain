<template>
  <div class="flex h-12 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4">
    <div class="flex min-w-0 items-center gap-2 text-sm">
      <span class="text-[var(--text-muted)]">Collections</span>
      <span class="text-[var(--text-muted)]">/</span>
      <span class="min-w-0 truncate text-[var(--text-primary)]">
        {{ selectedCollection?.name || '' }}
      </span>
      <span class="text-[var(--text-muted)]">/</span>
      <span class="min-w-0 truncate text-[var(--text-primary)]">
        {{ activeViewName }}
      </span>
    </div>

    <div class="flex items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-0.5">
      <Button text class="h-8 px-3 text-xs font-semibold"
        :class="activeCollectionPanel === 'data' ? activeButtonClass : inactiveButtonClass" :aria-pressed="activeCollectionPanel === 'data'"
        @click="setPanel('data')">
        Data
      </Button>
      <Button text class="h-8 px-3 text-xs font-semibold"
        :class="activeCollectionPanel === 'fields' ? activeButtonClass : inactiveButtonClass" :aria-pressed="activeCollectionPanel === 'fields'"
        @click="setPanel('fields')">
        Fields
      </Button>
    </div>

    <Button text class="h-8 gap-2 px-3 text-xs font-semibold"
      :class="collectionSettingsOpen ? activeButtonClass : inactiveButtonClass" :aria-pressed="collectionSettingsOpen"
      @click="toggleSettings">
      <Settings2 :size="14" />
      Collection Settings
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from '../../store'
import { Settings2 } from 'lucide-vue-next'
import Button from 'primevue/button'

const store = useStore()
const {
  selectedCollection,
  activeCollectionPanel,
  collectionSettingsOpen,
  currentViews,
  activeViewId
} = storeToRefs(store)

const activeButtonClass = 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
const inactiveButtonClass = 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'

const activeViewName = computed(() => {
  if (collectionSettingsOpen.value) {
    return 'Settings'
  }
  if (activeCollectionPanel.value === 'fields') {
    return 'Fields'
  }
  const activeView = currentViews.value.find(view => view.id === activeViewId.value)
  return activeView?.name ?? 'View'
})

function setPanel(panel: 'data' | 'fields') {
  store.setActiveCollectionPanel(panel)
  store.setCollectionSettingsOpen(false)
}

function toggleSettings() {
  store.setCollectionSettingsOpen(!collectionSettingsOpen.value)
}
</script>
