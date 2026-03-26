<template>
  <div class="space-y-4">
    <FieldOptionsDate v-if="type === 'date'" :modelValue="modelValue as DateFieldOptions"
      @update:modelValue="onUpdate" />
    <FieldOptionsSelect v-else-if="type === 'select' || type === 'multiselect'"
      :modelValue="modelValue as SelectFieldOptions | MultiselectFieldOptions" :type="type" :items="items"
      :fieldName="fieldName" @update:modelValue="onUpdate" />
    <FieldOptionsRating v-else-if="type === 'rating'" :modelValue="modelValue as RatingFieldOptions"
      @update:modelValue="onUpdate" />
    <FieldOptionsBoolean v-else-if="type === 'boolean'" :modelValue="modelValue as BooleanFieldOptions"
      @update:modelValue="onUpdate" />

    <template v-if="type !== 'boolean'">
      <div class="flex items-center justify-between gap-2">
        <div class="text-base text-[var(--text-secondary)]">Check for unique values</div>
        <ToggleSwitch :modelValue="uniqueCheck" @update:modelValue="value => updateUniqueCheck(value)" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ToggleSwitch from 'primevue/toggleswitch'
import type { FieldType, FieldOptions, DateFieldOptions, SelectFieldOptions, MultiselectFieldOptions, RatingFieldOptions, BooleanFieldOptions } from '../../../types/models'
import FieldOptionsDate from './FieldOptionsDate.vue'
import FieldOptionsSelect from './FieldOptionsSelect.vue'
import FieldOptionsRating from './FieldOptionsRating.vue'
import FieldOptionsBoolean from './FieldOptionsBoolean.vue'

const props = defineProps<{
  type: FieldType
  modelValue: FieldOptions
  items?: any[]
  fieldName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: FieldOptions): void
}>()

const uniqueCheck = computed(() => Boolean((props.modelValue as { uniqueCheck?: boolean }).uniqueCheck))

function emitOptions(next: FieldOptions) {
  emit('update:modelValue', next)
}

function updateUniqueCheck(value: boolean) {
  emitOptions({ ...props.modelValue, uniqueCheck: value })
}

function onUpdate(value: FieldOptions) {
  emit('update:modelValue', value)
}
</script>
