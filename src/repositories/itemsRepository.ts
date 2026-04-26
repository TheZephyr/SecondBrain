import type {
  BulkDeleteItemsInput,
  BulkMutationResult,
  BulkPatchItemsInput,
  DuplicateItemInput,
  GetItemsInput,
  GetNumberFieldRangeInput,
  ImportCollectionInput,
  InsertItemAtInput,
  Item,
  MoveItemInput,
  NewItemInput,
  PaginatedItemsResult,
  NumberFieldRange,
  ReorderItemsInput,
  UpdateItemInput,
} from "../types/models";
import { handleIpc } from "../utils/ipc";

const EXPORT_PAGE_SIZE = 200;

export const itemsRepository = {
  async getItems(input: GetItemsInput): Promise<PaginatedItemsResult> {
    const result = await window.electronAPI.getItems(input);
    return handleIpc(result, "db:getItems", {
      items: [],
      total: 0,
      limit: input.limit,
      offset: input.offset,
    });
  },

  async getAllItems(collectionId: number): Promise<Item[]> {
    const allItems: Item[] = [];
    let offset = 0;
    let total = 0;

    do {
      const payload = await this.getItems({
        collectionId,
        limit: EXPORT_PAGE_SIZE,
        offset,
        search: "",
        sort: [],
      });

      allItems.push(...payload.items);
      total = payload.total;
      offset += payload.items.length;

      if (payload.items.length === 0) {
        break;
      }
    } while (offset < total);

    return allItems;
  },

  async addItem(input: NewItemInput): Promise<Item | null> {
    const result = await window.electronAPI.addItem(input);
    return handleIpc(result, "db:addItem", null);
  },

  async insertItemAt(input: InsertItemAtInput): Promise<Item | null> {
    const result = await window.electronAPI.insertItemAt(input);
    return handleIpc(result, "db:insertItemAt", null);
  },

  async duplicateItem(input: DuplicateItemInput): Promise<Item | null> {
    const result = await window.electronAPI.duplicateItem(input);
    return handleIpc(result, "db:duplicateItem", null);
  },

  async moveItem(input: MoveItemInput): Promise<boolean> {
    const result = await window.electronAPI.moveItem(input);
    return handleIpc(result, "db:moveItem", false);
  },

  async updateItem(input: UpdateItemInput): Promise<boolean> {
    const result = await window.electronAPI.updateItem(input);
    return handleIpc(result, "db:updateItem", false);
  },

  async deleteItem(id: number): Promise<boolean> {
    const result = await window.electronAPI.deleteItem(id);
    return handleIpc(result, "db:deleteItem", false);
  },

  async reorderItems(input: ReorderItemsInput): Promise<boolean> {
    const result = await window.electronAPI.reorderItems(input);
    return handleIpc(result, "db:reorderItems", false);
  },

  async bulkDeleteItems(
    input: BulkDeleteItemsInput,
  ): Promise<BulkMutationResult | null> {
    const result = await window.electronAPI.bulkDeleteItems(input);
    const mutationResult = handleIpc(result, "db:bulkDeleteItems", {
      affectedCount: 0,
    } satisfies BulkMutationResult);
    return result.ok ? mutationResult : null;
  },

  async bulkPatchItems(
    input: BulkPatchItemsInput,
  ): Promise<BulkMutationResult | null> {
    const result = await window.electronAPI.bulkPatchItems(input);
    const mutationResult = handleIpc(result, "db:bulkPatchItems", {
      affectedCount: 0,
    } satisfies BulkMutationResult);
    return result.ok ? mutationResult : null;
  },

  async importCollection(input: ImportCollectionInput): Promise<boolean> {
    const result = await window.electronAPI.importCollection(input);
    return handleIpc(result, "db:importCollection", false);
  },

  async getNumberFieldRange(
    input: GetNumberFieldRangeInput,
  ): Promise<NumberFieldRange> {
    const result = await window.electronAPI.getNumberFieldRange(input);
    return handleIpc(result, "db:getNumberFieldRange", {
      min: null,
      max: null,
      count: 0,
    } satisfies NumberFieldRange);
  },
};
