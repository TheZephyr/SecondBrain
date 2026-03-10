<template>
  <div class="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[var(--bg-primary)]">
    <div class="grid min-w-0 grid-cols-7 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div
        v-for="label in weekdayLabels"
        :key="label"
        class="min-w-0 truncate border-r border-[var(--border-color)] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] last:border-r-0 sm:px-2 sm:text-xs"
      >
        {{ label }}
      </div>
    </div>

    <div
      class="grid min-h-0 min-w-0 grid-cols-7 overflow-hidden"
      style="grid-template-rows: repeat(6, minmax(0, 1fr));"
    >
      <CollectionCalendarDayCell
        v-for="cell in cells"
        :key="cell.key"
        :cell="cell"
        @edit-item="emit('edit-item', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarMonthCell } from '../../../../composables/collection/calendar/useCollectionCalendar'
import CollectionCalendarDayCell from './CollectionCalendarDayCell.vue'

defineProps<{
  weekdayLabels: string[]
  cells: CalendarMonthCell[]
}>()

const emit = defineEmits<{
  'edit-item': [value: CalendarMonthCell['items'][number]['item']]
}>()
</script>
