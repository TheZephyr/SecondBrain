import type {
  OpenDialogOptions,
  SaveDialogOptions,
} from "../types/electron";
import type { IpcResult } from "../types/ipc";
import { handleIpc } from "../utils/ipc";

function handleNullableResult<T>(
  result: IpcResult<T>,
  context: string,
): T | null {
  if (result.ok) {
    return result.data;
  }

  handleIpc(result as IpcResult<T | null>, context, null);
  return null;
}

export const systemRepository = {
  async showSaveDialog(options: SaveDialogOptions): Promise<string | null> {
    const result = await window.electronAPI.showSaveDialog(options);
    return handleNullableResult(result, "export:showSaveDialog");
  },

  async showOpenDialog(options: OpenDialogOptions): Promise<string | null> {
    const result = await window.electronAPI.showOpenDialog(options);
    return handleNullableResult(result, "import:showOpenDialog");
  },

  async writeFile(filePath: string, content: string): Promise<boolean> {
    const result = await window.electronAPI.writeFile(filePath, content);
    return handleIpc(result, "export:writeFile", false);
  },

  async readFile(filePath: string): Promise<string | null> {
    const result = await window.electronAPI.readFile(filePath);
    return handleNullableResult(result, "import:readFile");
  },

  async openExternal(url: string): Promise<boolean> {
    const result = await window.electronAPI.openExternal(url);
    if (result.ok) {
      return true;
    }

    handleIpc(result as IpcResult<null>, "openExternal", null);
    return false;
  },
};
