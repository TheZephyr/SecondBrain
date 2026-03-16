<template>
  <div
    class="flex flex-wrap items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2">
    <div class="flex items-center gap-2">
      <Button text
        class="h-8 w-8 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        @click="emit('previous-month')">
        <i class="pi pi-chevron-left text-base"></i>
      </Button>
      <div class="min-w-40 text-base font-semibold text-[var(--text-primary)]">
        {{ monthLabel }}
      </div>
      <Button text
        class="h-8 w-8 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        @click="emit('next-month')">
        <i class="pi pi-chevron-right text-base"></i>
      </Button>
    </div>

    <div class="flex-1"></div>

    <div v-if="dateFields.length > 1" class="flex items-center gap-2">
      <label class="text-base font-medium text-[var(--text-muted)]" for="calendar-date-field">
        Date field
      </label>
      <Select inputId="calendar-date-field" :modelValue="selectedDateFieldId" :options="dateFieldOptions"
        optionLabel="label" optionValue="value" placeholder="Choose date field" class="min-w-52"
        @update:modelValue="emit('update:selectedDateFieldId', $event)" />
    </div>

    <div v-if="showLoadingState" class="text-base text-[var(--text-muted)]">
      Loading all items...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import type { Field } from '../../../../types/models'

const props = defineProps<{
  monthLabel: string
  dateFields: Field[]
  selectedDateFieldId: number | null
  isLoadingAll: boolean
}>()

const emit = defineEmits<{
  'previous-month': []
  'next-month': []
  'update:selectedDateFieldId': [value: number | null]
}>()

const dateFieldOptions = computed(() => {
  return props.dateFields.map(field => ({
    label: field.name,
    value: field.id
  }))
})

const showLoadingState = computed(() => props.isLoadingAll)
</script>
