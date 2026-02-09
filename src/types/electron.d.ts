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
} from "./models";

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
  getCollections: () => Promise<Collection[]>;
  addCollection: (collection: NewCollectionInput) => Promise<Collection | null>;
  updateCollection: (collection: UpdateCollectionInput) => Promise<boolean>;
  deleteCollection: (id: number) => Promise<boolean>;

  // Fields
  getFields: (collectionId: number) => Promise<Field[]>;
  addField: (field: NewFieldInput) => Promise<(NewFieldInput & { id: number }) | null>;
  updateField: (field: UpdateFieldInput) => Promise<boolean>;
  deleteField: (id: number) => Promise<boolean>;

  // Items
  getItems: (collectionId: number) => Promise<Item[]>;
  addItem: (item: NewItemInput) => Promise<Item | null>;
  updateItem: (item: UpdateItemInput) => Promise<boolean>;
  deleteItem: (id: number) => Promise<boolean>;

  // Export
  showSaveDialog: (options: SaveDialogOptions) => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;

  // Import
  showOpenDialog: (options: OpenDialogOptions) => Promise<string | null>;
  readFile: (filePath: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
