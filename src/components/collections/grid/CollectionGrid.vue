<template>
  <div
    class="flex h-full w-full min-h-0 min-w-0 flex-col"
    @click="closeContextMenu"
  >
    <CollectionGridToolbar
      v-model:searchQuery="searchModel"
      :multiSortMeta="multiSortMeta"
      :orderedFields="orderedFields"
      @sort="onSort"
    />

    <div
      v-if="orderedFields.length === 0"
      class="flex flex-1 flex-col items-center justify-center px-10 py-16 text-center"
    >
      <Columns
        :size="64"
        :stroke-width="1.5"
        class="mb-5 text-(--text-muted)"
      />
      <h3 class="text-lg font-semibold text-(--text-primary)">No Fields Yet</h3>
      <p class="mt-2 text-base text-(--text-muted)">
        Define the structure of your collection by adding fields
      </p>
      <AppButton
        class="mt-6 min-w-35 gap-2 px-4 text-white"
        @click.stop="notifyAddField"
      >
        <template #icon>
          <Plus class="size-4" />
        </template>
        Add Fields
      </AppButton>
    </div>

    <div v-else class="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-(--bg-primary)"
      >
        <div
          class="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden"
          ref="gridScrollRef"
          @wheel.passive="onGridWheel"
        >
          <div class="min-w-fit flex min-h-0 flex-1 flex-col">
            <CollectionGridHeader
              :headerGroups="headerGroups"
              :gridTemplateColumns="gridTemplateColumns"
              :multiSortMeta="multiSortMeta"
              @sort="onSort"
              @manage-fields="notifyAddField"
              @set-column-width="onSetColumnWidth"
              @reset-column-width="onResetColumnWidth"
              @persist-column-widths="onPersistColumnWidths"
            />
            <CollectionGridBody
              class="min-h-0 flex-1"
              :rows="rows"
              :gridTemplateColumns="gridTemplateColumns"
              :itemsTotal="itemsTotal"
              :itemsLoading="itemsLoading"
              :itemsFullyLoaded="itemsFullyLoaded"
              :debouncedSearchQuery="debouncedSearchQuery"
              :orderedFields="orderedFields"
              :numberFieldRanges="numberFieldRanges"
              :duplicateMap="duplicateMap"
              :loadNextPage="loadNextPage"
              :selectedRowIds="selectedRowIds"
              @update:selectedRowIds="$emit('update:selectedRowIds', $event)"
              @edit-item="emitEditItem"
              @row-contextmenu="onRowContextMenu"
            />
          </div>
        </div>
        <CollectionGridFooter :itemsTotal="itemsTotal" />
      </div>

      <CollectionGridEditorOverlay
        :items="items"
        :orderedFields="orderedFields"
        :rowIds="rowIds"
      />

      <div
        v-if="contextMenuOpen"
        class="fixed z-50 min-w-48 rounded-md border border-(--border-color) bg-(--bg-secondary) p-1 text-base shadow-lg"
        :style="{
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`,
        }"
        @click.stop
      >
        <template v-for="(item, index) in contextMenuItems" :key="index">
          <div
            v-if="item.separator"
            class="my-1 border-t border-(--border-color)"
          />
          <button
            v-else
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="item.disabled"
            @click="onContextMenuAction(item)"
          >
            {{ item.label }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  toRef,
  watch,
} from "vue";
import {
  getCoreRowModel,
  useVueTable,
  type HeaderGroup,
  type Row,
} from "@tanstack/vue-table";
import { Columns, Plus } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import { useGridColumns } from "../../../composables/collection/grid/useGridColumns";
import { useGridEditing } from "../../../composables/collection/grid/useGridEditing";
import { useGridSelection } from "../../../composables/collection/grid/useGridSelection";
import type {
  DuplicateItemInput,
  Field,
  InsertItemAtInput,
  Item,
  MoveItemInput,
  NumberFieldRange,
} from "../../../types/models";
import { itemsRepository } from "../../../repositories/itemsRepository";
import { parseFieldOptions } from "../../../utils/fieldOptions";
import { normalizeUniqueKey } from "../../../utils/fieldUnique";
import type { MultiSortMeta } from "../types";
import CollectionGridBody from "./CollectionGridBody.vue";
import CollectionGridEditorOverlay from "./CollectionGridEditorOverlay.vue";
import CollectionGridFooter from "./CollectionGridFooter.vue";
import CollectionGridHeader from "./CollectionGridHeader.vue";
import CollectionGridToolbar from "./CollectionGridToolbar.vue";
import {
  buildGridContextMenuActions,
  type ContextMenuAction,
} from "./collectionGridContextMenu";
import { gridEditingKey, gridSelectionKey } from "./types";

type RowContextMenuPayload = {
  event: MouseEvent;
  row: Item;
  rowIndex: number;
  totalRows: number;
};

const props = defineProps<{
  collectionId: number;
  viewId: number;
  items: Item[];
  itemsTotal: number;
  itemsLoading: boolean;
  itemsFullyLoaded: boolean;
  orderedFields: Field[];
  searchQuery: string;
  debouncedSearchQuery: string;
  multiSortMeta: MultiSortMeta[];
  loadNextPage: () => Promise<void>;
  selectedRowIds: Set<number>;
}>();

const numberFieldRanges = ref<Record<number, NumberFieldRange>>({});
const gridScrollRef = ref<HTMLElement | null>(null);

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "update:multiSortMeta", value: MultiSortMeta[]): void;
  (e: "sort", value: MultiSortMeta[]): void;
  (e: "edit-item", value: Item): void;
  (e: "delete-item", value: Item): void;
  (e: "manage-fields"): void;
  (e: "open-add-item"): void;
  (e: "update-item", value: { id: number; data: Item["data"] }): void;
  (e: "insert-item-at", value: InsertItemAtInput): void;
  (e: "duplicate-item", value: DuplicateItemInput): void;
  (e: "move-item", value: MoveItemInput): void;
  (e: "update:selectedRowIds", value: Set<number>): void;
}>();

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit("update:searchQuery", value),
});

const {
  columns,
  gridTemplateColumns,
  setColumnWidth,
  resetColumnWidth,
  persistColumnWidths,
} = useGridColumns({
  orderedFields: computed(() => props.orderedFields),
  viewId: toRef(props, "viewId"),
});

const selection = useGridSelection();
const editing = useGridEditing({
  items: toRef(props, "items"),
  orderedFields: toRef(props, "orderedFields"),
  selection,
});

provide(gridSelectionKey, selection);
provide(gridEditingKey, editing);

const table = useVueTable<Item>({
  get data() {
    return props.items;
  },
  get columns() {
    return columns.value;
  },
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
});

const rows = computed<Row<Item>[]>(() => table.getRowModel().rows);
const rowIds = computed(() => rows.value.map((row) => row.original.id));
const headerGroups = computed<HeaderGroup<Item>[]>(() =>
  table.getHeaderGroups(),
);

const duplicateMap = computed(() => {
  const map = new Map<string, Set<string>>();
  const fieldsWithUnique = props.orderedFields.filter((field) => {
    const options = parseFieldOptions(field.type, field.options) as {
      uniqueCheck?: boolean;
    };
    return Boolean(options.uniqueCheck);
  });

  for (const field of fieldsWithUnique) {
    const counts = new Map<string, number>();
    for (const item of props.items) {
      const key = normalizeUniqueKey(field, item.data[field.name]);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicates = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) duplicates.add(key);
    }
    if (duplicates.size > 0) {
      map.set(field.name, duplicates);
    }
  }

  return map;
});

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

const contextMenuOpen = ref(false);
const contextMenuRow = ref<Item | null>(null);
const contextMenuRowIndex = ref<number | null>(null);
const contextMenuTotalRows = ref(0);
const contextMenuPosition = ref({ x: 0, y: 0 });

const contextMenuItems = computed<ContextMenuAction[]>(() => {
  return buildGridContextMenuActions({
    row: contextMenuRow.value,
    rowIndex: contextMenuRowIndex.value,
    totalRows: contextMenuTotalRows.value,
    onInsertItemAt: (payload) => emit("insert-item-at", payload),
    onDuplicateItem: (payload) => emit("duplicate-item", payload),
    onMoveItem: (payload) => emit("move-item", payload),
    onDeleteItem: (row) => emit("delete-item", row),
    closeContextMenu,
  });
});

function onSort(nextMeta: MultiSortMeta[]) {
  emit("update:multiSortMeta", nextMeta);
  emit("sort", nextMeta);
}

function onSetColumnWidth(payload: { fieldId: number; width: number }) {
  setColumnWidth(payload.fieldId, payload.width);
}

function onResetColumnWidth(payload: { fieldId: number }) {
  resetColumnWidth(payload.fieldId);
  void persistColumnWidths();
}

function onPersistColumnWidths() {
  void persistColumnWidths();
}

function onContextMenuAction(item: ContextMenuAction) {
  if ("separator" in item) {
    return;
  }

  if (item.disabled) {
    return;
  }

  item.command();
}

function onRowContextMenu(payload: RowContextMenuPayload) {
  contextMenuRow.value = payload.row;
  contextMenuRowIndex.value = payload.rowIndex;
  contextMenuTotalRows.value = payload.totalRows;
  contextMenuPosition.value = {
    x: payload.event.clientX,
    y: payload.event.clientY,
  };
  contextMenuOpen.value = true;
}

function closeContextMenu() {
  contextMenuOpen.value = false;
}

function onGridWheel(event: WheelEvent) {
  const scrollContainer = gridScrollRef.value;
  if (!scrollContainer) {
    return;
  }

  if (event.shiftKey) {
    scrollContainer.scrollLeft += event.deltaY || event.deltaX;
  }
}

function emitEditItem(item: Item) {
  emit("edit-item", item);
}

function notifyAddField() {
  emit("manage-fields");
}

function handleWindowClick() {
  closeContextMenu();
}

onMounted(() => {
  window.addEventListener("click", handleWindowClick);
  window.addEventListener("scroll", handleWindowClick, true);
});

watch(
  () => [props.collectionId, props.orderedFields, props.items] as const,
  () => {
    void loadNumberFieldRanges();
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("click", handleWindowClick);
  window.removeEventListener("scroll", handleWindowClick, true);
});
</script>
