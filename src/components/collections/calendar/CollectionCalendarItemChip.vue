<template>
  <button
    type="button"
    data-calendar-chip
    class="w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] text-(--text-primary) bg-(--bg-tertiary) transition-colors hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-primary)"
    :title="entry.label"
    @click="emit('edit-item', entry.item)"
  >
    {{ entry.label }}
  </button>
</template>

<script setup lang="ts">
import type { CalendarDayItem } from "../../../composables/collection/calendar/useCollectionCalendar";

defineProps<{
  entry: CalendarDayItem;
}>();

const emit = defineEmits<{
  "edit-item": [value: CalendarDayItem["item"]];
}>();
</script>
