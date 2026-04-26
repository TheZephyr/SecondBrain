<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex min-h-0 flex-1 flex-col">
      <CollectionSettingsPanel v-if="collectionSettingsOpen" :collection="collection" :fields="fields"
        :itemsTotal="itemsTotal" @save-settings="saveSettings" @delete-collection="confirmDeleteCollection" />
      <CollectionFieldsPanel v-else-if="activeCollectionPanel === 'fields' && isSourceViewActive"
        :orderedFields="sourceOrderedFields" :items="items" @save-fields="saveFieldDrafts" />
      <CollectionChildFieldsPanel v-else-if="activeCollectionPanel === 'fields' && activeView"
        :orderedFields="sourceOrderedFields" :selectedFieldIds="selectedFieldIds" :viewType="activeView.type"
        :groupingFieldId="groupingFieldId" :groupingFields="groupingFields" @save-view-fields="saveChildViewFields" />
      <template v-else>
        <CollectionGrid :collectionId="collection.id" v-if="activeView?.type === 'grid'" :viewId="activeView.id"
          :items="items" :itemsTotal="itemsTotal" :itemsLoading="itemsLoading" :itemsFullyLoaded="itemsFullyLoaded"
          :orderedFields="viewOrderedFields" :searchQuery="searchQuery" :debouncedSearchQuery="debouncedSearchQuery"
          :multiSortMeta="multiSortMeta" :loadNextPage="loadNextPage" @update:searchQuery="searchQuery = $event"
          @update:multiSortMeta="multiSortMeta = $event" @sort="onItemsSort" @edit-item="openEditItemDialog"
          @delete-item="confirmDeleteItem" @update-item="onInlineUpdateItem" @insert-item-at="onInsertItemAt"
          @duplicate-item="onDuplicateItem" @move-item="onMoveItem"
          @manage-fields="store.setActiveCollectionPanel('fields')" @open-add-item="openAddItemDialog" />
        <CollectionKanbanView :collectionId="collection.id" v-else-if="activeView?.type === 'kanban'"
          :viewId="activeView.id" :items="items" :itemsLoading="itemsLoading" :itemsFullyLoaded="itemsFullyLoaded"
          :itemsSearch="itemsSearch" :itemsSort="itemsSort" :orderedFields="viewOrderedFields"
          :loadItems="loadCollectionItems" :groupingFieldId="groupingFieldId" :childViewConfig="childViewConfig"
          :saveViewConfig="store.saveViewConfig" @edit-item="openEditItemDialog" @add-item="openAddItemDialogWithData"
          @update-item="onInlineUpdateItem" />
        <CollectionCalendarView v-else-if="activeView?.type === 'calendar'" :viewId="activeView.id" :items="items"
          :itemsLoading="itemsLoading" :itemsFullyLoaded="itemsFullyLoaded" :itemsSearch="itemsSearch"
          :itemsSort="itemsSort" :orderedFields="viewOrderedFields" :loadItems="loadCollectionItems"
          :groupingFieldId="groupingFieldId" @edit-item="openEditItemDialog" />
      </template>
    </div>

    <div v-if="!collectionSettingsOpen && activeCollectionPanel !== 'fields' && sourceOrderedFields.length > 0"
      class="fixed bottom-16 right-6 z-40">
      <AppButton class="h-8 w-24 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:scale-110 
        hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] active:scale-95" @click="quickAddItem">
        <template #icon>
          <Plus />
        </template>
        Add item
      </AppButton>
    </div>

    <CollectionItemEditorDialog :visible="showAddItemForm" :orderedFields="viewOrderedFields" :editingItem="editingItem"
      :items="items" :initialData="initialItemData" @update:visible="onItemDialogVisibilityChange" @save="saveItem" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAppConfirm } from "@/components/app/ui/confirm-service";
import { useStore } from "../../store";
import { useNotificationsStore } from "../../stores/notifications";
import { useSafeFields } from "../../composables/collection/useSafeFields";
import {
  useCollectionItemsQuery,
  type LoadItemsOptions,
} from "../../composables/collection/useCollectionItemsQuery";
import type {
  Collection,
  DuplicateItemInput,
  Field,
  FieldOptions,
  FieldType,
  InsertItemAtInput,
  Item,
  ItemData,
  MoveItemInput,
  UpdateItemInput,
  ViewConfig,
} from "../../types/models";
import { parseMultiselectValue } from "../../utils/fieldValues";
import { parseFieldOptions, serializeFieldOptions } from "../../utils/fieldOptions";
import { mergeViewConfig } from "../../utils/viewConfig";
import {
  collectionNameSchema,
  fieldNameSchema,
} from "../../validation/schemas";
import CollectionCalendarView from "./calendar/CollectionCalendarView.vue";
import CollectionGrid from "./grid/CollectionGrid.vue";
import CollectionItemEditorDialog from "./CollectionItemEditorDialog.vue";
import CollectionKanbanView from "./kanban/CollectionKanbanView.vue";
import type {
  CollectionSettingsSavePayload,
  ItemEditorSavePayload,
} from "./types";
import { Plus } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import CollectionChildFieldsPanel from "./settings/CollectionChildFieldsPanel.vue";
import CollectionFieldsPanel from "./settings/CollectionFieldsPanel.vue";
import CollectionSettingsPanel from "./settings/CollectionSettingsPanel.vue";
import {
  createDefaultItemFormData,
  buildItemDataFromForm,
} from "../../composables/collection/useCollectionItemForm";

const store = useStore();
const { confirm } = useAppConfirm();
const notifications = useNotificationsStore();
const {
  fields,
  items,
  itemsTotal,
  itemsLoading,
  itemsFullyLoaded,
  itemsSearch,
  itemsSort,
  activeCollectionPanel,
  collectionSettingsOpen,
  currentViews,
  activeViewId,
} = storeToRefs(store);

const props = defineProps<{
  collection: Collection;
}>();

const emit = defineEmits<{
  (e: "collection-deleted"): void;
}>();

const showAddItemForm = ref(false);
const editingItem = ref<Item | null>(null);
const initialItemData = ref<ItemData | null>(null);

const { safeFields, orderedFields: sourceOrderedFields } = useSafeFields({
  fields,
  notifications,
});

const collectionId = computed(() => props.collection.id);
const activeView = computed(
  () =>
    currentViews.value.find((view) => view.id === activeViewId.value) ?? null,
);
const isSourceViewActive = computed(() => activeView.value?.is_default === 1);

const childViewConfig = ref<ViewConfig | null>(null);
let childConfigToken = 0;

function normalizeGroupingFieldId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const selectedFieldIds = computed(() => {
  if (!activeView.value || activeView.value.is_default === 1) {
    return [];
  }

  const configured = childViewConfig.value?.selectedFieldIds ?? [];
  if (configured.length > 0) {
    return configured;
  }

  return sourceOrderedFields.value.map((field) => field.id);
});

const viewOrderedFields = computed(() => {
  if (!activeView.value || activeView.value.is_default === 1) {
    return sourceOrderedFields.value;
  }

  const fieldMap = new Map(
    sourceOrderedFields.value.map((field) => [field.id, field]),
  );
  return selectedFieldIds.value
    .map((id) => fieldMap.get(id))
    .filter((field): field is Field => Boolean(field));
});

const groupingFieldId = computed(() => {
  if (!activeView.value || activeView.value.is_default === 1) {
    return null;
  }

  const configured = normalizeGroupingFieldId(
    childViewConfig.value?.groupingFieldId,
  );
  if (configured !== null) {
    return configured;
  }

  return normalizeGroupingFieldId(childViewConfig.value?.calendarDateFieldId);
});

const groupingFields = computed(() => {
  if (!activeView.value) return [];
  if (activeView.value.type === "kanban") {
    return sourceOrderedFields.value.filter((field) => field.type === "select");
  }
  if (activeView.value.type === "calendar") {
    return sourceOrderedFields.value.filter((field) => field.type === "date");
  }
  return [];
});

async function loadCollectionItems(options: LoadItemsOptions = {}) {
  await store.loadItems(props.collection.id, options);
}

const {
  searchQuery,
  debouncedSearchQuery,
  multiSortMeta,
  onItemsSort,
  loadNextPage,
} = useCollectionItemsQuery({
  collectionId,
  viewId: activeViewId,
  activeViewType: computed(() => activeView.value?.type ?? null),
  safeFields,
  items,
  itemsLoading,
  itemsFullyLoaded,
  loadItems: loadCollectionItems,
  loadViewConfig: store.loadViewConfig,
  saveViewConfig: store.saveViewConfig,
});

watch(
  [activeViewId, currentViews],
  async () => {
    childViewConfig.value = null;

    const view =
      currentViews.value.find((entry) => entry.id === activeViewId.value) ??
      null;
    if (!view || view.is_default === 1) {
      return;
    }

    const token = ++childConfigToken;
    const config = await store.loadViewConfig(view.id);
    if (token !== childConfigToken) {
      return;
    }

    if (config && !config.groupingFieldId && config.calendarDateFieldId) {
      const migrated = mergeViewConfig(config, {
        calendarDateFieldId: undefined,
        groupingFieldId: config.calendarDateFieldId,
      });
      await store.saveViewConfig(view.id, migrated);
      if (token !== childConfigToken) {
        return;
      }
      childViewConfig.value = migrated;
      return;
    }

    childViewConfig.value = config;
  },
  { immediate: true },
);

watch(
  () => props.collection.id,
  () => {
    showAddItemForm.value = false;
    editingItem.value = null;
    store.setCollectionSettingsOpen(false);
  },
);

function openAddItemDialog() {
  editingItem.value = null;
  initialItemData.value = null;
  showAddItemForm.value = true;
}

function openEditItemDialog(item: Item) {
  editingItem.value = item;
  initialItemData.value = null;
  showAddItemForm.value = true;
}

async function quickAddItem() {
  const collectionId = props.collection.id;
  if (!collectionId || sourceOrderedFields.value.length === 0) return;

  const formData = createDefaultItemFormData(sourceOrderedFields.value);
  const data = buildItemDataFromForm(formData, sourceOrderedFields.value);

  const created = await store.addItem({ collectionId, data });
  if (created) {
    openEditItemDialog(created);
  }
}

function onItemDialogVisibilityChange(nextVisible: boolean) {
  showAddItemForm.value = nextVisible;
  if (!nextVisible) {
    editingItem.value = null;
    initialItemData.value = null;
  }
}

function openAddItemDialogWithData(data: ItemData) {
  editingItem.value = null;
  initialItemData.value = data;
  showAddItemForm.value = true;
}

async function onInlineUpdateItem(payload: UpdateItemInput) {
  await store.updateItem(payload);
}

async function onInsertItemAt(payload: InsertItemAtInput) {
  await store.insertItemAt(payload);
}

async function onDuplicateItem(payload: DuplicateItemInput) {
  await store.duplicateItem(payload);
}

async function onMoveItem(payload: MoveItemInput) {
  await store.moveItem(payload);
}

async function saveItem(payload: ItemEditorSavePayload) {
  if (payload.editingItemId) {
    await store.updateItem({
      id: payload.editingItemId,
      data: payload.data,
    });
  } else {
    await store.addItem({
      collectionId: props.collection.id,
      data: payload.data,
    });
  }

  showAddItemForm.value = false;
  editingItem.value = null;
  initialItemData.value = null;
}

function validateFieldOptions(type: FieldType, options: FieldOptions) {
  if (type !== "date") return true;
  const dateOptions = options as {
    highlight?: { type?: string; date?: string | null; target?: string; color?: string } | null;
  };
  const highlight = dateOptions.highlight;
  if (!highlight) return true;

  const hasType = Boolean(highlight.type);
  const hasColor = Boolean(highlight.color);
  const requiresDate = (highlight.target ?? "date") === "date";
  const hasDate = !requiresDate || Boolean(highlight.date);
  const complete = hasType && hasColor && hasDate;

  if (!complete) {
    notifications.push({
      severity: "warn",
      summary: "Incomplete highlight rule",
      detail: "Highlight rules require type and color. Custom-date highlights also require a date.",
      life: 5000,
    });
  }

  return complete;
}

async function clearRemovedOptions(field: Field, removedOptions: string[]) {
  if (!removedOptions.length || !["select", "multiselect"].includes(field.type))
    return;

  const updates = items.value.reduce(
    (acc, item) => {
      const currentValue = item.data[field.name];
      if (field.type === "select") {
        if (
          typeof currentValue === "string" &&
          removedOptions.includes(currentValue)
        ) {
          acc.push({ id: item.id, patch: { [field.name]: null } });
        }
        return acc;
      }

      const parsed = parseMultiselectValue(currentValue);
      if (parsed.length === 0) return acc;

      const next = parsed.filter((value) => !removedOptions.includes(value));
      if (next.length === parsed.length) return acc;

      acc.push({
        id: item.id,
        patch: { [field.name]: next.length > 0 ? JSON.stringify(next) : null },
      });
      return acc;
    },
    [] as { id: number; patch: Record<string, string | number | null> }[],
  );

  if (updates.length === 0) return;

  await store.bulkPatchItems({
    collectionId: props.collection.id,
    updates,
  });
}

async function saveFieldDrafts(payload: {
  drafts: Array<{
    id: number | null;
    name: string;
    type: FieldType;
    description: string | null;
    options: FieldOptions;
  }>;
  deletedFieldIds: number[];
}) {
  const existingFieldById = new Map(
    fields.value.map((field) => [field.id, field]),
  );
  const normalizedDrafts: Array<{
    id: number | null;
    name: string;
    type: FieldType;
    description: string | null;
    options: FieldOptions;
  }> = [];

  for (const draft of payload.drafts) {
    const nameResult = fieldNameSchema.safeParse(draft.name);
    if (!nameResult.success) {
      notifications.push({
        severity: "warn",
        summary: "Invalid field name",
        detail:
          nameResult.error.issues[0]?.message ||
          "Please enter a valid field name.",
        life: 5000,
      });
      return;
    }

    if (!validateFieldOptions(draft.type, draft.options)) {
      return;
    }

    normalizedDrafts.push({
      ...draft,
      name: nameResult.data,
    });
  }

  const removedFieldIdSet = new Set(payload.deletedFieldIds);
  const removedOptionsByFieldId = new Map<number, string[]>();
  for (const draft of normalizedDrafts) {
    if (draft.id === null) {
      continue;
    }

    const existing = existingFieldById.get(draft.id);
    if (!existing) {
      continue;
    }

    if (existing.type === "select" || existing.type === "multiselect") {
      const currentChoices = (
        parseFieldOptions(existing.type, existing.options) as { choices?: string[] }
      ).choices ?? [];
      const nextChoices = (draft.options as { choices?: string[] }).choices ?? [];
      removedOptionsByFieldId.set(
        draft.id,
        currentChoices.filter((choice) => !nextChoices.includes(choice)),
      );
    }
  }

  const createdFieldIds = new Map<number, number>();
  for (const [index, draft] of normalizedDrafts.entries()) {
    if (draft.id !== null) {
      continue;
    }

    const created = await store.addField({
      collectionId: props.collection.id,
      name: draft.name,
      type: draft.type,
      description: draft.description,
      options: serializeFieldOptions(draft.options),
      orderIndex: fields.value.length + index,
    });
    if (created?.id) {
      createdFieldIds.set(index, created.id);
    }
  }

  for (const draft of normalizedDrafts) {
    if (draft.id === null || removedFieldIdSet.has(draft.id)) {
      continue;
    }

    const existing = existingFieldById.get(draft.id);
    if (!existing) {
      continue;
    }

    await store.updateField({
      id: existing.id,
      name: draft.name,
      type: existing.type,
      description: draft.description,
      options: serializeFieldOptions(draft.options),
      orderIndex: existing.order_index,
    });

    await clearRemovedOptions(
      { ...existing, name: draft.name },
      removedOptionsByFieldId.get(existing.id) ?? [],
    );
  }

  for (const fieldId of payload.deletedFieldIds) {
    await store.deleteField(fieldId);
  }

  await store.loadFields(props.collection.id);

  const latestFieldsByName = new Map(
    fields.value.map((field) => [field.name, field.id]),
  );
  const finalFieldOrders = normalizedDrafts
    .map((draft, index) => {
      const resolvedId =
        draft.id ??
        createdFieldIds.get(index) ??
        latestFieldsByName.get(draft.name) ??
        null;
      return resolvedId === null
        ? null
        : {
          id: resolvedId,
          orderIndex: index,
        };
    })
    .filter((entry): entry is { id: number; orderIndex: number } => Boolean(entry));

  if (finalFieldOrders.length > 0) {
    await store.reorderFields({
      collectionId: props.collection.id,
      fieldOrders: finalFieldOrders,
    });
  }
}

async function saveChildViewFields(payload: {
  selectedFieldIds: number[];
  groupingFieldId: number | null;
}) {
  const viewId = activeView.value?.id;
  if (!viewId || activeView.value?.is_default === 1) {
    return;
  }

  const nextSelectedIds =
    payload.selectedFieldIds.length > 0
      ? payload.selectedFieldIds
      : sourceOrderedFields.value.map((field) => field.id);

  const config = mergeViewConfig(childViewConfig.value, {
    selectedFieldIds: nextSelectedIds,
    groupingFieldId: normalizeGroupingFieldId(payload.groupingFieldId) ?? undefined,
    calendarDateFieldId: undefined,
    kanbanColumnOrder:
      activeView.value?.type === "kanban"
        ? childViewConfig.value?.kanbanColumnOrder
        : undefined,
  });

  await store.saveViewConfig(viewId, config);
  if (activeView.value?.id === viewId) {
    childViewConfig.value = config;
  }
}

async function confirmDeleteItem(item: Item) {
  const accepted = await confirm({
    title: "Delete Item",
    description: "Are you sure you want to delete this row?",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    destructive: true,
  });

  if (accepted) {
    await store.deleteItem(item);
  }
}

async function saveSettings(payload: CollectionSettingsSavePayload) {
  const nameResult = collectionNameSchema.safeParse(payload.name);

  if (!nameResult.success) {
    const detail =
      nameResult.error.issues[0]?.message ||
      "Please check your collection settings.";
    notifications.push({
      severity: "warn",
      summary: "Invalid collection settings",
      detail,
      life: 5000,
    });
    return;
  }

  await store.updateCollection({
    id: props.collection.id,
    name: nameResult.data,
  });

  store.setCollectionSettingsOpen(false);
}

async function confirmDeleteCollection() {
  const accepted = await confirm({
    title: "Delete Collection",
    description: `Delete "${props.collection.name}" and all its data? This cannot be undone.`,
    confirmLabel: "Delete Collection",
    cancelLabel: "Cancel",
    destructive: true,
  });

  if (accepted) {
    await store.deleteCollection(props.collection.id);
    emit("collection-deleted");
  }
}
</script>
