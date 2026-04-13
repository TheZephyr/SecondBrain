import { defineStore, storeToRefs } from "pinia";
import type {
  BulkDeleteItemsInput,
  BulkMutationResult,
  BulkPatchItemsInput,
  Collection,
  CollectionPanelType,
  DuplicateItemInput,
  InsertItemAtInput,
  Item,
  ItemSortSpec,
  MoveItemInput,
  NewCollectionInput,
  NewFieldInput,
  NewItemInput,
  NewViewInput,
  ReorderFieldsInput,
  ReorderItemsInput,
  ReorderViewsInput,
  UpdateCollectionInput,
  UpdateFieldInput,
  UpdateItemInput,
  UpdateViewInput,
  ViewConfig,
} from "./types/models";
import { useCollectionsStore } from "./stores/collections";
import { useItemsStore } from "./stores/items";
import { useNavigationStore } from "./stores/navigation";
import { useSettingsStore } from "./stores/settings";

export const useStore = defineStore("main", () => {
  const collectionsStore = useCollectionsStore();
  const itemsStore = useItemsStore();
  const navigationStore = useNavigationStore();
  const settingsStore = useSettingsStore();
  const collectionRefs = storeToRefs(collectionsStore);
  const itemRefs = storeToRefs(itemsStore);
  const navigationRefs = storeToRefs(navigationStore);

  function setActiveCollectionPanel(panel: CollectionPanelType): void {
    navigationStore.setActiveCollectionPanel(panel);
  }

  function setCollectionSettingsOpen(open: boolean): void {
    navigationStore.setCollectionSettingsOpen(open);
  }

  function setActiveViewId(id: number | null): void {
    collectionsStore.setActiveViewId(id);
  }

  function resetForNoCollection(
    nextView: "dashboard" | "settings",
  ): void {
    collectionsStore.setSelectedCollection(null);
    collectionsStore.clearFieldsState();
    collectionsStore.clearViewsState();
    itemsStore.setActiveCollectionId(null);
    itemsStore.clearItemsState();
    navigationStore.setCurrentView(nextView);
    navigationStore.resetCollectionUiState();
  }

  function selectCollection(collection: Collection | null): void {
    collectionsStore.setSelectedCollection(collection);

    if (!collection) {
      resetForNoCollection("dashboard");
      return;
    }

    navigationStore.setCurrentView("collection");
    navigationStore.resetCollectionUiState();
    itemsStore.setActiveCollectionId(collection.id);
    itemsStore.clearItemsState();
    collectionsStore.clearViewsState();

    void collectionsStore.loadFields(collection.id);
    void itemsStore.loadItems(collection.id);
    void collectionsStore.loadViews(collection.id);
  }

  function showDashboard(): void {
    resetForNoCollection("dashboard");
  }

  function showSettings(): void {
    resetForNoCollection("settings");
  }

  async function deleteCollection(id: number): Promise<boolean> {
    const wasSelected = collectionsStore.selectedCollection?.id === id;
    const success = await collectionsStore.deleteCollection(id);
    if (success && wasSelected) {
      showDashboard();
    }
    return success;
  }

  async function addCollection(
    collection: NewCollectionInput,
  ): Promise<Collection | null> {
    return collectionsStore.addCollection(collection);
  }

  async function updateCollection(
    collection: UpdateCollectionInput,
  ): Promise<boolean> {
    return collectionsStore.updateCollection(collection);
  }

  async function addView(view: NewViewInput) {
    return collectionsStore.addView(view);
  }

  async function updateView(view: UpdateViewInput) {
    return collectionsStore.updateView(view);
  }

  async function deleteView(id: number) {
    return collectionsStore.deleteView(id);
  }

  async function loadViewConfig(viewId: number): Promise<ViewConfig | null> {
    return collectionsStore.loadViewConfig(viewId);
  }

  async function saveViewConfig(viewId: number, config: ViewConfig): Promise<void> {
    await collectionsStore.saveViewConfig(viewId, config);
  }

  async function loadCollections(): Promise<void> {
    await collectionsStore.loadCollections();
  }

  async function loadViews(
    collectionId: number,
    options?: { preserveActive?: boolean },
  ): Promise<void> {
    await collectionsStore.loadViews(collectionId, options);
  }

  async function loadFields(collectionId: number): Promise<void> {
    await collectionsStore.loadFields(collectionId);
  }

  async function addField(field: NewFieldInput) {
    return collectionsStore.addField(field);
  }

  async function updateField(field: UpdateFieldInput) {
    return collectionsStore.updateField(field);
  }

  async function reorderFields(input: ReorderFieldsInput) {
    return collectionsStore.reorderFields(input);
  }

  async function deleteField(fieldId: number) {
    return collectionsStore.deleteField(fieldId);
  }

  async function reorderViews(input: ReorderViewsInput) {
    return collectionsStore.reorderViews(input);
  }

  async function loadItems(
    collectionId: number,
    options?: { page?: number; search?: string; sort?: ItemSortSpec[] },
  ): Promise<void> {
    await itemsStore.loadItems(collectionId, options);
  }

  async function addItem(item: NewItemInput) {
    return itemsStore.addItem(item);
  }

  async function insertItemAt(input: InsertItemAtInput) {
    return itemsStore.insertItemAt(input);
  }

  async function duplicateItem(input: DuplicateItemInput) {
    return itemsStore.duplicateItem(input);
  }

  async function moveItem(input: MoveItemInput) {
    return itemsStore.moveItem(input);
  }

  async function updateItem(item: UpdateItemInput) {
    return itemsStore.updateItem(item);
  }

  async function deleteItem(item: Item) {
    return itemsStore.deleteItem(item.id);
  }

  async function reorderItems(input: ReorderItemsInput) {
    return itemsStore.reorderItems(input);
  }

  async function bulkDeleteItems(
    input: BulkDeleteItemsInput,
  ): Promise<BulkMutationResult | null> {
    return itemsStore.bulkDeleteItems(input);
  }

  async function bulkPatchItems(
    input: BulkPatchItemsInput,
  ): Promise<BulkMutationResult | null> {
    return itemsStore.bulkPatchItems(input);
  }

  return {
    collections: collectionRefs.collections,
    currentViews: collectionRefs.currentViews,
    activeViewId: collectionRefs.activeViewId,
    fields: collectionRefs.fields,
    items: itemRefs.items,
    itemsTotal: itemRefs.itemsTotal,
    itemsLoading: itemRefs.itemsLoading,
    itemsFullyLoaded: itemRefs.itemsFullyLoaded,
    itemsSearch: itemRefs.itemsSearch,
    itemsSort: itemRefs.itemsSort,
    selectedCollection: collectionRefs.selectedCollection,
    currentView: navigationRefs.currentView,
    activeCollectionPanel: navigationRefs.activeCollectionPanel,
    collectionSettingsOpen: navigationRefs.collectionSettingsOpen,
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
    appendItems: itemsStore.appendItems,
    addItem,
    insertItemAt,
    duplicateItem,
    moveItem,
    updateItem,
    deleteItem,
    bulkDeleteItems,
    bulkPatchItems,
    reorderItems,
    selectCollection,
    showDashboard,
    showSettings,
    settingsStore,
  };
});
