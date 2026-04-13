import { defineStore } from "pinia";
import { ref } from "vue";
import { itemsRepository } from "../repositories/itemsRepository";
import type {
  BulkDeleteItemsInput,
  BulkMutationResult,
  BulkPatchItemsInput,
  DuplicateItemInput,
  InsertItemAtInput,
  Item,
  ItemSortSpec,
  MoveItemInput,
  NewItemInput,
  PaginatedItemsResult,
  ReorderItemsInput,
  UpdateItemInput,
} from "../types/models";
import { applyLocalItemMutation } from "../utils/localItemMutations";

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

export const useItemsStore = defineStore("items", () => {
  const items = ref<Item[]>([]);
  const itemsTotal = ref(0);
  const itemsLoading = ref(false);
  const itemsFullyLoaded = ref(false);
  const itemsPage = ref(0);
  const itemsSearch = ref("");
  const itemsSort = ref<ItemSortSpec[]>([]);
  const activeCollectionId = ref<number | null>(null);
  let itemsRequestToken = 0;

  function syncDerivedItemState(): void {
    itemsFullyLoaded.value = items.value.length >= itemsTotal.value;
  }

  function setActiveCollectionId(collectionId: number | null): void {
    activeCollectionId.value = collectionId;
  }

  function clearItemsState(): void {
    itemsRequestToken += 1;
    items.value = [];
    itemsTotal.value = 0;
    itemsLoading.value = false;
    itemsFullyLoaded.value = false;
    itemsPage.value = 0;
    itemsSearch.value = "";
    itemsSort.value = [];
  }

  function appendItems(nextItems: Item[]): void {
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

  function applyMutation(
    mutation: Parameters<typeof applyLocalItemMutation>[1],
  ): void {
    const nextState = applyLocalItemMutation(
      {
        items: items.value,
        total: itemsTotal.value,
      },
      mutation,
    );
    items.value = nextState.items;
    itemsTotal.value = nextState.total;
    syncDerivedItemState();
  }

  async function loadItems(
    collectionId: number,
    options: LoadItemsOptions = {},
  ): Promise<void> {
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

    activeCollectionId.value = collectionId;
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

      const payload = await itemsRepository.getItems({
        collectionId,
        limit,
        offset,
        search: requestSearch,
        sort: requestSort,
      });

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

  async function addItem(input: NewItemInput): Promise<Item | null> {
    const created = await itemsRepository.addItem(input);
    if (created && activeCollectionId.value === input.collectionId) {
      await loadItems(input.collectionId);
    }
    return created;
  }

  async function insertItemAt(
    input: InsertItemAtInput,
  ): Promise<Item | null> {
    const payload: InsertItemAtInput = {
      collectionId: input.collectionId,
      afterOrder:
        input.afterOrder === null ? null : Number(input.afterOrder),
    };

    const created = await itemsRepository.insertItemAt(payload);
    if (created && activeCollectionId.value === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return created;
  }

  async function duplicateItem(
    input: DuplicateItemInput,
  ): Promise<Item | null> {
    const payload: DuplicateItemInput = {
      collectionId: input.collectionId,
      itemId: input.itemId,
    };

    const created = await itemsRepository.duplicateItem(payload);
    if (created && activeCollectionId.value === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return created;
  }

  async function moveItem(input: MoveItemInput): Promise<boolean> {
    const payload: MoveItemInput = {
      collectionId: input.collectionId,
      itemId: input.itemId,
      direction: input.direction,
    };

    const success = await itemsRepository.moveItem(payload);
    if (success && activeCollectionId.value === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return success;
  }

  async function updateItem(input: UpdateItemInput): Promise<boolean> {
    const success = await itemsRepository.updateItem(input);
    if (success) {
      applyMutation({
        type: "replace",
        itemId: input.id,
        data: { ...input.data },
      });
    }
    return success;
  }

  async function deleteItem(itemId: number): Promise<boolean> {
    const success = await itemsRepository.deleteItem(itemId);
    if (success) {
      applyMutation({
        type: "delete",
        itemId,
      });
    }
    return success;
  }

  async function reorderItems(input: ReorderItemsInput): Promise<boolean> {
    const payload: ReorderItemsInput = {
      collectionId: input.collectionId,
      itemOrders: input.itemOrders.map((entry) => ({
        id: entry.id,
        order: Math.max(0, Math.round(Number(entry.order))),
      })),
    };

    const success = await itemsRepository.reorderItems(payload);
    if (success && activeCollectionId.value === payload.collectionId) {
      await loadItems(payload.collectionId);
    }
    return success;
  }

  async function bulkDeleteItems(
    input: BulkDeleteItemsInput,
  ): Promise<BulkMutationResult | null> {
    const payload: BulkDeleteItemsInput = {
      collectionId: input.collectionId,
      itemIds: [...input.itemIds],
    };

    const mutationResult = await itemsRepository.bulkDeleteItems(payload);
    if (mutationResult && activeCollectionId.value === payload.collectionId) {
      applyMutation({
        type: "bulkDelete",
        itemIds: payload.itemIds,
        affectedCount: mutationResult.affectedCount,
      });
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

    const mutationResult = await itemsRepository.bulkPatchItems(payload);
    if (mutationResult && activeCollectionId.value === payload.collectionId) {
      applyMutation({
        type: "bulkPatch",
        updates: payload.updates,
      });
    }
    return mutationResult;
  }

  function replaceItemsSnapshot(payload: PaginatedItemsResult): void {
    items.value = payload.items;
    itemsTotal.value = payload.total;
    itemsPage.value =
      payload.limit > 0 ? Math.floor(payload.offset / payload.limit) : 0;
    itemsFullyLoaded.value = items.value.length >= payload.total;
  }

  return {
    items,
    itemsTotal,
    itemsLoading,
    itemsFullyLoaded,
    itemsPage,
    itemsSearch,
    itemsSort,
    activeCollectionId,
    setActiveCollectionId,
    clearItemsState,
    appendItems,
    replaceItemsSnapshot,
    loadItems,
    addItem,
    insertItemAt,
    duplicateItem,
    moveItem,
    updateItem,
    deleteItem,
    reorderItems,
    bulkDeleteItems,
    bulkPatchItems,
  };
});

