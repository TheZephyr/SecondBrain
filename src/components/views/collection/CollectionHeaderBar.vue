<template>
  <Toolbar class="mb-6">
    <template #start>
      <div class="flex items-center gap-4">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent-primary)]">
          <component :is="getIcon(collection.icon)" :size="26" />
        </div>
        <div>
          <h2 class="text-2xl font-semibold text-[var(--text-primary)]">
            {{ collection.name }}
          </h2>
        </div>
      </div>
    </template>
    <template #end>
      <div class="flex items-center gap-2">
        <Button text title="Manage Fields" @click="$emit('open-fields')">
          <Settings />
          Manage fields
        </Button>
        <Button @click="$emit('open-add-item')">
          <Plus />
          Add Item
        </Button>
        <Button text title="Collection Settings" @click="$emit('open-settings')">
          <MoreVertical />
          More
        </Button>
      </div>
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
import { Settings, Plus, MoreVertical } from 'lucide-vue-next'
import Toolbar from 'primevue/toolbar'
import Button from 'primevue/button'
import type { Collection } from '../../../types/models'
import { useIcons } from '../../../composables/useIcons'

defineProps<{
  collection: Collection
}>()

defineEmits<{
  (e: 'open-fields'): void
  (e: 'open-add-item'): void
  (e: 'open-settings'): void
}>()

const { getIcon } = useIcons()
</script>
