<template>
  <div
    class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-(--border-color) bg-(--bg-primary) text-(--text-primary)"
    :class="[
      cell.isCurrentMonth ? '' : 'bg-(--bg-secondary) text-(--text-muted)',
      cell.isToday ? 'ring-1 ring-inset ring-(--accent-primary)' : '',
    ]"
  >
    <div class="mb-1 flex min-w-0 items-center justify-between gap-1">
      <span
        class="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
        :class="
          cell.isToday ? 'bg-(--accent-light) text-(--accent-primary)' : ''
        "
      >
        {{ cell.date.getDate() }}
      </span>
      <span
        v-if="cell.items.length > 0"
        class="min-w-0 truncate px-1 text-xs text-(--text-muted)"
      >
        {{ cell.items.length }} items
      </span>
    </div>

    <div
      ref="listRef"
      class="relative min-h-0 flex-1 flex flex-col gap-1 overflow-hidden"
    >
      <button
        v-if="cell.items.length > 0"
        type="button"
        data-calendar-chip-measure
        class="pointer-events-none invisible absolute left-1 top-0 w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] text-(--text-primary)"
        tabindex="-1"
      >
        {{ cell.items[0]?.label ?? "" }}
      </button>
      <CollectionCalendarItemChip
        v-for="entry in visibleItems"
        :key="entry.item.id"
        :entry="entry"
        @edit-item="emit('edit-item', $event)"
      />

      <Popover v-if="hiddenItemCount > 0" v-model:open="popoverOpen">
        <PopoverTrigger as-child>
          <button
            ref="moreButtonRef"
            type="button"
            data-calendar-more
            class="w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] text-(--accent-primary) transition-colors hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-primary)"
          >
            +{{ hiddenItemCount }} more
          </button>
        </PopoverTrigger>
        <PopoverContent
          class="w-64 rounded-xl border border-(--border-color) bg-(--bg-primary) p-3 shadow-xl"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <div class="text-base font-semibold text-(--text-primary)">
                {{ cell.date.toLocaleDateString() }}
              </div>
              <div class="text-base text-(--text-muted)">
                {{ cell.items.length }} item{{
                  cell.items.length === 1 ? "" : "s"
                }}
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
        </PopoverContent>
      </Popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CalendarMonthCell } from "../../../composables/collection/calendar/useCollectionCalendar";
import CollectionCalendarItemChip from "./CollectionCalendarItemChip.vue";

const props = defineProps<{
  cell: CalendarMonthCell;
}>();

const emit = defineEmits<{
  (e: "edit-item", value: CalendarMonthCell["items"][number]["item"]): void;
}>();

const listRef = ref<HTMLElement | null>(null);
const moreButtonRef = ref<HTMLButtonElement | null>(null);
const popoverOpen = ref(false);
const maxVisibleItems = ref(1);

const visibleItems = computed(() =>
  props.cell.items.slice(0, maxVisibleItems.value),
);
const hiddenItemCount = computed(() =>
  Math.max(0, props.cell.items.length - maxVisibleItems.value),
);

function onPopoverEdit(item: CalendarMonthCell["items"][number]["item"]) {
  popoverOpen.value = false;
  emit("edit-item", item);
}

function calcMaxVisibleItems() {
  const listEl = listRef.value;
  if (!listEl) return;

  const listHeight = listEl.clientHeight;
  if (listHeight <= 0) return;

  const chipEl = listEl.querySelector<HTMLElement>(
    "[data-calendar-chip], [data-calendar-chip-measure]",
  );
  const chipHeight = chipEl?.offsetHeight ?? 0;
  if (chipHeight <= 0) return;

  const listStyle = getComputedStyle(listEl);
  const gap = Number.parseFloat(listStyle.rowGap || listStyle.gap || "0") || 0;

  const calcCapacity = (availableHeight: number) => {
    if (availableHeight <= 0) return 0;
    return Math.max(
      0,
      Math.floor((availableHeight + gap) / (chipHeight + gap)),
    );
  };

  let capacity = calcCapacity(listHeight);
  if (props.cell.items.length > capacity) {
    const moreHeight = moreButtonRef.value?.offsetHeight ?? chipHeight;
    capacity = calcCapacity(listHeight - (moreHeight + gap));
  }

  maxVisibleItems.value = Math.max(0, capacity);
}

let resizeObserver: ResizeObserver | null = null;
let onWindowResize: (() => void) | null = null;

onMounted(async () => {
  await nextTick();
  calcMaxVisibleItems();

  if (listRef.value) {
    resizeObserver = new ResizeObserver(() => {
      calcMaxVisibleItems();
    });
    resizeObserver.observe(listRef.value);
  }

  onWindowResize = () => {
    calcMaxVisibleItems();
  };
  window.addEventListener("resize", onWindowResize);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (onWindowResize) {
    window.removeEventListener("resize", onWindowResize);
    onWindowResize = null;
  }
});

watch(
  () => props.cell.items.length,
  async () => {
    await nextTick();
    calcMaxVisibleItems();
  },
);
</script>
