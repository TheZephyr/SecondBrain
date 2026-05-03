import type {
  DuplicateItemInput,
  InsertItemAtInput,
  Item,
  MoveItemInput,
} from "../../../types/models";

export type ContextMenuAction =
  | { separator: true }
  | {
      label: string;
      disabled?: boolean;
      command: () => void;
      separator?: false;
    };

export interface BuildGridContextMenuActionsInput {
  row: Item | null;
  rowIndex: number | null;
  totalRows: number;
  onInsertItemAt: (payload: InsertItemAtInput) => void;
  onDuplicateItem: (payload: DuplicateItemInput) => void;
  onMoveItem: (payload: MoveItemInput) => void;
  onDeleteItem: (row: Item) => void;
  closeContextMenu: () => void;
}

export function buildGridContextMenuActions(
  input: BuildGridContextMenuActionsInput,
): ContextMenuAction[] {
  const { row, rowIndex, totalRows } = input;
  const isFirstOnPage = rowIndex === 0;
  const isLastOnPage = rowIndex !== null && rowIndex === totalRows - 1;
  const collectionId = row?.collection_id;

  return [
    {
      label: "Insert row above",
      command: () => {
        if (!row || collectionId === undefined) return;
        const afterOrder = row.order <= 0 ? null : row.order - 1;
        input.onInsertItemAt({ collectionId, afterOrder });
        input.closeContextMenu();
      },
    },
    {
      label: "Insert row below",
      command: () => {
        if (!row || collectionId === undefined) return;
        input.onInsertItemAt({ collectionId, afterOrder: row.order });
        input.closeContextMenu();
      },
    },
    {
      label: "Duplicate row",
      command: () => {
        if (!row || collectionId === undefined) return;
        input.onDuplicateItem({ collectionId, itemId: row.id });
        input.closeContextMenu();
      },
    },
    { separator: true },
    {
      label: "Move up",
      disabled: !row || isFirstOnPage,
      command: () => {
        if (!row || collectionId === undefined || isFirstOnPage) return;
        input.onMoveItem({ collectionId, itemId: row.id, direction: "up" });
        input.closeContextMenu();
      },
    },
    {
      label: "Move down",
      disabled: !row || isLastOnPage,
      command: () => {
        if (!row || collectionId === undefined || isLastOnPage) return;
        input.onMoveItem({ collectionId, itemId: row.id, direction: "down" });
        input.closeContextMenu();
      },
    },
    { separator: true },
    {
      label: "Delete row",
      command: () => {
        if (!row) return;
        input.onDeleteItem(row);
        input.closeContextMenu();
      },
    },
  ];
}
