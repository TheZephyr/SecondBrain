import type {
  ImportCollectionInput,
  NewCollectionInput,
  NewFieldInput,
  NewItemInput,
  UpdateCollectionInput,
  UpdateFieldInput,
  UpdateItemInput,
} from "../src/types/models";

export type DbWorkerOperation =
  | { type: "init"; dbPath: string }
  | { type: "getCollections" }
  | { type: "getCollectionItemCounts" }
  | { type: "addCollection"; input: NewCollectionInput }
  | { type: "updateCollection"; input: UpdateCollectionInput }
  | { type: "deleteCollection"; id: number }
  | { type: "getFields"; collectionId: number }
  | { type: "addField"; input: NewFieldInput }
  | { type: "updateField"; input: UpdateFieldInput }
  | { type: "deleteField"; id: number }
  | { type: "getItems"; collectionId: number }
  | { type: "addItem"; input: NewItemInput }
  | { type: "updateItem"; input: UpdateItemInput }
  | { type: "deleteItem"; id: number }
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
