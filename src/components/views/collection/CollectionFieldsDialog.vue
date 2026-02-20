<template>
  <div class="flex h-full flex-col">
    <div class="space-y-6">
      <DataTable :value="orderedFields" dataKey="id" reorderableRows @row-reorder="onRowReorder">
        <Column rowReorder headerStyle="width: 3rem" />
        <Column field="name" header="Field" />
        <Column header="Type">
          <template #body="{ data }">
            <Tag class="uppercase">{{ data.type }}</Tag>
          </template>
        </Column>
        <Column header="Actions" style="width: 120px">
          <template #body="{ data }">
            <Button text class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[rgba(239,68,68,0.12)]" title="Delete field"
              @click="$emit('delete-field', data)">
              <Trash2 />
            </Button>
          </template>
        </Column>
      </DataTable>

      <div ref="addFieldSectionRef" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
        <div class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          <Plus :size="14" />
          Add New Field
        </div>
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <InputText ref="addFieldNameRef" v-model="newField.name" type="text" placeholder="Field name" class="flex-1" />
          <Select v-model="newField.type" :options="fieldTypeOptions" optionLabel="label" optionValue="value"
            class="w-full md:w-48" />
          <Button class="md:self-stretch" @click="submitAddField">Add</Button>
        </div>
        <div v-if="newField.type === 'select'" class="mt-3">
          <InputText v-model="newField.options" type="text" placeholder="Options (comma-separated: Option1, Option2)" />
        </div>
      </div>
    </div>

    <div class="mt-6 flex justify-end">
      <Button @click="$emit('update:visible', false)">Done</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import type { Field, FieldType } from '../../../types/models'
import type { FieldDraftInput } from './types'

type RowReorderEvent = { value: Field[] }

const props = defineProps<{
  visible: boolean
  orderedFields: Field[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'add-field', value: FieldDraftInput): void
  (e: 'delete-field', value: Field): void
  (e: 'reorder-fields', value: Field[]): void
}>()

const fieldTypeOptions: Array<{ label: string; value: FieldType }> = [
  { label: 'Text', value: 'text' },
  { label: 'Text Area', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Select', value: 'select' }
]

function createEmptyFieldDraft(): FieldDraftInput {
  return {
    name: '',
    type: 'text',
    options: ''
  }
}

const newField = ref<FieldDraftInput>(createEmptyFieldDraft())
const addFieldSectionRef = ref<HTMLElement | null>(null)
const addFieldNameRef = ref<unknown>(null)

watch(
  () => newField.value.type,
  type => {
    if (type !== 'select') {
      newField.value.options = ''
    }
  }
)

watch(
  () => props.visible,
  isVisible => {
    if (!isVisible) {
      newField.value = createEmptyFieldDraft()
    }
  }
)

function submitAddField() {
  emit('add-field', { ...newField.value })
  newField.value = createEmptyFieldDraft()
}

function onRowReorder(event: RowReorderEvent) {
  if (!event.value) return
  emit('reorder-fields', event.value)
}

function focusAddField() {
  addFieldSectionRef.value?.scrollIntoView({
    block: 'center',
    behavior: 'smooth'
  })

  const raw = addFieldNameRef.value as { $el?: HTMLElement } | HTMLElement | null | undefined
  const element = (raw && (raw as { $el?: HTMLElement }).$el) ? (raw as { $el?: HTMLElement }).$el : raw
  if (!element) return

  if (element instanceof HTMLElement) {
    if (typeof element.focus === 'function') {
      element.focus()
      return
    }

    const input = element.querySelector?.('input,textarea,select,button') as HTMLElement | null
    input?.focus()
  }
}

defineExpose({ focusAddField })
</script>
