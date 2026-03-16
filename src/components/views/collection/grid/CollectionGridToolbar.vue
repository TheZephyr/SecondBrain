<template>
  <div class="flex h-10 items-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 py-5">
    <div class="flex items-center gap-1">
      <Button text
        class="h-7 gap-1.5 rounded-md px-2 text-base text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <i class="pi pi-filter text-base"></i>
        <span>Filter</span>
      </Button>
      <Button text class="h-7 gap-1.5 rounded-md px-2 text-base" :class="sortButtonClass">
        <i class="pi pi-sort-alt text-base"></i>
        <span>Sort</span>
      </Button>
    </div>

    <div class="flex-1"></div>

    <div class="relative">
      <Search :size="16"
        class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <InputText v-model="searchModel" class="h-7 w-40 pl-8 text-base md:w-52" type="text" placeholder="Search..." />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Search } from 'lucide-vue-next'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import type { MultiSortMeta } from '../types'

const props = defineProps<{
  multiSortMeta: MultiSortMeta[]
  searchQuery: string
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
}>()

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

const sortButtonClass = computed(() => {
  if (props.multiSortMeta.length > 0) {
    return 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
  }

  return 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
})
</script>
