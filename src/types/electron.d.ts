export interface IElectronAPI {
  // Collections
  getCollections: () => Promise<any[]>
  addCollection: (collection: any) => Promise<any>
  updateCollection: (collection: any) => Promise<boolean>
  deleteCollection: (id: number) => Promise<boolean>

  // Fields
  getFields: (collectionId: number) => Promise<any[]>
  addField: (field: any) => Promise<any>
  updateField: (field: any) => Promise<boolean>
  deleteField: (id: number) => Promise<boolean>

  // Items
  getItems: (collectionId: number) => Promise<any[]>
  addItem: (item: any) => Promise<any>
  updateItem: (item: any) => Promise<boolean>
  deleteItem: (id: number) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
