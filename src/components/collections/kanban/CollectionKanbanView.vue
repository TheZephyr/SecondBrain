<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col">
    <div
      v-if="selectFields.length === 0"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <i class="pi pi-list mb-4 text-4xl text-[var(--text-muted)]"></i>
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">
        No Select Fields
      </h3>
      <p class="mt-2 max-w-md text-base text-[var(--text-muted)]">
        Kanban view requires at least one select field in this collection.
      </p>
    </div>

    <div
      v-else-if="groupingFieldId !== null && !groupingField"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <i
        class="pi pi-exclamation-circle mb-4 text-4xl text-[var(--text-muted)]"
      ></i>
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">
        Grouping Field Missing
      </h3>
      <p class="mt-2 max-w-md text-base text-[var(--text-muted)]">
        The select field used for this Kanban view was deleted. Choose a new
        field in the Fields panel.
      </p>
    </div>

    <div
      v-else-if="!groupingField"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <i class="pi pi-bars mb-4 text-4xl text-[var(--text-muted)]"></i>
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">
        Choose a Select Field
      </h3>
      <p class="mt-2 max-w-md text-base text-[var(--text-muted)]">
        Select the field that should stack items into columns.
      </p>
    </div>

    <div
      v-else
      ref="boardRef"
      class="kanban-board flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-4"
      @wheel.passive="onBoardWheel"
    >
      <CollectionKanbanColumn
        v-for="column in columns"
        :key="String(column.key)"
        :column="column"
        :viewOrderedFields="orderedFields"
        :numberFieldRanges="numberFieldRanges"
        :isUncategorized="column.key === null"
        :colorOptions="groupingOptions"
        @add-item="onAddItem"
        @edit-item="emit('edit-item', $event)"
        @update-item="emit('update-item', $event)"
        @card-drop="onCardDrop"
        @column-drop="onColumnDrop"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import type {
  Field,
  Item,
  ItemData,
  ItemSortSpec,
  ViewConfig,
  NumberFieldRange,
} from "../../../types/models";
import type { LoadItemsOptions } from "../../../composables/collection/useCollectionItemsQuery";
import { useCollectionKanban } from "../../../composables/collection/kanban/useCollectionKanban";
import { itemsRepository } from "../../../repositories/itemsRepository";
import { parseFieldOptions } from "../../../utils/fieldOptions";
import CollectionKanbanColumn from "./CollectionKanbanColumn.vue";

const props = defineProps<{
  collectionId: number;
  viewId: number;
  items: Item[];
  itemsLoading: boolean;
  itemsFullyLoaded: boolean;
  itemsSearch: string;
  itemsSort: ItemSortSpec[];
  orderedFields: Field[];
  loadItems: (options?: LoadItemsOptions) => Promise<void>;
  groupingFieldId: number | null;
  childViewConfig: ViewConfig | null;
  saveViewConfig: (viewId: number, config: ViewConfig) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: "edit-item", value: Item): void;
  (e: "add-item", value: ItemData): void;
  (e: "update-item", value: { id: number; data: Item["data"] }): void;
}>();

const boardRef = ref<HTMLElement | null>(null);
const numberFieldRanges = ref<Record<number, NumberFieldRange>>({});

const {
  selectFields,
  groupingField,
  groupingOptions,
  columns,
  reorderColumns,
  moveItemToColumn,
  reorderItemsInColumn,
} = useCollectionKanban({
  viewId: toRef(props, "viewId"),
  items: toRef(props, "items"),
  itemsLoading: toRef(props, "itemsLoading"),
  itemsFullyLoaded: toRef(props, "itemsFullyLoaded"),
  itemsSearch: toRef(props, "itemsSearch"),
  itemsSort: toRef(props, "itemsSort"),
  loadItems: props.loadItems,
  orderedFields: toRef(props, "orderedFields"),
  groupingFieldId: toRef(props, "groupingFieldId"),
  childViewConfig: toRef(props, "childViewConfig"),
  saveViewConfig: props.saveViewConfig,
});

const groupingFieldId = toRef(props, "groupingFieldId");

const optionSet = computed(() => new Set(groupingOptions.value));

function resolveItemColumnKey(item: Item): string | null {
  const field = groupingField.value;
  if (!field) {
    return null;
  }

  const rawValue = item.data[field.name];
  const value = typeof rawValue === "string" ? rawValue : null;
  if (!value || !optionSet.value.has(value)) {
    return null;
  }

  return value;
}

function onBoardWheel(event: WheelEvent) {
  const board = boardRef.value;
  if (!board) {
    return;
  }

  const target = event.target as HTMLElement | null;
  const inColumnScroll = target?.closest("[data-kanban-scroll]");

  // In some OS/browser combinations, Shift+Wheel translates deltaY to deltaX natively.
  // We handle both just to be safe.
  if (event.shiftKey) {
    board.scrollLeft += event.deltaY || event.deltaX;
  } else if (!inColumnScroll) {
    board.scrollLeft += event.deltaY || event.deltaX;
  }
}

function onAddItem(columnKey: string | null) {
  const field = groupingField.value;
  if (!field) {
    emit("add-item", {});
    return;
  }
  emit("add-item", {
    [field.name]: columnKey ?? null,
  });
}

async function loadNumberFieldRanges() {
  const numberFields = props.orderedFields.filter((field) => {
    if (field.type !== "number") {
      return false;
    }

    const options = parseFieldOptions(field.type, field.options) as {
      colorScale?: unknown;
    };
    return Boolean(options.colorScale);
  });

  if (numberFields.length === 0) {
    numberFieldRanges.value = {};
    return;
  }

  const entries = await Promise.all(
    numberFields.map(async (field) => {
      const range = await itemsRepository.getNumberFieldRange({
        collectionId: props.collectionId,
        fieldName: field.name,
      });
      return [field.id, range] as const;
    }),
  );

  numberFieldRanges.value = Object.fromEntries(entries);
}

function onColumnDrop(payload: { fromKey: string; toKey: string }) {
  void reorderColumns(payload.fromKey, payload.toKey);
}

function onCardDrop(payload: {
  itemId: number;
  targetColumnKey: string | null;
  afterItemId?: number | null;
}) {
  const item = props.items.find((entry) => entry.id === payload.itemId);
  if (!item) {
    return;
  }

  const currentKey = resolveItemColumnKey(item);
  if (currentKey === payload.targetColumnKey) {
    const targetColumn = columns.value.find(
      (column) => column.key === payload.targetColumnKey,
    );
    if (!targetColumn) {
      return;
    }

    const orderedIds = targetColumn.items
      .map((entry) => entry.id)
      .filter((id) => id !== item.id);
    let insertIndex = 0;
    if (payload.afterItemId !== null && payload.afterItemId !== undefined) {
      const index = orderedIds.indexOf(payload.afterItemId);
      insertIndex = index >= 0 ? index + 1 : orderedIds.length;
    }

    orderedIds.splice(insertIndex, 0, item.id);
    void reorderItemsInColumn(payload.targetColumnKey, orderedIds);
    return;
  }

  void moveItemToColumn(item, payload.targetColumnKey, payload.afterItemId);
}

watch(
  () => [props.collectionId, props.orderedFields] as const,
  () => {
    void loadNumberFieldRanges();
  },
  { immediate: true, deep: true },
);
</script>
