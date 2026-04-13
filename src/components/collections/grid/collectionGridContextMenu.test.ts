import { describe, expect, it } from "vitest";
import type { Item } from "../../../types/models";
import {
  buildGridContextMenuActions,
  type ContextMenuAction,
} from "./collectionGridContextMenu";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 42,
    collection_id: 7,
    order: 9,
    data: {},
    ...overrides,
  };
}

describe("buildGridContextMenuActions", () => {
  it("emits the active row when deleting from the context menu", () => {
    const row = makeItem();
    let deletedRow: Item | null = null;
    let closed = false;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 0,
      totalRows: 1,
      onInsertItemAt: () => undefined,
      onDuplicateItem: () => undefined,
      onMoveItem: () => undefined,
      onDeleteItem: (nextRow) => {
        deletedRow = nextRow;
      },
      closeContextMenu: () => {
        closed = true;
      },
    });

    const deleteAction = actions.find(
      (action): action is Extract<ContextMenuAction, { separator?: false }> =>
        !("separator" in action) && action.label === "Delete row",
    );
    expect(deleteAction).toBeDefined();
    deleteAction?.command();

    expect(deletedRow).toEqual(row);
    expect(closed).toBe(true);
  });
});
