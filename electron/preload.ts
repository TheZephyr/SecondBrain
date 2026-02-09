import { contextBridge, ipcRenderer } from "electron";
import type { IElectronAPI } from "../src/types/electron";
import type { IpcResult } from "../src/types/ipc";

async function invoke<T>(
  channel: string,
  ...args: unknown[]
): Promise<IpcResult<T>> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "IPC invocation failed.";
    const details =
      error instanceof Error
        ? error.stack
        : typeof error === "string"
          ? error
          : undefined;
    return {
      ok: false,
      error: {
        code: "IPC_FAILED",
        message,
        details,
        context: channel,
      },
    };
  }
}

const electronAPI: IElectronAPI = {
  // Collections
  getCollections: () => invoke("db:getCollections"),
  addCollection: (collection) =>
    invoke("db:addCollection", collection),
  updateCollection: (collection) =>
    invoke("db:updateCollection", collection),
  deleteCollection: (id: number) =>
    invoke("db:deleteCollection", id),

  // Fields
  getFields: (collectionId: number) =>
    invoke("db:getFields", collectionId),
  addField: (field) => invoke("db:addField", field),
  updateField: (field) => invoke("db:updateField", field),
  deleteField: (id: number) => invoke("db:deleteField", id),

  // Items
  getItems: (collectionId: number) =>
    invoke("db:getItems", collectionId),
  addItem: (item) => invoke("db:addItem", item),
  updateItem: (item) => invoke("db:updateItem", item),
  deleteItem: (id: number) => invoke("db:deleteItem", id),

  // Export
  showSaveDialog: (options) => invoke("export:showSaveDialog", options),
  writeFile: (filePath: string, content: string) =>
    invoke("export:writeFile", filePath, content),

  // Import
  showOpenDialog: (options) => invoke("import:showOpenDialog", options),
  readFile: (filePath: string) =>
    invoke("import:readFile", filePath),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
