import type {
  Collection,
  Field,
  Item,
  NewCollectionInput,
  UpdateCollectionInput,
  NewFieldInput,
  UpdateFieldInput,
  NewItemInput,
  UpdateItemInput,
  ImportCollectionInput,
} from "./models";
import type { IpcResult } from "./ipc";

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface OpenDialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: string[];
}

export interface IElectronAPI {
  // Collections
  getCollections: () => Promise<IpcResult<Collection[]>>;
  addCollection: (
    collection: NewCollectionInput,
  ) => Promise<IpcResult<Collection | null>>;
  updateCollection: (
    collection: UpdateCollectionInput,
  ) => Promise<IpcResult<boolean>>;
  deleteCollection: (id: number) => Promise<IpcResult<boolean>>;

  // Fields
  getFields: (collectionId: number) => Promise<IpcResult<Field[]>>;
  addField: (
    field: NewFieldInput,
  ) => Promise<IpcResult<(NewFieldInput & { id: number }) | null>>;
  updateField: (field: UpdateFieldInput) => Promise<IpcResult<boolean>>;
  deleteField: (id: number) => Promise<IpcResult<boolean>>;

  // Items
  getItems: (collectionId: number) => Promise<IpcResult<Item[]>>;
  addItem: (item: NewItemInput) => Promise<IpcResult<Item | null>>;
  updateItem: (item: UpdateItemInput) => Promise<IpcResult<boolean>>;
  deleteItem: (id: number) => Promise<IpcResult<boolean>>;
  importCollection: (
    input: ImportCollectionInput,
  ) => Promise<IpcResult<boolean>>;

  // Export
  showSaveDialog: (
    options: SaveDialogOptions,
  ) => Promise<IpcResult<string | null>>;
  writeFile: (
    filePath: string,
    content: string,
  ) => Promise<IpcResult<boolean>>;

  // Import
  showOpenDialog: (
    options: OpenDialogOptions,
  ) => Promise<IpcResult<string | null>>;
  readFile: (filePath: string) => Promise<IpcResult<string | null>>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
