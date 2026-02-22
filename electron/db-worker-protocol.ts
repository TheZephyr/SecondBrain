import type {
  ImportCollectionInput,
  GetItemsInput,
  NewCollectionInput,
  NewViewInput,
  UpdateViewInput,
  NewFieldInput,
  NewItemInput,
  UpdateCollectionInput,
  UpdateFieldInput,
  UpdateItemInput,
  InsertItemAtInput,
  DuplicateItemInput,
  MoveItemInput,
  ReorderFieldsInput,
  BulkDeleteItemsInput,
  BulkPatchItemsInput,
} from "../src/types/models";

export type DbWorkerOperation =
  | { type: "init"; dbPath: string }
  | { type: "getCollections" }
  | { type: "getCollectionItemCounts" }
  | { type: "addCollection"; input: NewCollectionInput }
  | { type: "updateCollection"; input: UpdateCollectionInput }
  | { type: "deleteCollection"; id: number }
  | { type: "getViews"; collectionId: number }
  | { type: "addView"; input: NewViewInput }
  | { type: "updateView"; input: UpdateViewInput }
  | { type: "deleteView"; id: number }
  | { type: "getFields"; collectionId: number }
  | { type: "addField"; input: NewFieldInput }
  | { type: "updateField"; input: UpdateFieldInput }
  | { type: "reorderFields"; input: ReorderFieldsInput }
  | { type: "deleteField"; id: number }
  | { type: "getItems"; input: GetItemsInput }
  | { type: "addItem"; input: NewItemInput }
  | { type: "insertItemAt"; input: InsertItemAtInput }
  | { type: "duplicateItem"; input: DuplicateItemInput }
  | { type: "moveItem"; input: MoveItemInput }
  | { type: "updateItem"; input: UpdateItemInput }
  | { type: "deleteItem"; id: number }
  | { type: "bulkDeleteItems"; input: BulkDeleteItemsInput }
  | { type: "bulkPatchItems"; input: BulkPatchItemsInput }
  | { type: "importCollection"; input: ImportCollectionInput };

export type DbWorkerRequest = {
  id: number;
  operation: DbWorkerOperation;
};

export type DbWorkerError = {
  message: string;
  details?: string;
};

export type DbWorkerResponse =
  | {
      id: number;
      ok: true;
      data: unknown;
    }
  | {
      id: number;
      ok: false;
      error: DbWorkerError;
    };
