<template>
  <div class="mb-4 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
    <div class="flex h-12 items-center justify-between border-b border-[var(--border-color)] px-4">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-[var(--text-muted)]">Collections</span>
        <span class="text-[var(--text-muted)]">/</span>
        <span class="font-semibold text-[var(--text-primary)]">
          {{ collection.name }}
        </span>
        <span class="text-[var(--text-muted)]">/</span>
        <span class="font-semibold text-[var(--text-primary)]">
          {{ activeViewName }}
        </span>
      </div>

      <div class="flex items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-0.5">
        <button type="button"
          class="flex items-center gap-1.5 rounded-md bg-[var(--accent-light)] px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
          <LayoutGrid :size="14" />
          {{ activeViewName }}
        </button>
      </div>
    </div>

    <div class="flex h-10 items-center justify-between px-4">
      <div class="flex items-center gap-2">
        <Button text class="h-8 gap-2"
          :class="fieldsOpen ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
          :aria-pressed="fieldsOpen" @click="$emit('toggle-fields')">
          <Columns :size="16" />
          Fields
        </Button>
        <Button text class="h-8 gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          @click="notifyComingSoon">
          <Filter :size="16" />
          Filter
        </Button>
        <Button text class="h-8 gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          @click="notifyComingSoon">
          <ArrowUpDown :size="16" />
          Sort
        </Button>
        <Button text class="h-8 gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          @click="notifyComingSoon">
          <Rows3 :size="16" />
          Group
        </Button>
      </div>

      <div class="flex items-center gap-2">
        <Button class="h-8 gap-2" @click="$emit('open-add-item')">
          <Plus :size="16" />
          Add Item
        </Button>
        <div class="relative">
          <Search :size="16"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <InputText v-model="searchModel" class="h-8 w-52 pl-8 text-sm" type="text" placeholder="Search..." />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from '../../../store'
import {
  LayoutGrid,
  Columns,
  Filter,
  ArrowUpDown,
  Rows3,
  Search,
  Plus
} from 'lucide-vue-next'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import type { Collection } from '../../../types/models'

const props = defineProps<{
  collection: Collection
  searchQuery: string
  fieldsOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'open-add-item'): void
  (e: 'toggle-fields'): void
  (e: 'update:searchQuery', value: string): void
}>()

const toast = useToast()
const store = useStore()
const { currentViews, activeViewId } = storeToRefs(store)

const activeViewName = computed(() => {
  const activeView = currentViews.value.find(
    (view) => view.id === activeViewId.value
  )
  if (activeView) {
    return activeView.name
  }
  if (currentViews.value.length > 0) {
    return currentViews.value[0].name
  }
  return 'Grid'
})

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

function notifyComingSoon() {
  toast.add({
    severity: 'info',
    summary: 'Coming soon',
    life: 2000
  })
}
</script>
