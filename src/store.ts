import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  Collection,
  Field,
  Item,
  NewCollectionInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  NewItemInput,
  UpdateItemInput,
} from "./types/models";
import { handleIpc } from "./utils/ipc";

export const useStore = defineStore("main", () => {
  // State
  const collections = ref<Collection[]>([]);
  const fields = ref<Field[]>([]);
  const items = ref<Item[]>([]);
  const selectedCollection = ref<Collection | null>(null);
  const currentView = ref<"dashboard" | "collection">("dashboard");

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

  async function loadItems(collectionId: number) {
    const result = await window.electronAPI.getItems(collectionId);
    items.value = handleIpc(result, "db:getItems", []);
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
      loadFields(collection.id);
      loadItems(collection.id);
    } else {
      currentView.value = "dashboard";
      fields.value = [];
      items.value = [];
    }
  }

  function showDashboard() {
    selectCollection(null);
  }

  return {
    collections,
    fields,
    items,
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
