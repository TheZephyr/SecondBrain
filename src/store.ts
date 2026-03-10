import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  Collection,
  CollectionPanelType,
  View,
  Field,
  Item,
  ItemSortSpec,
  NewCollectionInput,
  NewViewInput,
  UpdateViewInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  ReorderFieldsInput,
  ReorderViewsInput,
  NewItemInput,
  UpdateItemInput,
  InsertItemAtInput,
  DuplicateItemInput,
  MoveItemInput,
  BulkDeleteItemsInput,
  BulkPatchItemsInput,
  BulkMutationResult,
  PaginatedItemsResult,
  ViewConfig,
} from "./types/models";
import { handleIpc } from "./utils/ipc";

type LoadItemsOptions = {
  page?: number;
  search?: string;
  sort?: ItemSortSpec[];
};

const ITEMS_LIMIT = 100;

function areItemSortSpecsEqual(a: ItemSortSpec[], b: ItemSortSpec[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every(
    (entry, index) =>
      entry.field === b[index]?.field && entry.order === b[index]?.order,
  );
}

export const useStore = defineStore("main", () => {
  // State
  const collections = ref<Collection[]>([]);
  const currentViews = ref<View[]>([]);
  const activeViewId = ref<number | null>(null);
  const fields = ref<Field[]>([]);
  const items = ref<Item[]>([]);
  const itemsTotal = ref(0);
  const itemsLoading = ref(false);
  const itemsFullyLoaded = ref(false);
  const itemsPage = ref(0);
  const itemsSearch = ref("");
  const itemsSort = ref<ItemSortSpec[]>([]);
  const selectedCollection = ref<Collection | null>(null);
  const currentView = ref<"dashboard" | "collection">("dashboard");
  const activeCollectionPanel = ref<CollectionPanelType>("data");
  const collectionSettingsOpen = ref(false);
  let itemsRequestToken = 0;
  let viewsRequestToken = 0;

  function clearItemsState() {
    itemsRequestToken += 1;
    items.value = [];
    itemsTotal.value = 0;
    itemsLoading.value = false;
    itemsFullyLoaded.value = false;
    itemsPage.value = 0;
    itemsSearch.value = "";
    itemsSort.value = [];
  }

  function appendItems(nextItems: Item[]) {
    if (nextItems.length === 0) {
      return;
    }

    const existingIds = new Set(items.value.map((item) => item.id));
    const deduped = [...items.value];
    for (const item of nextItems) {
      if (existingIds.has(item.id)) {
        continue;
      }
      deduped.push(item);
      existingIds.add(item.id);
    }
    items.value = deduped;
  }

  function clearViewsState() {
    viewsRequestToken += 1;
    currentViews.value = [];
    activeViewId.value = null;
  }

  function getOrderedFieldIds(collectionId: number): number[] {
    return [...fields.value]
      .filter((field) => field.collection_id === collectionId)
      .sort((a, b) => {
        if (a.order_index !== b.order_index) {
          return a.order_index - b.order_index;
        }
        return a.id - b.id;
      })
      .map((field) => field.id);
  }

  function normalizeSelectedFieldIds(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const seen = new Set<number>();
    const normalized: number[] = [];
    for (const entry of value) {
      const parsed = Number(entry);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        continue;
      }
      if (seen.has(parsed)) {
        continue;
      }
      seen.add(parsed);
      normalized.push(parsed);
    }
    return normalized;
  }

  function normalizeCalendarDateFieldId(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  async function updateChildViewFieldSelections(
    collectionId: number,
    updater: (currentIds: number[], allFieldIds: number[]) => number[],
  ) {
    const childViews = currentViews.value.filter(
      (view) => view.collection_id === collectionId && view.is_default === 0,
    );
    if (childViews.length === 0) {
      return;
    }

    const allFieldIds = getOrderedFieldIds(collectionId);
    for (const view of childViews) {
      const existing = await loadViewConfig(view.id);
      const existingSelected = normalizeSelectedFieldIds(
        existing?.selectedFieldIds,
      );
      const baseSelected =
        existingSelected.length > 0 ? existingSelected : allFieldIds;
      const nextSelected = updater(baseSelected, allFieldIds);
      const unchanged =
        nextSelected.length === baseSelected.length &&
        nextSelected.every((id, index) => id === baseSelected[index]);

      if (unchanged) {
        continue;
      }

      await saveViewConfig(view.id, {
        columnWidths: existing?.columnWidths ?? {},
        sort: existing?.sort ?? [],
        calendarDateField: existing?.calendarDateField,
        calendarDateFieldId: existing?.calendarDateFieldId,
        selectedFieldIds: nextSelected,
      });
    }
  }

  // Actions
  async function loadCollections() {
    const result = await window.electronAPI.getCollections();
    collections.value = handleIpc(result, "db:getCollections", []);
  }

  async function loadViews(
    collectionId: number,
    options: { preserveActive?: boolean } = {},
  ) {
    const requestToken = ++viewsRequestToken;
    const result = await window.electronAPI.getViews(collectionId);
    const views = handleIpc(result, "db:getViews", []);
    if (requestToken !== viewsRequestToken) {
      return;
    }
    currentViews.value = views;
    if (options.preserveActive && activeViewId.value !== null) {
      const stillExists = views.some((view) => view.id === activeViewId.value);
      if (stillExists) {
        return;
      }
    }
    const defaultView = views.find((view) => view.is_default === 1);
    activeViewId.value = defaultView?.id ?? views[0]?.id ?? null;
  }

  function setActiveCollectionPanel(panel: CollectionPanelType) {
    activeCollectionPanel.value = panel;
  }

  function setCollectionSettingsOpen(open: boolean) {
    collectionSettingsOpen.value = open;
  }

  function setActiveViewId(id: number | null) {
    activeViewId.value = id;
  }

  async function addCollection(collection: NewCollectionInput) {
    const result = await window.electronAPI.addCollection(collection);
    const newCollection = handleIpc(result, "db:addCollection", null);
    if (newCollection) {
      await loadCollections();
    }
    return newCollection;
  }

  async function addView(view: NewViewInput) {
    const result = await window.electronAPI.addView(view);
    const created = handleIpc(result, "db:addView", null);
    if (created) {
      await loadViews(view.collectionId, { preserveActive: true });
      activeViewId.value = created.id;
    }
    return created;
  }

  async function updateView(view: UpdateViewInput) {
    if (!selectedCollection.value) return false;
    const result = await window.electronAPI.updateView(view);
    const success = handleIpc(result, "db:updateView", false);
    if (success) {
      await loadViews(selectedCollection.value.id, { preserveActive: true });
      if (
        activeViewId.value !== null &&
        !currentViews.value.some((viewItem) => viewItem.id === activeViewId.value)
      ) {
        const fallback = currentViews.value[0];
        activeViewId.value = fallback?.id ?? null;
      }
    }
    return success;
  }

  async function deleteView(id: number) {
    if (!selectedCollection.value) return false;
    const result = await window.electronAPI.deleteView(id);
    const success = handleIpc(result, "db:deleteView", false);
    if (success) {
      const previousActiveViewId = activeViewId.value;
      await loadViews(selectedCollection.value.id, { preserveActive: true });
      if (
        previousActiveViewId !== null &&
        !currentViews.value.some((viewItem) => viewItem.id === previousActiveViewId)
      ) {
        const fallback = currentViews.value[0];
        activeViewId.value = fallback?.id ?? null;
      }
    }
    return success;
  }

  async function loadViewConfig(viewId: number): Promise<ViewConfig | null> {
    const parsedViewId = Number(viewId);
    if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
      return null;
    }

    const result = await window.electronAPI.getViewConfig(parsedViewId);
    return handleIpc(result, "db:getViewConfig", null);
  }

  async function saveViewConfig(viewId: number, config: ViewConfig): Promise<void> {
    const parsedViewId = Number(viewId);
    if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
      return;
    }

    const normalizedColumnWidths = Object.fromEntries(
      Object.entries(config.columnWidths).map(([fieldId, width]) => [
        Number(fieldId),
        Math.max(60, Math.round(Number(width))),
      ]),
    ) as Record<number, number>;

    const normalizedConfig: ViewConfig = {
      columnWidths: normalizedColumnWidths,
      sort: config.sort.map((entry) => ({
        field: String(entry.field),
        order: entry.order === -1 ? -1 : 1,
      })),
      calendarDateField:
        typeof config.calendarDateField === "string" &&
        config.calendarDateField.trim().length > 0
          ? config.calendarDateField.trim()
          : undefined,
      calendarDateFieldId: normalizeCalendarDateFieldId(
        config.calendarDateFieldId,
      ),
      selectedFieldIds: normalizeSelectedFieldIds(config.selectedFieldIds),
    };

    const result = await window.electronAPI.updateViewConfig({
      viewId: parsedViewId,
      config: normalizedConfig,
    });
    handleIpc(result, "db:updateViewConfig", false);
  }

  async function updateCollection(collection: UpdateCollectionInput) {
    const result = await window.electronAPI.updateCollection(collection);
    const success = handleIpc(result, "db:updateCollection", false);
    if (success) {
      await loadCollections();
    }
  }

  async function deleteCollection(id: number) {
    const result = await window.electronAPI.deleteCollection(id);
    const success = handleIpc(result, "db:deleteCollection", false);
    if (success) {
      await loadCollections();
      if (selectedCollection.value?.id === id) {
        selectedCollection.value = null;
        clearViewsState();
      }
    }
  }

  async function loadFields(collectionId: number) {
    const result = await window.electronAPI.getFields(collectionId);
    fields.value = handleIpc(result, "db:getFields", []);
  }

  async function addField(field: NewFieldInput) {
    const result = await window.electronAPI.addField(field);
    const created = handleIpc(result, "db:addField", null);
    if (created) {
      await loadFields(field.collectionId);
      await updateChildViewFieldSelections(
        field.collectionId,
        (currentIds, allFieldIds) => {
          const next = [...currentIds];
          if (!next.includes(created.id)) {
            next.push(created.id);
          }
          if (next.length === 0) {
            return allFieldIds;
          }
          return next;
        },
      );
    }
  }

  async function updateField(field: UpdateFieldInput) {
    if (!selectedCollection.value) return;

    const result = await window.electronAPI.updateField(field);
    const success = handleIpc(result, "db:updateField", false);
    if (success) {
      await loadFields(selectedCollection.value.id);
    }
  }

  async function reorderFields(input: ReorderFieldsInput) {
    const payload: ReorderFieldsInput = {
      collectionId: input.collectionId,
      fieldOrders: input.fieldOrders.map((entry) => ({
        id: entry.id,
        orderIndex: entry.orderIndex,
      })),
    };

    const result = await window.electronAPI.reorderFields(payload);
    const success = handleIpc(result, "db:reorderFields", false);
    if (success) {
      await loadFields(payload.collectionId);
    }
  }

  async function deleteField(fieldId: number) {
    if (!selectedCollection.value) return;

    const result = await window.electronAPI.deleteField(fieldId);
    const success = handleIpc(result, "db:deleteField", false);
    if (success) {
      const collectionId = selectedCollection.value.id;
      await loadFields(collectionId);
      await updateChildViewFieldSelections(
        collectionId,
        (currentIds, allFieldIds) => {
          const next = currentIds.filter((id) => id !== fieldId);
          if (next.length === 0 && allFieldIds.length > 0) {
            return allFieldIds;
          }
          return next;
        },
      );
    }
  }

  async function reorderViews(input: ReorderViewsInput) {
    const payload: ReorderViewsInput = {
      collectionId: input.collectionId,
      viewOrders: input.viewOrders.map((entry) => ({
        id: entry.id,
        order: entry.order,
      })),
    };

    const result = await window.electronAPI.reorderViews(payload);
    const success = handleIpc(result, "db:reorderViews", false);
    if (success) {
      await loadViews(payload.collectionId, { preserveActive: true });
    }
    return success;
  }

  async function loadItems(collectionId: number, options: LoadItemsOptions = {}) {
    const searchChanged =
      options.search !== undefined && options.search !== itemsSearch.value;
    const sortChanged =
      options.sort !== undefined &&
      !areItemSortSpecsEqual(options.sort, itemsSort.value);

    if (options.search !== undefined) {
      itemsSearch.value = options.search;
    }
    if (options.sort !== undefined) {
      itemsSort.value = options.sort;
    }

    let nextPage = options.page !== undefined ? Math.max(0, options.page) : 0;
    if (searchChanged || sortChanged) {
      nextPage = 0;
    }

    itemsPage.value = nextPage;
    const shouldResetItems = itemsPage.value === 0;
    if (shouldResetItems) {
      items.value = [];
      itemsFullyLoaded.value = false;
    }

    const limit = ITEMS_LIMIT;
    const offset = itemsPage.value * limit;
    const requestToken = ++itemsRequestToken;
    itemsLoading.value = true;

    try {
      const requestSort: ItemSortSpec[] = itemsSort.value.map((entry) => ({
        field: String(entry.field),
        order: entry.order === -1 ? -1 : 1,
      }));
      const requestSearch = String(itemsSearch.value ?? "");

      const result = await window.electronAPI.getItems({
        collectionId,
        limit,
        offset,
        search: requestSearch,
        sort: requestSort,
      });

      const fallback: PaginatedItemsResult = {
        items: shouldResetItems ? [] : items.value,
        total: shouldResetItems ? 0 : itemsTotal.value,
        limit,
        offset,
      };
      const payload = handleIpc(result, "db:getItems", fallback);

      if (requestToken !== itemsRequestToken) {
        return;
      }

      const resolvedPage =
        payload.limit > 0 ? Math.floor(payload.offset / payload.limit) : 0;

      if (resolvedPage === 0) {
        items.value = payload.items;
      } else {
        appendItems(payload.items);
      }
      itemsTotal.value = payload.total;
      itemsPage.value = resolvedPage;
      itemsFullyLoaded.value = items.value.length >= payload.total;
    } finally {
      if (requestToken === itemsRequestToken) {
        itemsLoading.value = false;
      }
    }
  }

  async function addItem(item: NewItemInput) {
    const result = await window.electronAPI.addItem(item);
    const created = handleIpc(result, "db:addItem", null);
    if (created) {
      await loadItems(item.collectionId);
    }
    return created;
  }

  async function insertItemAt(input: InsertItemAtInput) {
    const payload: InsertItemAtInput = {
      collectionId: input.collectionId,
      afterOrder: input.afterOrder === null ? null : Number(input.afterOrder),
    };

    const result = await window.electronAPI.insertItemAt(payload);
    const created = handleIpc(result, "db:insertItemAt", null);
    if (created && selectedCollection.value?.id === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return created;
  }

  async function duplicateItem(input: DuplicateItemInput) {
    const payload: DuplicateItemInput = {
      collectionId: input.collectionId,
      itemId: input.itemId,
    };

    const result = await window.electronAPI.duplicateItem(payload);
    const created = handleIpc(result, "db:duplicateItem", null);
    if (created && selectedCollection.value?.id === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return created;
  }

  async function moveItem(input: MoveItemInput) {
    const payload: MoveItemInput = {
      collectionId: input.collectionId,
      itemId: input.itemId,
      direction: input.direction,
    };

    const result = await window.electronAPI.moveItem(payload);
    const success = handleIpc(result, "db:moveItem", false);
    if (success && selectedCollection.value?.id === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return success;
  }

  async function updateItem(item: UpdateItemInput) {
    if (!selectedCollection.value) return;
    const result = await window.electronAPI.updateItem(item);
    const success = handleIpc(result, "db:updateItem", false);
    if (success) {
      await loadItems(selectedCollection.value.id);
    }
  }

  async function deleteItem(item: Item) {
    if (!selectedCollection.value) return;
    const result = await window.electronAPI.deleteItem(item.id);
    const success = handleIpc(result, "db:deleteItem", false);
    if (success) {
      await loadItems(selectedCollection.value.id);
    }
  }

  async function bulkDeleteItems(
    input: BulkDeleteItemsInput,
  ): Promise<BulkMutationResult | null> {
    const payload: BulkDeleteItemsInput = {
      collectionId: input.collectionId,
      itemIds: [...input.itemIds],
    };

    const result = await window.electronAPI.bulkDeleteItems(payload);
    const mutationResult = handleIpc(
      result,
      "db:bulkDeleteItems",
      { affectedCount: 0 } satisfies BulkMutationResult,
    );
    if (!result.ok) {
      return null;
    }
    if (selectedCollection.value?.id === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return mutationResult;
  }

  async function bulkPatchItems(
    input: BulkPatchItemsInput,
  ): Promise<BulkMutationResult | null> {
    const payload: BulkPatchItemsInput = {
      collectionId: input.collectionId,
      updates: input.updates.map((update) => ({
        id: update.id,
        patch: { ...update.patch },
      })),
    };

    const result = await window.electronAPI.bulkPatchItems(payload);
    const mutationResult = handleIpc(
      result,
      "db:bulkPatchItems",
      { affectedCount: 0 } satisfies BulkMutationResult,
    );
    if (!result.ok) {
      return null;
    }
    if (selectedCollection.value?.id === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return mutationResult;
  }

  function selectCollection(collection: Collection | null) {
    selectedCollection.value = collection;
    if (collection) {
      currentView.value = "collection";
      clearItemsState();
      clearViewsState();
      loadFields(collection.id);
      loadItems(collection.id);
      loadViews(collection.id);
    } else {
      currentView.value = "dashboard";
      fields.value = [];
      clearItemsState();
      clearViewsState();
    }

    activeCollectionPanel.value = "data";
    collectionSettingsOpen.value = false;
  }

  function showDashboard() {
    selectCollection(null);
  }

  return {
    collections,
    currentViews,
    activeViewId,
    fields,
    items,
    itemsTotal,
    itemsLoading,
    itemsFullyLoaded,
    itemsSearch,
    itemsSort,
    selectedCollection,
    currentView,
    activeCollectionPanel,
    collectionSettingsOpen,
    addView,
    updateView,
    deleteView,
    loadViewConfig,
    saveViewConfig,
    loadCollections,
    loadViews,
    setActiveViewId,
    setActiveCollectionPanel,
    setCollectionSettingsOpen,
    addCollection,
    updateCollection,
    deleteCollection,
    loadFields,
    addField,
    updateField,
    reorderFields,
    deleteField,
    reorderViews,
    loadItems,
    appendItems,
    addItem,
    insertItemAt,
    duplicateItem,
    moveItem,
    updateItem,
    deleteItem,
    bulkDeleteItems,
    bulkPatchItems,
    selectCollection,
    showDashboard,
  };
});
