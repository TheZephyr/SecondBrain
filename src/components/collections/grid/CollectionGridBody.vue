<template>
  <div
    ref="scrollElementRef"
    class="relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-(--bg-primary)"
    @scroll.passive="onScroll"
  >
    <div
      v-if="rows.length === 0 && !itemsLoading"
      class="flex flex-1 items-center justify-center"
    >
      <div class="flex flex-col items-center gap-3 py-10 text-(--text-muted)">
        <component
          :is="itemsTotal === 0 && !debouncedSearchQuery ? FileText : Search"
          :size="40"
          :stroke-width="1.5"
        />
        <p class="text-base text-center">
          {{
            itemsTotal === 0 && !debouncedSearchQuery
              ? "No items yet. Click the + row below to get started!"
              : "No items match your search."
          }}
        </p>
      </div>
    </div>

    <div class="min-w-full">
      <div class="relative min-w-full" :style="{ height: `${totalSize}px` }">
        <div
          v-for="virtualRow in virtualRows"
          :key="rowAt(virtualRow.index).original.id"
          class="absolute left-0 top-0 w-full"
          :style="{ transform: `translateY(${virtualRow.start}px)` }"
        >
          <CollectionGridRow
            :row="rowAt(virtualRow.index)"
            :virtualIndex="virtualRow.index"
            :rowIndex="virtualRow.index"
            :totalRows="rows.length"
            :gridTemplateColumns="gridTemplateColumns"
            :orderedFields="orderedFields"
            :rowIds="rowIds"
            :duplicateMap="duplicateMap"
            :numberFieldRanges="numberFieldRanges"
            :isSelected="isRowSelected(rowAt(virtualRow.index).original.id)"
            @edit-item="$emit('edit-item', $event)"
            @row-contextmenu="$emit('row-contextmenu', $event)"
            @toggle-row-selection="onToggleRowSelection"
          />
        </div>
      </div>
      <CollectionGridAddRow
        :gridTemplateColumns="gridTemplateColumns"
        :orderedFields="orderedFields"
      />
      <div
        v-if="itemsLoading && rows.length > 0"
        class="flex h-9 items-center justify-center border-b border-(--border-color) text-base text-(--text-muted)"
      >
        Loading more...
      </div>
    </div>

    <div
      v-if="itemsLoading && rows.length === 0"
      class="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg-primary)_70%,transparent)] text-base text-(--text-muted)"
    >
      Loading...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { Row } from "@tanstack/vue-table";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { FileText, Search } from "lucide-vue-next";
import type { Field, Item, NumberFieldRange } from "../../../types/models";
import CollectionGridRow from "./CollectionGridRow.vue";
import CollectionGridAddRow from "./CollectionGridAddRow.vue";

type RowContextMenuPayload = {
  event: MouseEvent;
  row: Item;
  rowIndex: number;
  totalRows: number;
};

const props = defineProps<{
  rows: Row<Item>[];
  gridTemplateColumns: string;
  itemsTotal: number;
  itemsLoading: boolean;
  itemsFullyLoaded: boolean;
  debouncedSearchQuery: string;
  orderedFields: Field[];
  numberFieldRanges: Record<number, NumberFieldRange>;
  duplicateMap: Map<string, Set<string>>;
  loadNextPage: () => Promise<void>;
}>();

const rowIds = computed(() => props.rows.map((row) => row.original.id));
const selectedRowIds = ref<Set<number>>(new Set());
const scrollElementRef = ref<HTMLElement | null>(null);
let scrollRafId: number | null = null;

const virtualizer = useVirtualizer<HTMLElement, HTMLElement>(
  computed(() => ({
    count: props.rows.length,
    getScrollElement: () => scrollElementRef.value,
    estimateSize: () => 40,
    overscan: 10,
  })),
);

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

function rowAt(index: number): Row<Item> {
  return props.rows[index] as Row<Item>;
}

function isRowSelected(rowId: number) {
  return selectedRowIds.value.has(rowId);
}

function onToggleRowSelection(payload: { rowId: number; selected: boolean }) {
  const nextSelectedRowIds = new Set(selectedRowIds.value);

  if (payload.selected) {
    nextSelectedRowIds.add(payload.rowId);
  } else {
    nextSelectedRowIds.delete(payload.rowId);
  }

  selectedRowIds.value = nextSelectedRowIds;
}

function checkLoadMoreThreshold() {
  const scrollElement = scrollElementRef.value;
  if (!scrollElement) {
    return;
  }
  if (props.itemsLoading || props.itemsFullyLoaded) {
    return;
  }

  if (
    scrollElement.scrollTop + scrollElement.clientHeight >
    scrollElement.scrollHeight - 300
  ) {
    void props.loadNextPage();
  }
}

function onScroll() {
  if (scrollRafId !== null) {
    return;
  }

  scrollRafId = window.requestAnimationFrame(() => {
    scrollRafId = null;
    checkLoadMoreThreshold();
  });
}

onBeforeUnmount(() => {
  if (scrollRafId !== null) {
    window.cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
});

defineEmits<{
  "edit-item": [value: Item];
  "row-contextmenu": [value: RowContextMenuPayload];
}>();
</script>
