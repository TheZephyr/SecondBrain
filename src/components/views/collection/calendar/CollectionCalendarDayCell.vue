<template>
  <div ref="cellRef"
    class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-[var(--border-color)] bg-[var(--bg-primary)] p-1 text-[var(--text-primary)"
    :class="[
      cell.isCurrentMonth ? '' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
      cell.isToday ? 'ring-1 ring-inset ring-[var(--accent-primary)]' : ''
    ]">
    <div class="mb-1 flex min-w-0 items-center justify-between gap-1">
      <span
        class="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
        :class="cell.isToday ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]' : ''">
        {{ cell.date.getDate() }}
      </span>
      <span v-if="cell.items.length > 0" class="min-w-0 truncate text-xs text-[var(--text-muted)] px-1">
        {{ cell.items.length }} items
      </span>
    </div>

    <div ref="listRef" class="relative min-h-0 flex-1 space-y-1 overflow-hidden">
      <button v-if="cell.items.length > 0" type="button" data-calendar-chip-measure class="
        pointer-events-none invisible absolute left-1 top-0 w-full truncate rounded-md px-1.5 py-0.5 
        text-left text-sm text-[var(--text-primary)]
        " tabindex="-1">
        {{ cell.items[0]?.label ?? '' }}
      </button>
      <CollectionCalendarItemChip v-for="entry in visibleItems" :key="entry.item.id" :entry="entry"
        @edit-item="emit('edit-item', $event)" />

      <button v-if="hiddenItemCount > 0" ref="moreButtonRef" type="button" data-calendar-more class="
        w-full truncate rounded-md px-1.5 py-0.5 text-left text-sm text-[var(--accent-primary)] 
        transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] 
        " @click="openPopover">
        +{{ hiddenItemCount }} more
      </button>
    </div>

    <Popover ref="popoverRef" :pt="popoverPt">
      <div class="w-64 space-y-2">
        <div class="flex items-center justify-between gap-3">
          <div class="text-base font-semibold text-[var(--text-primary)]">
            {{ cell.date.toLocaleDateString() }}
          </div>
          <div class="text-base text-[var(--text-muted)]">
            {{ cell.items.length }} item{{ cell.items.length === 1 ? '' : 's' }}
          </div>
        </div>

        <div class="max-h-80 space-y-1 overflow-y-auto pr-1">
          <CollectionCalendarItemChip v-for="entry in cell.items" :key="`popover-${entry.item.id}`" :entry="entry"
            @edit-item="onPopoverEdit" />
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Popover from 'primevue/popover'
import type { PopoverMethods } from 'primevue/popover'
import type { CalendarMonthCell } from '../../../../composables/collection/calendar/useCollectionCalendar'
import CollectionCalendarItemChip from './CollectionCalendarItemChip.vue'

const props = defineProps<{
  cell: CalendarMonthCell
}>()

const emit = defineEmits<{
  'edit-item': [value: CalendarMonthCell['items'][number]['item']]
}>()

const listRef = ref<HTMLElement | null>(null)
const moreButtonRef = ref<HTMLButtonElement | null>(null)
const popoverRef = ref<PopoverMethods | null>(null)
const maxVisibleItems = ref(1)

const visibleItems = computed(() => props.cell.items.slice(0, maxVisibleItems.value))
const hiddenItemCount = computed(() => Math.max(0, props.cell.items.length - maxVisibleItems.value))

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

function calcMaxVisibleItems() {
  const listEl = listRef.value
  if (!listEl) {
    return
  }

  const listHeight = listEl.clientHeight
  if (listHeight <= 0) {
    return
  }

  const chipEl = listEl.querySelector<HTMLElement>('[data-calendar-chip], [data-calendar-chip-measure]')
  const chipHeight = chipEl?.offsetHeight ?? 0
  if (chipHeight <= 0) {
    return
  }

  const listStyle = getComputedStyle(listEl)
  const gap = Number.parseFloat(listStyle.rowGap || listStyle.gap || '0') || 0

  const calcCapacity = (availableHeight: number) => {
    if (availableHeight <= 0) {
      return 0
    }
    return Math.max(0, Math.floor((availableHeight + gap) / (chipHeight + gap)))
  }

  let capacity = calcCapacity(listHeight)
  if (props.cell.items.length > capacity) {
    const moreHeight = moreButtonRef.value?.offsetHeight ?? chipHeight
    const availableForChips = listHeight - (moreHeight + gap)
    capacity = calcCapacity(availableForChips)
  }

  maxVisibleItems.value = Math.max(0, capacity)
}

let resizeObserver: ResizeObserver | null = null
let onWindowResize: (() => void) | null = null

onMounted(async () => {
  await nextTick()
  calcMaxVisibleItems()

  if (listRef.value) {
    resizeObserver = new ResizeObserver(() => {
      calcMaxVisibleItems()
    })
    resizeObserver.observe(listRef.value)
  }

  onWindowResize = () => {
    calcMaxVisibleItems()
  }
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (onWindowResize) {
    window.removeEventListener('resize', onWindowResize)
    onWindowResize = null
  }
})

watch(
  () => props.cell.items.length,
  async () => {
    await nextTick()
    calcMaxVisibleItems()
  }
)
</script>
