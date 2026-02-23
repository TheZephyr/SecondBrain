<template>
  <div
    class="grid items-center border-b border-[var(--border-color)] text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)]"
    :class="isAdding ? 'cursor-wait opacity-60' : 'cursor-pointer'"
    :style="{ gridTemplateColumns }"
    @click="onAddRow"
  >
    <div class="flex h-9 items-center justify-end border-r border-[var(--border-color)] pr-2">
      <Plus :size="14" />
    </div>
    <div
      v-for="field in orderedFields"
      :key="field.id"
      class="flex h-9 items-center border-r border-[var(--border-color)]"
    >
      <div class="h-9 w-full"></div>
    </div>
    <div class="flex h-9 items-center"></div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import type { Field } from '../../../../types/models'
import { useStore } from '../../../../store'
import {
  buildItemDataFromForm,
  createDefaultItemFormData
} from '../../../../composables/collection/useCollectionItemForm'
import { gridEditingKey } from './types'

const props = defineProps<{
  gridTemplateColumns: string
  orderedFields: Field[]
}>()

const store = useStore()
const editing = inject(gridEditingKey)
const isAdding = ref(false)

if (!editing) {
  throw new Error('Grid editing context not provided')
}

const editingContext = editing

async function onAddRow() {
  if (isAdding.value) return
  if (props.orderedFields.length === 0) return
  const collectionId = store.selectedCollection?.id
  if (!collectionId) return

  isAdding.value = true
  try {
    const formData = createDefaultItemFormData(props.orderedFields)
    const data = buildItemDataFromForm(formData, props.orderedFields)
    const created = await store.addItem({ collectionId, data })
    if (!created) return

    const firstField = props.orderedFields[0]
    if (!firstField) return
    editingContext.startEdit(created.id, firstField.name)
  } finally {
    isAdding.value = false
  }
}
</script>
