import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Collections
  getCollections: () => ipcRenderer.invoke("db:getCollections"),
  addCollection: (collection: any) =>
    ipcRenderer.invoke("db:addCollection", collection),
  updateCollection: (collection: any) =>
    ipcRenderer.invoke("db:updateCollection", collection),
  deleteCollection: (id: number) =>
    ipcRenderer.invoke("db:deleteCollection", id),

  // Fields
  getFields: (collectionId: number) =>
    ipcRenderer.invoke("db:getFields", collectionId),
  addField: (field: any) => ipcRenderer.invoke("db:addField", field),
  updateField: (field: any) => ipcRenderer.invoke("db:updateField", field),
  deleteField: (id: number) => ipcRenderer.invoke("db:deleteField", id),

  // Items
  getItems: (collectionId: number) =>
    ipcRenderer.invoke("db:getItems", collectionId),
  addItem: (item: any) => ipcRenderer.invoke("db:addItem", item),
  updateItem: (item: any) => ipcRenderer.invoke("db:updateItem", item),
  deleteItem: (id: number) => ipcRenderer.invoke("db:deleteItem", id),

  // Export
  showSaveDialog: (options: any) =>
    ipcRenderer.invoke("export:showSaveDialog", options),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("export:writeFile", filePath, content),

  // Import
  showOpenDialog: (options: any) =>
    ipcRenderer.invoke("import:showOpenDialog", options),
  readFile: (filePath: string) =>
    ipcRenderer.invoke("import:readFile", filePath),
});
