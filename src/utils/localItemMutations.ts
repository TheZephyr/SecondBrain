import type { BulkPatchItemUpdate, Item, ItemData } from "../types/models";

export type LocalItemsState = {
  items: Item[];
  total: number;
};

export type LocalItemMutation =
  | {
      type: "replace";
      itemId: number;
      data: ItemData;
    }
  | {
      type: "patch";
      itemId: number;
      patch: ItemData;
    }
  | {
      type: "delete";
      itemId: number;
    }
  | {
      type: "bulkDelete";
      itemIds: number[];
      affectedCount?: number;
    }
  | {
      type: "bulkPatch";
      updates: BulkPatchItemUpdate[];
    };

function replaceItemData(items: Item[], itemId: number, data: ItemData): Item[] {
  return items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          data: { ...data },
        }
      : item,
  );
}

function patchItemData(items: Item[], itemId: number, patch: ItemData): Item[] {
  return items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          data: {
            ...item.data,
            ...patch,
          },
        }
      : item,
  );
}

export function applyLocalItemMutation(
  state: LocalItemsState,
  mutation: LocalItemMutation,
): LocalItemsState {
  switch (mutation.type) {
    case "replace":
      return {
        ...state,
        items: replaceItemData(state.items, mutation.itemId, mutation.data),
      };
    case "patch":
      return {
        ...state,
        items: patchItemData(state.items, mutation.itemId, mutation.patch),
      };
    case "delete": {
      const nextItems = state.items.filter((item) => item.id !== mutation.itemId);
      const totalDelta = nextItems.length === state.items.length ? 0 : 1;
      return {
        items: nextItems,
        total: Math.max(0, state.total - totalDelta),
      };
    }
    case "bulkDelete": {
      const itemIdSet = new Set(mutation.itemIds);
      const nextItems = state.items.filter((item) => !itemIdSet.has(item.id));
      const removedVisibleCount = state.items.length - nextItems.length;
      const totalDelta =
        typeof mutation.affectedCount === "number"
          ? mutation.affectedCount
          : removedVisibleCount;
      return {
        items: nextItems,
        total: Math.max(0, state.total - totalDelta),
      };
    }
    case "bulkPatch": {
      let nextItems = state.items;
      for (const update of mutation.updates) {
        nextItems = patchItemData(nextItems, update.id, update.patch);
      }
      return {
        ...state,
        items: nextItems,
      };
    }
  }
}

