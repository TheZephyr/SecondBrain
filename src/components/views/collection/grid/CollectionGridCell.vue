<template>
  <div
    class="cell flex h-9 w-full items-center px-3 text-sm text-[var(--text-primary)]"
    :class="selected ? 'cell--selected' : ''"
  >
    <span class="block w-full truncate">
      {{ displayValue }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Field, ItemDataValue } from '../../../../types/models'
import { formatDateForDisplay } from '../../../../utils/date'

const props = defineProps<{
  field?: Field
  value?: ItemDataValue
  selected?: boolean
}>()

const displayValue = computed(() => {
  const field = props.field
  const value = props.value
  if (!field) return '-'
  if (value === null || value === undefined || value === '') return '-'

  if (field.type === 'date') {
    return formatDateForDisplay(value)
  }

  return value
})
</script>
