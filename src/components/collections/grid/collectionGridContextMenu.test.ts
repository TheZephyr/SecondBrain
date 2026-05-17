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

  it("emits onInsertItemAt for 'Insert row above' correctly", () => {
    const row = makeItem({ order: 5 });
    let payload: any = null;
    let closed = false;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 1,
      totalRows: 3,
      onInsertItemAt: (p) => { payload = p; },
      onDuplicateItem: () => {},
      onMoveItem: () => {},
      onDeleteItem: () => {},
      closeContextMenu: () => { closed = true; },
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Insert row above") as any;
    action.command();
    expect(payload).toEqual({ collectionId: 7, afterOrder: 4 });
    expect(closed).toBe(true);
  });

  it("handles 'Insert row above' when order is <= 0", () => {
    const row = makeItem({ order: 0 });
    let payload: any = null;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 0,
      totalRows: 1,
      onInsertItemAt: (p) => { payload = p; },
      onDuplicateItem: () => {},
      onMoveItem: () => {},
      onDeleteItem: () => {},
      closeContextMenu: () => {},
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Insert row above") as any;
    action.command();
    expect(payload).toEqual({ collectionId: 7, afterOrder: null });
  });

  it("emits onInsertItemAt for 'Insert row below' correctly", () => {
    const row = makeItem({ order: 5 });
    let payload: any = null;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 1,
      totalRows: 3,
      onInsertItemAt: (p) => { payload = p; },
      onDuplicateItem: () => {},
      onMoveItem: () => {},
      onDeleteItem: () => {},
      closeContextMenu: () => {},
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Insert row below") as any;
    action.command();
    expect(payload).toEqual({ collectionId: 7, afterOrder: 5 });
  });

  it("emits onDuplicateItem for 'Duplicate row'", () => {
    const row = makeItem({ id: 42, collection_id: 7 });
    let payload: any = null;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 1,
      totalRows: 3,
      onInsertItemAt: () => {},
      onDuplicateItem: (p) => { payload = p; },
      onMoveItem: () => {},
      onDeleteItem: () => {},
      closeContextMenu: () => {},
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Duplicate row") as any;
    action.command();
    expect(payload).toEqual({ collectionId: 7, itemId: 42 });
  });

  it("handles 'Move up'", () => {
    const row = makeItem({ id: 42, collection_id: 7 });
    let payload: any = null;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 1,
      totalRows: 3,
      onInsertItemAt: () => {},
      onDuplicateItem: () => {},
      onMoveItem: (p) => { payload = p; },
      onDeleteItem: () => {},
      closeContextMenu: () => {},
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Move up") as any;
    expect(action.disabled).toBe(false);
    action.command();
    expect(payload).toEqual({ collectionId: 7, itemId: 42, direction: "up" });
  });

  it("disables and ignores 'Move up' if first on page", () => {
    const row = makeItem({ id: 42, collection_id: 7 });
    let called = false;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 0, // first on page
      totalRows: 3,
      onInsertItemAt: () => {},
      onDuplicateItem: () => {},
      onMoveItem: () => { called = true; },
      onDeleteItem: () => {},
      closeContextMenu: () => {},
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Move up") as any;
    expect(action.disabled).toBe(true);
    action.command();
    expect(called).toBe(false);
  });

  it("handles 'Move down'", () => {
    const row = makeItem({ id: 42, collection_id: 7 });
    let payload: any = null;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 1,
      totalRows: 3,
      onInsertItemAt: () => {},
      onDuplicateItem: () => {},
      onMoveItem: (p) => { payload = p; },
      onDeleteItem: () => {},
      closeContextMenu: () => {},
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Move down") as any;
    expect(action.disabled).toBe(false);
    action.command();
    expect(payload).toEqual({ collectionId: 7, itemId: 42, direction: "down" });
  });

  it("disables and ignores 'Move down' if last on page", () => {
    const row = makeItem({ id: 42, collection_id: 7 });
    let called = false;

    const actions = buildGridContextMenuActions({
      row,
      rowIndex: 2, // last on page
      totalRows: 3,
      onInsertItemAt: () => {},
      onDuplicateItem: () => {},
      onMoveItem: () => { called = true; },
      onDeleteItem: () => {},
      closeContextMenu: () => {},
    });

    const action = actions.find((a) => !("separator" in a) && a.label === "Move down") as any;
    expect(action.disabled).toBe(true);
    action.command();
    expect(called).toBe(false);
  });

  it("handles null row and returns early", () => {
    let called = false;

    const actions = buildGridContextMenuActions({
      row: null,
      rowIndex: null,
      totalRows: 0,
      onInsertItemAt: () => { called = true; },
      onDuplicateItem: () => { called = true; },
      onMoveItem: () => { called = true; },
      onDeleteItem: () => { called = true; },
      closeContextMenu: () => {},
    });

    const actionNames = ["Insert row above", "Insert row below", "Duplicate row", "Move up", "Move down"];
    for (const name of actionNames) {
      const action = actions.find((a) => !("separator" in a) && a.label === name) as any;
      action.command();
    }
    
    expect(called).toBe(false);
  });
});
