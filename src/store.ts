import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  Collection,
  Field,
  Item,
  ItemSortSpec,
  NewCollectionInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  NewItemInput,
  UpdateItemInput,
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

export const useStore = defineStore("main", () => {
  // State
  const collections = ref<Collection[]>([]);
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

  function clearItemsState() {
    itemsRequestToken += 1;
    items.value = [];
    itemsTotal.value = 0;
    itemsLoading.value = false;
    itemsPage.value = 0;
    itemsSearch.value = "";
    itemsSort.value = [];
  }

  // Actions
  async function loadCollections() {
    const result = await window.electronAPI.getCollections();
    collections.value = handleIpc(result, "db:getCollections", []);
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
      itemsRows.value = Math.max(1, options.rows);
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

    const limit = itemsRows.value;
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

  function selectCollection(collection: Collection | null) {
    selectedCollection.value = collection;
    if (collection) {
      currentView.value = "collection";
      clearItemsState();
      loadFields(collection.id);
      loadItems(collection.id);
    } else {
      currentView.value = "dashboard";
      fields.value = [];
      clearItemsState();
    }
  }

  function showDashboard() {
    selectCollection(null);
  }

  return {
    collections,
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
    addCollection,
    updateCollection,
    deleteCollection,
    loadFields,
    addField,
    updateField,
    deleteField,
    loadItems,
    addItem,
    updateItem,
    deleteItem,
    selectCollection,
    showDashboard,
  };
});
