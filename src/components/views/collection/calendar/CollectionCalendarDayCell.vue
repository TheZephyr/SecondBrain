<template>
  <div
    class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)] p-1 sm:p-2"
    :class="[
      cell.isCurrentMonth ? '' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
      cell.isToday ? 'ring-1 ring-inset ring-[var(--accent-primary)]' : ''
    ]"
  >
    <div class="mb-1 flex min-w-0 items-center justify-between gap-1 sm:mb-2 sm:gap-2">
      <span
        class="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:size-6 sm:text-xs"
        :class="cell.isToday ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]' : ''"
      >
        {{ cell.date.getDate() }}
      </span>
      <span
        v-if="cell.items.length > 0"
        class="min-w-0 truncate text-[10px] text-[var(--text-muted)] sm:text-[11px]"
      >
        {{ cell.items.length }}
      </span>
    </div>

    <div class="min-h-0 flex-1 space-y-1 overflow-hidden">
      <CollectionCalendarItemChip
        v-for="entry in visibleItems"
        :key="entry.item.id"
        :entry="entry"
        @edit-item="emit('edit-item', $event)"
      />

      <button
        v-if="hiddenItemCount > 0"
        type="button"
        class="w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] text-[var(--accent-primary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:px-2 sm:py-1 sm:text-xs"
        @click="openPopover"
      >
        +{{ hiddenItemCount }} more
      </button>
    </div>

    <Popover
      ref="popoverRef"
      :pt="popoverPt"
    >
      <div class="w-64 space-y-2">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-semibold text-[var(--text-primary)]">
            {{ cell.date.toLocaleDateString() }}
          </div>
          <div class="text-xs text-[var(--text-muted)]">
            {{ cell.items.length }} item{{ cell.items.length === 1 ? '' : 's' }}
          </div>
        </div>

        <div class="max-h-80 space-y-1 overflow-y-auto pr-1">
          <CollectionCalendarItemChip
            v-for="entry in cell.items"
            :key="`popover-${entry.item.id}`"
            :entry="entry"
            @edit-item="onPopoverEdit"
          />
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Popover from 'primevue/popover'
import type { PopoverMethods } from 'primevue/popover'
import type { CalendarMonthCell } from '../../../../composables/collection/calendar/useCollectionCalendar'
import CollectionCalendarItemChip from './CollectionCalendarItemChip.vue'

const MAX_VISIBLE_ITEMS = 3

const props = defineProps<{
  cell: CalendarMonthCell
}>()

const emit = defineEmits<{
  'edit-item': [value: CalendarMonthCell['items'][number]['item']]
}>()

const popoverRef = ref<PopoverMethods | null>(null)

const visibleItems = computed(() => props.cell.items.slice(0, MAX_VISIBLE_ITEMS))
const hiddenItemCount = computed(() => Math.max(0, props.cell.items.length - MAX_VISIBLE_ITEMS))

const popoverPt = {
  root: {
    class: 'rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-xl'
  },
  content: {
    class: 'p-3'
  }
}

function openPopover(event: MouseEvent) {
  popoverRef.value?.toggle(event)
}

function onPopoverEdit(item: CalendarMonthCell['items'][number]['item']) {
  popoverRef.value?.hide()
  emit('edit-item', item)
}
</script>
