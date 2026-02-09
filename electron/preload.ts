import { contextBridge, ipcRenderer } from "electron";
import type { IElectronAPI } from "../src/types/electron";

const electronAPI: IElectronAPI = {
  // Collections
  getCollections: () => ipcRenderer.invoke("db:getCollections"),
  addCollection: (collection) =>
    ipcRenderer.invoke("db:addCollection", collection),
  updateCollection: (collection) =>
    ipcRenderer.invoke("db:updateCollection", collection),
  deleteCollection: (id: number) =>
    ipcRenderer.invoke("db:deleteCollection", id),

  // Fields
  getFields: (collectionId: number) =>
    ipcRenderer.invoke("db:getFields", collectionId),
  addField: (field) => ipcRenderer.invoke("db:addField", field),
  updateField: (field) => ipcRenderer.invoke("db:updateField", field),
  deleteField: (id: number) => ipcRenderer.invoke("db:deleteField", id),

  // Items
  getItems: (collectionId: number) =>
    ipcRenderer.invoke("db:getItems", collectionId),
  addItem: (item) => ipcRenderer.invoke("db:addItem", item),
  updateItem: (item) => ipcRenderer.invoke("db:updateItem", item),
  deleteItem: (id: number) => ipcRenderer.invoke("db:deleteItem", id),

  // Export
  showSaveDialog: (options) =>
    ipcRenderer.invoke("export:showSaveDialog", options),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("export:writeFile", filePath, content),

  // Import
  showOpenDialog: (options) =>
    ipcRenderer.invoke("import:showOpenDialog", options),
  readFile: (filePath: string) =>
    ipcRenderer.invoke("import:readFile", filePath),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
