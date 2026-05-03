<template>
  <div
    class="flex h-full min-h-0 w-72 shrink-0 flex-col rounded-lg border border-(--border-color) bg-(--bg-secondary)"
  >
    <div
      class="flex items-center gap-2 px-3 py-2"
      :class="headerDragOver ? 'bg-(--bg-hover)' : ''"
      @dragover="onHeaderDragOver"
      @drop="onHeaderDrop"
      @dragleave="onHeaderDragLeave"
    >
      <span
        v-if="!isUncategorized"
        class="flex size-4 items-center justify-center text-(--text-muted) pt-0.75"
        title="Drag to reorder"
        draggable="true"
        @dragstart="onHeaderDragStart"
        @dragend="onHeaderDragEnd"
        @mousedown.stop
      >
        <GripVertical :size="14" />
      </span>
      <div class="flex-1">
        <span
          class="inline-flex h-5 items-center rounded-full px-2 py-0.5 text-xs leading-none"
          :style="chipStyle"
        >
          {{ column.label }}
        </span>
        <span class="ml-2 text-xs font-medium text-(--text-muted)">
          {{ column.items.length }}
        </span>
      </div>
      <AppButton text class="h-7 w-7" @click="emit('add-item', column.key)">
        <template #icon>
          <Plus class="size-4" />
        </template>
      </AppButton>
    </div>

    <div
      ref="bodyRef"
      class="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 pb-3"
      data-kanban-scroll
      @dragover="onBodyDragOver"
      @drop="onBodyDrop"
      @dragleave="onBodyDragLeave"
    >
      <div
        v-if="column.items.length === 0"
        class="py-4 text-sm text-(--text-muted)"
      >
        No items
      </div>

      <template v-for="(item, index) in column.items" :key="item.id">
        <div
          v-if="dropIndicatorIndex === index"
          class="h-0.5 w-full rounded bg-(--accent-primary)"
        />
        <CollectionKanbanCard
          :item="item"
          :viewOrderedFields="viewOrderedFields"
          :cardTitleField="cardTitleField"
          :numberFieldRanges="numberFieldRanges"
          @edit="emit('edit-item', $event)"
          @update-item="emit('update-item', $event)"
          @drag-start="onCardDragStart"
        />
      </template>
      <div
        v-if="dropIndicatorIndex === column.items.length"
        class="h-0.5 w-full rounded bg-(--accent-primary)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { GripVertical, Plus } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import type { KanbanColumn } from "../../../composables/collection/kanban/useCollectionKanban";
import type { Field, Item, NumberFieldRange } from "../../../types/models";
import { getChipStyle } from "../../../utils/selectChip";
import CollectionKanbanCard from "./CollectionKanbanCard.vue";

const props = defineProps<{
  column: KanbanColumn;
  viewOrderedFields: Field[];
  cardTitleField: Field | null;
  numberFieldRanges: Record<number, NumberFieldRange>;
  isUncategorized: boolean;
  colorOptions: string[];
}>();

const emit = defineEmits<{
  (e: "add-item", value: string | null): void;
  (e: "edit-item", value: Item): void;
  (e: "update-item", value: { id: number; data: Item["data"] }): void;
  (
    e: "card-drop",
    value: {
      itemId: number;
      targetColumnKey: string | null;
      afterItemId?: number | null;
    },
  ): void;
  (e: "column-drop", value: { fromKey: string; toKey: string }): void;
}>();

const bodyRef = ref<HTMLElement | null>(null);
const dropIndicatorIndex = ref<number | null>(null);
const headerDragOver = ref(false);

const chipStyle = computed(() => {
  if (props.isUncategorized) {
    return {
      backgroundColor: "var(--bg-tertiary)",
      color: "var(--text-muted)",
    };
  }
  return getChipStyle(props.column.label, props.colorOptions);
});

function onHeaderDragStart(event: DragEvent) {
  if (!props.column.key) {
    return;
  }
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", String(props.column.key));
    event.dataTransfer.effectAllowed = "move";
  }
}

function onHeaderDragEnd() {
  headerDragOver.value = false;
}

function onHeaderDragOver(event: DragEvent) {
  if (!props.column.key) {
    return;
  }
  headerDragOver.value = true;
  event.preventDefault();
}

function onHeaderDragLeave() {
  headerDragOver.value = false;
}

function onHeaderDrop(event: DragEvent) {
  event.preventDefault();
  headerDragOver.value = false;
  const fromKey = event.dataTransfer?.getData("text/plain");
  if (!fromKey || !props.column.key || fromKey === props.column.key) {
    return;
  }
  emit("column-drop", { fromKey, toKey: props.column.key });
}

function onCardDragStart() {
  dropIndicatorIndex.value = null;
}

function onBodyDragOver(event: DragEvent) {
  const target = event.target as HTMLElement | null;
  const cardEl = target?.closest("[data-kanban-card]") as HTMLElement | null;

  if (cardEl && cardEl.dataset.itemId) {
    const rect = cardEl.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const cardId = Number(cardEl.dataset.itemId);
    const index = props.column.items.findIndex((item) => item.id === cardId);
    dropIndicatorIndex.value =
      index >= 0
        ? event.clientY > midpoint
          ? index + 1
          : index
        : props.column.items.length;
  } else {
    dropIndicatorIndex.value = props.column.items.length;
  }

  event.preventDefault();
}

function onBodyDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null;
  if (related && bodyRef.value?.contains(related)) {
    return;
  }
  dropIndicatorIndex.value = null;
}

function onBodyDrop(event: DragEvent) {
  event.preventDefault();
  const itemId = Number(event.dataTransfer?.getData("text/plain"));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    dropIndicatorIndex.value = null;
    return;
  }

  const index = dropIndicatorIndex.value ?? props.column.items.length;
  const afterItemId =
    index > 0 ? (props.column.items[index - 1]?.id ?? null) : null;
  emit("card-drop", {
    itemId,
    targetColumnKey: props.column.key,
    afterItemId,
  });
  dropIndicatorIndex.value = null;
}
</script>
