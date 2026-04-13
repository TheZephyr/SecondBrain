<template>
  <div class="flex h-full w-full min-h-0 flex-col" @click="closeContextMenu">
    <CollectionGridToolbar v-model:searchQuery="searchModel" :multiSortMeta="multiSortMeta" />

    <div v-if="orderedFields.length === 0" class="flex flex-1 flex-col items-center justify-center px-10 py-16 text-center">
      <Columns :size="64" :stroke-width="1.5" class="mb-5 text-[var(--text-muted)]" />
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">No Fields Yet</h3>
      <p class="mt-2 text-base text-[var(--text-muted)]">
        Define the structure of your collection by adding fields
      </p>
      <AppButton class="mt-6 min-w-[140px] gap-2 px-4 text-white" @click.stop="notifyAddField">
        <template #icon>
          <Plus class="size-4" />
        </template>
        Add Fields
      </AppButton>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col">
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-primary)]">
        <CollectionGridHeader
          :headerGroups="headerGroups"
          :gridTemplateColumns="gridTemplateColumns"
          :multiSortMeta="multiSortMeta"
          @sort="onSort"
          @manage-fields="notifyAddField"
          @set-column-width="onSetColumnWidth"
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
          :duplicateMap="duplicateMap"
          :loadNextPage="loadNextPage"
          @edit-item="emitEditItem"
          @row-contextmenu="onRowContextMenu"
        />
        <CollectionGridFooter :itemsTotal="itemsTotal" />
      </div>

      <CollectionGridEditorOverlay :items="items" :orderedFields="orderedFields" :rowIds="rowIds" />

      <div
        v-if="contextMenuOpen"
        class="fixed z-50 min-w-48 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1 text-base shadow-lg"
        :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
        @click.stop
      >
        <template v-for="(item, index) in contextMenuItems" :key="index">
          <div v-if="item.separator" class="my-1 border-t border-[var(--border-color)]" />
          <button
            v-else
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="item.disabled"
            @click="item.command"
          >
            {{ item.label }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, toRef } from "vue";
import { getCoreRowModel, useVueTable, type HeaderGroup, type Row } from "@tanstack/vue-table";
import { Columns, Plus } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import { useGridColumns } from "../../../composables/collection/grid/useGridColumns";
import { useGridEditing } from "../../../composables/collection/grid/useGridEditing";
import { useGridSelection } from "../../../composables/collection/grid/useGridSelection";
import type { DuplicateItemInput, Field, InsertItemAtInput, Item, MoveItemInput } from "../../../types/models";
import { parseFieldOptions } from "../../../utils/fieldOptions";
import { normalizeUniqueKey } from "../../../utils/fieldUnique";
import type { MultiSortMeta } from "../types";
import CollectionGridBody from "./CollectionGridBody.vue";
import CollectionGridEditorOverlay from "./CollectionGridEditorOverlay.vue";
import CollectionGridFooter from "./CollectionGridFooter.vue";
import CollectionGridHeader from "./CollectionGridHeader.vue";
import CollectionGridToolbar from "./CollectionGridToolbar.vue";
import { gridEditingKey, gridSelectionKey } from "./types";

type RowContextMenuPayload = {
  event: MouseEvent;
  row: Item;
  rowIndex: number;
  totalRows: number;
};

type ContextMenuAction =
  | { separator: true }
  | { label: string; disabled?: boolean; command: () => void; separator?: false };

const props = defineProps<{
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
}>();

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
}>();

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit("update:searchQuery", value),
});

const { columns, gridTemplateColumns, setColumnWidth, persistColumnWidths } = useGridColumns({
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
const headerGroups = computed<HeaderGroup<Item>[]>(() => table.getHeaderGroups());

const duplicateMap = computed(() => {
  const map = new Map<string, Set<string>>();
  const fieldsWithUnique = props.orderedFields.filter((field) => {
    const options = parseFieldOptions(field.type, field.options) as { uniqueCheck?: boolean };
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

const contextMenuOpen = ref(false);
const contextMenuRow = ref<Item | null>(null);
const contextMenuRowIndex = ref<number | null>(null);
const contextMenuTotalRows = ref(0);
const contextMenuPosition = ref({ x: 0, y: 0 });

const contextMenuItems = computed<ContextMenuAction[]>(() => {
  const row = contextMenuRow.value;
  const rowIndex = contextMenuRowIndex.value;
  const totalRows = contextMenuTotalRows.value;
  const isFirstOnPage = rowIndex === 0;
  const isLastOnPage = rowIndex !== null && rowIndex === totalRows - 1;
  const collectionId = row?.collection_id;

  return [
    {
      label: "Insert row above",
      command: () => {
        if (!row || collectionId === undefined) return;
        const afterOrder = row.order <= 0 ? null : row.order - 1;
        emit("insert-item-at", { collectionId, afterOrder });
        closeContextMenu();
      },
    },
    {
      label: "Insert row below",
      command: () => {
        if (!row || collectionId === undefined) return;
        emit("insert-item-at", { collectionId, afterOrder: row.order });
        closeContextMenu();
      },
    },
    {
      label: "Duplicate row",
      command: () => {
        if (!row || collectionId === undefined) return;
        emit("duplicate-item", { collectionId, itemId: row.id });
        closeContextMenu();
      },
    },
    { separator: true },
    {
      label: "Move up",
      disabled: !row || isFirstOnPage,
      command: () => {
        if (!row || collectionId === undefined || isFirstOnPage) return;
        emit("move-item", { collectionId, itemId: row.id, direction: "up" });
        closeContextMenu();
      },
    },
    {
      label: "Move down",
      disabled: !row || isLastOnPage,
      command: () => {
        if (!row || collectionId === undefined || isLastOnPage) return;
        emit("move-item", { collectionId, itemId: row.id, direction: "down" });
        closeContextMenu();
      },
    },
    { separator: true },
    {
      label: "Delete row",
      command: () => {
        if (!row) return;
        emit("delete-item", row);
        closeContextMenu();
      },
    },
  ];
});

function onSort(nextMeta: MultiSortMeta[]) {
  emit("update:multiSortMeta", nextMeta);
  emit("sort", nextMeta);
}

function onSetColumnWidth(payload: { fieldId: number; width: number }) {
  setColumnWidth(payload.fieldId, payload.width);
}

function onPersistColumnWidths() {
  void persistColumnWidths();
}

function onRowContextMenu(payload: RowContextMenuPayload) {
  contextMenuRow.value = payload.row;
  contextMenuRowIndex.value = payload.rowIndex;
  contextMenuTotalRows.value = payload.totalRows;
  contextMenuPosition.value = { x: payload.event.clientX, y: payload.event.clientY };
  contextMenuOpen.value = true;
}

function closeContextMenu() {
  contextMenuOpen.value = false;
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

onBeforeUnmount(() => {
  window.removeEventListener("click", handleWindowClick);
  window.removeEventListener("scroll", handleWindowClick, true);
});
</script>
