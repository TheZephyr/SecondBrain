<template>
  <button type="button"
    class="w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:px-2 sm:py-1 sm:text-base"
    :title="entry.label" @click="emit('edit-item', entry.item)">
    {{ entry.label }}
  </button>
</template>

<script setup lang="ts">
import type { CalendarDayItem } from '../../../../composables/collection/calendar/useCollectionCalendar'

defineProps<{
  entry: CalendarDayItem
}>()

const emit = defineEmits<{
  'edit-item': [value: CalendarDayItem['item']]
}>()
</script>
