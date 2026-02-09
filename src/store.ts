import { defineStore } from "pinia";
import { ref } from "vue";

export const useStore = defineStore("main", () => {
  // State
  const collections = ref<any[]>([]);
  const fields = ref<any[]>([]);
  const items = ref<any[]>([]);
  const selectedCollection = ref<any>(null);
  const currentView = ref<"dashboard" | "collection">("dashboard");

  // Actions
  async function loadCollections() {
    collections.value = await window.electronAPI.getCollections();
  }

  async function addCollection(collection: any) {
    const newCollection = await window.electronAPI.addCollection(collection);
    await loadCollections();
    return newCollection;
  }

  async function updateCollection(collection: any) {
    await window.electronAPI.updateCollection(collection);
    await loadCollections();
  }

  async function deleteCollection(id: number) {
    await window.electronAPI.deleteCollection(id);
    await loadCollections();
    if (selectedCollection.value?.id === id) {
      selectedCollection.value = null;
    }
  }

  async function loadFields(collectionId: number) {
    fields.value = await window.electronAPI.getFields(collectionId);
  }

  async function addField(field: any) {
    await window.electronAPI.addField(field);
    await loadFields(field.collectionId);
  }

  async function updateField(field: any) {
    if (!selectedCollection.value) return;

    await window.electronAPI.updateField(field);
    await loadFields(selectedCollection.value.id);
  }

  async function deleteField(fieldId: number) {
    if (!selectedCollection.value) return;

    await window.electronAPI.deleteField(fieldId);
    await loadFields(selectedCollection.value.id);
  }

  async function loadItems(collectionId: number) {
    items.value = await window.electronAPI.getItems(collectionId);
  }

  async function addItem(item: any) {
    await window.electronAPI.addItem(item);
    await loadItems(item.collectionId);
  }

  async function updateItem(item: any) {
    await window.electronAPI.updateItem(item);
    await loadItems(selectedCollection.value.id);
  }

  async function deleteItem(item: any) {
    await window.electronAPI.deleteItem(item.id);
    await loadItems(selectedCollection.value.id);
  }

  function selectCollection(collection: any) {
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
