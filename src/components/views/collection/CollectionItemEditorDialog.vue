<template>
  <Dialog :visible="visible" :header="editingItem ? 'Edit Item' : 'Add New Item'" modal :draggable="false" class="max-w-2xl"
    @update:visible="onVisibilityChange" @hide="cancelDialog">
    <form @submit.prevent="saveDialog">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div v-for="field in orderedFields" :key="field.id" :class="field.type === 'textarea' ? 'md:col-span-2' : ''">
          <FloatLabel class="w-full" variant="in">
            <InputText v-if="field.type === 'text'" :id="getFieldInputId(field)" :modelValue="getTextValue(field.name)"
              @update:modelValue="value => setTextValue(field.name, value)" type="text" class="w-full" />
            <Textarea v-else-if="field.type === 'textarea'" :id="getFieldInputId(field)" :modelValue="getTextValue(field.name)"
              @update:modelValue="value => setTextValue(field.name, value)" rows="3" class="w-full" />
            <InputNumber v-else-if="field.type === 'number'" :inputId="getFieldInputId(field)"
              :modelValue="getNumberValue(field.name)" @update:modelValue="value => setNumberValue(field.name, value)"
              inputClass="w-full" class="w-full" />
            <DatePicker v-else-if="field.type === 'date'" :inputId="getFieldInputId(field)" :modelValue="getDateValue(field.name)"
              @update:modelValue="value => setDateValue(field.name, value)" dateFormat="yy-mm-dd" inputClass="w-full"
              class="w-full" />
            <Select v-else-if="field.type === 'select'" :inputId="getFieldInputId(field)" :modelValue="getSelectValue(field.name)"
              @update:modelValue="value => setSelectValue(field.name, value)" :options="getSelectOptions(field)" class="w-full" />
            <label :for="getFieldInputId(field)">{{ field.name }}</label>
          </FloatLabel>
        </div>
      </div>
    </form>
    <template #footer>
      <Button severity="secondary" text @click="cancelDialog">Cancel</Button>
      <Button @click="saveDialog">{{ editingItem ? 'Update' : 'Add' }}</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { watch, toRef } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import FloatLabel from 'primevue/floatlabel'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import type { Field, Item } from '../../../types/models'
import { useCollectionItemForm } from '../../../composables/collection/useCollectionItemForm'
import type { ItemEditorSavePayload } from './types'

const props = defineProps<{
  visible: boolean
  orderedFields: Field[]
  editingItem: Item | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', value: ItemEditorSavePayload): void
}>()

const {
  startCreate,
  startEdit,
  cancelForm,
  resetFormData,
  toItemData,
  getFieldInputId,
  getSelectOptions,
  getTextValue,
  setTextValue,
  getSelectValue,
  setSelectValue,
  getNumberValue,
  setNumberValue,
  getDateValue,
  setDateValue
} = useCollectionItemForm(toRef(props, 'orderedFields'))

watch(
  () => props.visible,
  isVisible => {
    if (!isVisible) return
    if (props.editingItem) {
      startEdit(props.editingItem)
      return
    }
    startCreate()
  },
  { immediate: true }
)

watch(
  () => props.editingItem,
  item => {
    if (!props.visible) return
    if (item) {
      startEdit(item)
      return
    }
    startCreate()
  }
)

watch(
  () => props.orderedFields,
  () => {
    if (!props.visible) return
    if (props.editingItem) return
    resetFormData()
  },
  { deep: true }
)

function onVisibilityChange(nextVisible: boolean) {
  emit('update:visible', nextVisible)
}

function cancelDialog() {
  emit('update:visible', false)
  cancelForm()
}

function saveDialog() {
  emit('save', {
    data: toItemData(),
    editingItemId: props.editingItem?.id ?? null
  })
}
</script>
