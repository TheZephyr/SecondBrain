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
  getCollections: () => Promise<any[]>;
  addCollection: (collection: any) => Promise<any>;
  updateCollection: (collection: any) => Promise<boolean>;
  deleteCollection: (id: number) => Promise<boolean>;

  // Fields
  getFields: (collectionId: number) => Promise<any[]>;
  addField: (field: any) => Promise<any>;
  updateField: (field: any) => Promise<boolean>;
  deleteField: (id: number) => Promise<boolean>;

  // Items
  getItems: (collectionId: number) => Promise<any[]>;
  addItem: (item: any) => Promise<any>;
  updateItem: (item: any) => Promise<boolean>;
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
