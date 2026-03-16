<template>
  <div class="mx-auto px-4 py-4 space-y-4 max-h-100vh overflow-y-auto text-base">
    <DataTable :value="orderedFields" dataKey="id" reorderableRows v-model:expandedRows="expandedRows"
      @row-reorder="onRowReorder">
      <Column rowReorder headerStyle="width: 3rem" />
      <Column field="name" header="Field">
        <template #body="{ data }">
          <span>{{ data.name }}</span>
        </template>
      </Column>
      <Column header="Type">
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <Tag>
              <component :is="iconMap[FIELD_TYPE_META[data.type as FieldType].icon]" :size="12"
                class="text-[var(--text-primary)]" />
              <span>{{ FIELD_TYPE_META[data.type as FieldType].displayName }}</span>
            </Tag>
          </div>
        </template>
      </Column>
      <Column header="Actions" style="width: 140px">
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <Button text class="h-8 w-8 p-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" title="Edit field"
              @click="toggleEdit(data)">
              <Pencil :size="18" />
            </Button>
            <Button text
              class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
              title="Delete field" @click="$emit('delete-field', data)">
              <Trash2 :size="18" />
            </Button>
          </div>
        </template>
      </Column>

      <template #expansion="{ data }">
        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
          <div class="mb-3 flex items-center gap-2 text-base tracking-wide text-[var(--text-secondary)]">
            <Pencil :size="14" />
            Edit Field
          </div>
          <div class="flex flex-col gap-3 md:flex-row md:items-center">
            <InputText v-model="editDraft.name" type="text" placeholder="Field name" class="flex-1" />
            <Tag>
              <component :is="iconMap[FIELD_TYPE_META[data.type as FieldType].icon]" :size="12"
                class="text-[var(--text-muted)]" />
              <span>{{ FIELD_TYPE_META[data.type as FieldType].displayName }}</span>
            </Tag>
          </div>
          <FieldOptionsForm v-model="editDraft.options" :type="data.type" :items="items" :fieldName="data.name"
            class="mt-4" />
          <div class="mt-4 flex justify-end gap-2">
            <Button severity="secondary" text @click="cancelEdit">Cancel</Button>
            <Button @click="submitEditField(data)">Save</Button>
          </div>
        </div>
      </template>
    </DataTable>

    <div ref="addFieldSectionRef" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
      <div class="mb-3 flex items-center gap-2 text-base tracking-wide text-[var(--text-secondary)]">
        <i class="pi pi-plus text-sm"></i>
        Add New Field
      </div>
      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <InputText ref="addFieldNameRef" v-model="newField.name" type="text" placeholder="Field name" class="flex-1" />
        <Select v-model="newField.type" :options="fieldTypeOptions" optionLabel="label" optionValue="value"
          class="w-full md:w-56" />
        <Button class="md:self-stretch" @click="submitAddField">Add</Button>
      </div>
      <FieldOptionsForm v-model="newField.options" :type="newField.type" class="mt-4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type Component } from 'vue'
import * as icons from 'lucide-vue-next'
import { Pencil, Trash2 } from 'lucide-vue-next'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import type { Field, FieldOptions, FieldType, Item } from '../../../types/models'
import { FIELD_TYPE_META } from '../../../types/models'
import { getDefaultOptions, parseFieldOptions } from '../../../utils/fieldOptions'
import FieldOptionsForm from './FieldOptionsForm.vue'
import type { FieldDraftInput } from './types'

type RowReorderEvent = { value: Field[] }

type EditDraft = {
  name: string
  options: FieldOptions
}

defineProps<{
  orderedFields: Field[]
  items: Item[]
}>()

const emit = defineEmits<{
  (e: 'add-field', value: FieldDraftInput): void
  (e: 'delete-field', value: Field): void
  (e: 'reorder-fields', value: Field[]): void
  (e: 'update-field', value: { field: Field; name: string; options: FieldOptions; removedOptions: string[] }): void
}>()

const fieldTypeOptions: Array<{ label: string; value: FieldType }> = [
  { label: FIELD_TYPE_META.text.displayName, value: 'text' },
  { label: FIELD_TYPE_META.longtext.displayName, value: 'longtext' },
  { label: FIELD_TYPE_META.number.displayName, value: 'number' },
  { label: FIELD_TYPE_META.date.displayName, value: 'date' },
  { label: FIELD_TYPE_META.select.displayName, value: 'select' },
  { label: FIELD_TYPE_META.multiselect.displayName, value: 'multiselect' },
  { label: FIELD_TYPE_META.boolean.displayName, value: 'boolean' },
  { label: FIELD_TYPE_META.url.displayName, value: 'url' },
  { label: FIELD_TYPE_META.rating.displayName, value: 'rating' }
]

const iconMap = icons as unknown as Record<string, Component>

function createEmptyFieldDraft(): FieldDraftInput {
  return {
    name: '',
    type: 'text',
    options: getDefaultOptions('text')
  }
}

const newField = ref<FieldDraftInput>(createEmptyFieldDraft())
const addFieldSectionRef = ref<HTMLElement | null>(null)
const addFieldNameRef = ref<unknown>(null)

const expandedRows = ref<Record<string, boolean>>({})
const editingFieldId = ref<number | null>(null)
const editingOriginalChoices = ref<string[]>([])
const editDraft = ref<EditDraft>({
  name: '',
  options: getDefaultOptions('text')
})

watch(
  () => newField.value.type,
  type => {
    newField.value.options = getDefaultOptions(type)
  }
)

function submitAddField() {
  emit('add-field', { ...newField.value, options: { ...newField.value.options } })
  newField.value = createEmptyFieldDraft()
}

function onRowReorder(event: RowReorderEvent) {
  if (!event.value) return
  emit('reorder-fields', event.value)
}

function toggleEdit(field: Field) {
  if (editingFieldId.value === field.id) {
    cancelEdit()
    return
  }

  editingFieldId.value = field.id
  expandedRows.value = { [String(field.id)]: true }
  editDraft.value = {
    name: field.name,
    options: parseFieldOptions(field.type, field.options)
  }

  if (field.type === 'select' || field.type === 'multiselect') {
    const parsed = parseFieldOptions(field.type, field.options) as { choices?: string[] }
    editingOriginalChoices.value = parsed.choices ? [...parsed.choices] : []
  } else {
    editingOriginalChoices.value = []
  }
}

function cancelEdit() {
  editingFieldId.value = null
  expandedRows.value = {}
  editDraft.value = {
    name: '',
    options: getDefaultOptions('text')
  }
  editingOriginalChoices.value = []
}

function submitEditField(field: Field) {
  const currentOptions = editDraft.value.options
  const removedOptions = editingOriginalChoices.value.filter(
    option => !(currentOptions as { choices?: string[] }).choices?.includes(option)
  )

  emit('update-field', {
    field,
    name: editDraft.value.name,
    options: { ...currentOptions },
    removedOptions
  })

  cancelEdit()
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
