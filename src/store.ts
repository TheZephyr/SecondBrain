import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  Collection,
  View,
  Field,
  Item,
  ItemSortSpec,
  NewCollectionInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  ReorderFieldsInput,
  NewItemInput,
  UpdateItemInput,
  InsertItemAtInput,
  DuplicateItemInput,
  MoveItemInput,
  BulkDeleteItemsInput,
  BulkPatchItemsInput,
  BulkMutationResult,
  PaginatedItemsResult,
} from "./types/models";
import { handleIpc } from "./utils/ipc";

type LoadItemsOptions = {
  page?: number;
  rows?: number;
  search?: string;
  sort?: ItemSortSpec[];
};

const DEFAULT_ITEMS_ROWS = 50;
const MAX_ITEMS_ROWS = 100;

export const useStore = defineStore("main", () => {
  // State
  const collections = ref<Collection[]>([]);
  const currentViews = ref<View[]>([]);
  const activeViewId = ref<number | null>(null);
  const fields = ref<Field[]>([]);
  const items = ref<Item[]>([]);
  const itemsTotal = ref(0);
  const itemsLoading = ref(false);
  const itemsPage = ref(0);
  const itemsRows = ref(DEFAULT_ITEMS_ROWS);
  const itemsSearch = ref("");
  const itemsSort = ref<ItemSortSpec[]>([]);
  const selectedCollection = ref<Collection | null>(null);
  const currentView = ref<"dashboard" | "collection">("dashboard");
  let itemsRequestToken = 0;
  let viewsRequestToken = 0;

  function clearItemsState() {
    itemsRequestToken += 1;
    items.value = [];
    itemsTotal.value = 0;
    itemsLoading.value = false;
    itemsPage.value = 0;
    itemsSearch.value = "";
    itemsSort.value = [];
  }

  function clearViewsState() {
    viewsRequestToken += 1;
    currentViews.value = [];
    activeViewId.value = null;
  }

  // Actions
  async function loadCollections() {
    const result = await window.electronAPI.getCollections();
    collections.value = handleIpc(result, "db:getCollections", []);
  }

  async function loadViews(collectionId: number) {
    const requestToken = ++viewsRequestToken;
    const result = await window.electronAPI.getViews(collectionId);
    const views = handleIpc(result, "db:getViews", []);
    if (requestToken !== viewsRequestToken) {
      return;
    }
    currentViews.value = views;
    const defaultView = views.find((view) => view.is_default === 1);
    activeViewId.value = defaultView?.id ?? views[0]?.id ?? null;
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
      await loadFields(selectedCollection.value.id);
    }
  }

  async function loadItems(collectionId: number, options: LoadItemsOptions = {}) {
    if (options.rows !== undefined) {
      itemsRows.value = Math.min(MAX_ITEMS_ROWS, Math.max(1, options.rows));
    }
    if (options.page !== undefined) {
      itemsPage.value = Math.max(0, options.page);
    }
    if (options.search !== undefined) {
      itemsSearch.value = options.search;
    }
    if (options.sort !== undefined) {
      itemsSort.value = options.sort;
    }

    const limit = Math.min(MAX_ITEMS_ROWS, Math.max(1, itemsRows.value));
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
        items: items.value,
        total: itemsTotal.value,
        limit,
        offset,
      };
      const payload = handleIpc(result, "db:getItems", fallback);

      if (requestToken !== itemsRequestToken) {
        return;
      }

      const resolvedPage =
        payload.limit > 0 ? Math.floor(payload.offset / payload.limit) : 0;

      items.value = payload.items;
      itemsTotal.value = payload.total;
      itemsRows.value = payload.limit;
      itemsPage.value = resolvedPage;

      if (
        payload.items.length === 0 &&
        payload.total > 0 &&
        resolvedPage > 0
      ) {
        await loadItems(collectionId, { page: resolvedPage - 1 });
      }
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
    itemsPage,
    itemsRows,
    itemsSearch,
    itemsSort,
    selectedCollection,
    currentView,
    loadCollections,
    loadViews,
    setActiveViewId,
    addCollection,
    updateCollection,
    deleteCollection,
    loadFields,
    addField,
    updateField,
    reorderFields,
    deleteField,
    loadItems,
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
