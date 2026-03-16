<template>
  <Dialog
    :visible="visible"
    :header="editingItem ? 'Edit Item' : 'Add New Item'"
    modal
    :draggable="false"
    class="max-w-2xl"
    @update:visible="onVisibilityChange"
    @hide="cancelDialog"
  >
    <form @submit.prevent="saveDialog">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          v-for="field in orderedFields"
          :key="field.id"
          :class="field.type === 'longtext' ? 'md:col-span-2' : ''"
        >
          <FloatLabel class="w-full" variant="in">
            <InputText
              v-if="field.type === 'text'"
              :id="getFieldInputId(field)"
              :modelValue="getTextValue(field.name)"
              @update:modelValue="value => setTextValue(field.name, value)"
              type="text"
              class="w-full"
            />
            <Textarea
              v-else-if="field.type === 'longtext'"
              :id="getFieldInputId(field)"
              :modelValue="getTextValue(field.name)"
              @update:modelValue="value => setTextValue(field.name, value)"
              rows="3"
              class="w-full"
            />
            <InputNumber
              v-else-if="field.type === 'number'"
              :inputId="getFieldInputId(field)"
              :modelValue="getNumberValue(field.name)"
              @update:modelValue="value => setNumberValue(field.name, value)"
              inputClass="w-full"
              class="w-full"
            />
            <DatePicker
              v-else-if="field.type === 'date'"
              :inputId="getFieldInputId(field)"
              :modelValue="getDateValue(field.name)"
              @update:modelValue="value => setDateValue(field.name, value)"
              :dateFormat="getDateFormat(field)"
              inputClass="w-full"
              class="w-full"
            />
            <Select
              v-else-if="field.type === 'select'"
              :inputId="getFieldInputId(field)"
              :modelValue="getSelectValue(field.name)"
              @update:modelValue="value => setSelectValue(field.name, value)"
              :options="getSelectChoices(field)"
              class="w-full"
            >
              <template #option="{ option }">
                <Chip
                  :label="option"
                  :style="getChipStyle(option, getSelectChoices(field))"
                  class="text-xs py-0 px-2 h-5 leading-none"
                  :pt="{ root: { class: 'rounded-full' } }"
                />
              </template>
            </Select>
            <MultiSelect
              v-else-if="field.type === 'multiselect'"
              :inputId="getFieldInputId(field)"
              :modelValue="getMultiselectValue(field.name)"
              @update:modelValue="value => setMultiselectValue(field.name, value)"
              :options="getSelectChoices(field)"
              display="chip"
              class="w-full"
            />
            <div v-else-if="field.type === 'boolean'" class="flex items-center gap-2">
              <button
                type="button"
                class="flex items-center"
                @click="setBooleanValue(field.name, !getBooleanValue(field.name))"
              >
                <component
                  :is="getBooleanIcon(field)"
                  :size="20"
                  :fill="getBooleanValue(field.name) ? 'currentColor' : 'transparent'"
                  :stroke-width="getBooleanValue(field.name) ? 0 : 1.5"
                  :class="getBooleanValue(field.name) ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'"
                />
              </button>
            </div>
            <div v-else-if="field.type === 'url'" class="relative w-full">
              <InputText
                :id="getFieldInputId(field)"
                :modelValue="getTextValue(field.name)"
                @update:modelValue="value => setTextValue(field.name, value)"
                type="text"
                class="w-full pr-8"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--accent-primary)]"
                title="Open link"
                @click="openExternal(getTextValue(field.name))"
              >
                <Link :size="14" />
              </button>
            </div>
            <Select
              v-else-if="field.type === 'rating'"
              :inputId="getFieldInputId(field)"
              :modelValue="getRatingValue(field.name)"
              @update:modelValue="value => setRatingValue(field.name, value)"
              :options="getRatingOptions(field)"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            >
              <template #value="{ value }">
                <div class="flex items-center gap-1">
                  <span v-if="value === null" class="text-[var(--text-muted)]">None</span>
                  <div v-else class="flex items-center">
                    <component
                      v-for="index in getRatingMax(field)"
                      :key="index"
                      :is="getRatingIcon(field)"
                      :size="16"
                      :fill="index <= (value ?? 0) ? getRatingColor(field) : 'transparent'"
                      :stroke-width="index <= (value ?? 0) ? 0 : 1.5"
                      :class="index <= (value ?? 0) ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'"
                    />
                  </div>
                </div>
              </template>
              <template #option="{ option }">
                <div class="flex items-center gap-2">
                  <span v-if="option.value === null" class="text-[var(--text-muted)]">None</span>
                  <div v-else class="flex items-center">
                    <component
                      v-for="index in getRatingMax(field)"
                      :key="index"
                      :is="getRatingIcon(field)"
                      :size="16"
                      :fill="index <= option.value ? getRatingColor(field) : 'transparent'"
                      :stroke-width="index <= option.value ? 0 : 1.5"
                      :class="index <= option.value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'"
                    />
                  </div>
                  <span class="text-xs text-[var(--text-muted)]">{{ option.label }}</span>
                </div>
              </template>
            </Select>
            <label :for="getFieldInputId(field)" :class="labelClass(field)">{{ field.name }}</label>
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
import { computed, watch, toRef } from 'vue'
import * as icons from 'lucide-vue-next'
import { Link } from 'lucide-vue-next'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import FloatLabel from 'primevue/floatlabel'
import Chip from 'primevue/chip'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import type { BooleanIcon, Field, Item, RatingFieldOptions } from '../../../types/models'
import { useCollectionItemForm } from '../../../composables/collection/useCollectionItemForm'
import { useFieldUniqueCheck } from '../../../composables/collection/useFieldUniqueCheck'
import { getChipStyle } from '../../../utils/selectChip'
import { parseFieldOptions, getSelectChoices } from '../../../utils/fieldOptions'
import { formatDateForPrimeVue } from '../../../utils/date'
import { handleIpc } from '../../../utils/ipc'
import type { ItemEditorSavePayload } from './types'

const props = defineProps<{
  visible: boolean
  orderedFields: Field[]
  editingItem: Item | null
  items: Item[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', value: ItemEditorSavePayload): void
}>()

const {
  formData,
  startCreate,
  startEdit,
  cancelForm,
  resetFormData,
  toItemData,
  getFieldInputId,
  getTextValue,
  setTextValue,
  getSelectValue,
  setSelectValue,
  getNumberValue,
  setNumberValue,
  getDateValue,
  setDateValue,
  getMultiselectValue,
  setMultiselectValue,
  getBooleanValue,
  setBooleanValue,
  getRatingValue,
  setRatingValue
} = useCollectionItemForm(toRef(props, 'orderedFields'))

const { duplicateFields } = useFieldUniqueCheck({
  items: toRef(props, 'items'),
  fields: toRef(props, 'orderedFields'),
  formData,
  editingItemId: computed(() => props.editingItem?.id ?? null)
})

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

function labelClass(field: Field) {
  return duplicateFields.value.has(field.name) ? 'text-[var(--danger)]' : ''
}

function getDateFormat(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as { format?: string }
  return formatDateForPrimeVue(options.format)
}

function getRatingMin(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions
  return Number.isFinite(options.min) ? Number(options.min) : 0
}

function getRatingMax(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions
  const min = getRatingMin(field)
  const max = Number.isFinite(options.max) ? Number(options.max) : 5
  return Math.max(max, min)
}

function getRatingColor(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions
  return options.color ?? 'currentColor'
}

function getRatingIcon(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions
  const icon = (options.icon ?? 'star') as BooleanIcon
  return booleanIconMap[icon]
}

function getRatingOptions(field: Field) {
  const options: Array<{ label: string; value: number | null }> = [
    { label: 'None', value: null }
  ]
  const min = getRatingMin(field)
  const max = getRatingMax(field)
  for (let i = min; i <= max; i += 1) {
    options.push({ label: `${i} / ${max} *`, value: i })
  }
  return options
}

function getBooleanIcon(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as { icon?: BooleanIcon }
  const icon = (options.icon ?? 'square') as BooleanIcon
  return booleanIconMap[icon]
}

async function openExternal(url: string | null) {
  if (!url) return
  const result = await window.electronAPI.openExternal(url)
  handleIpc(result, 'openExternal', null)
}

const booleanIconMap: Record<BooleanIcon, typeof icons.Square> = {
  square: icons.Square,
  circle: icons.Circle,
  heart: icons.Heart,
  star: icons.Star,
  flame: icons.Flame,
  'thumbs-up': icons.ThumbsUp,
  'thumbs-down': icons.ThumbsDown,
  flag: icons.Flag
}
</script>
