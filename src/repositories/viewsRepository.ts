import type {
  NewViewInput,
  ReorderViewsInput,
  UpdateViewConfigInput,
  UpdateViewInput,
  View,
  ViewConfig,
} from "../types/models";
import { handleIpc } from "../utils/ipc";

export const viewsRepository = {
  async getViews(collectionId: number): Promise<View[]> {
    const result = await window.electronAPI.getViews(collectionId);
    return handleIpc(result, "db:getViews", []);
  },

  async addView(input: NewViewInput): Promise<View | null> {
    const result = await window.electronAPI.addView(input);
    return handleIpc(result, "db:addView", null);
  },

  async updateView(input: UpdateViewInput): Promise<boolean> {
    const result = await window.electronAPI.updateView(input);
    return handleIpc(result, "db:updateView", false);
  },

  async deleteView(id: number): Promise<boolean> {
    const result = await window.electronAPI.deleteView(id);
    return handleIpc(result, "db:deleteView", false);
  },

  async reorderViews(input: ReorderViewsInput): Promise<boolean> {
    const result = await window.electronAPI.reorderViews(input);
    return handleIpc(result, "db:reorderViews", false);
  },

  async getViewConfig(viewId: number): Promise<ViewConfig | null> {
    const result = await window.electronAPI.getViewConfig(viewId);
    return handleIpc(result, "db:getViewConfig", null);
  },

  async updateViewConfig(input: UpdateViewConfigInput): Promise<boolean> {
    const result = await window.electronAPI.updateViewConfig(input);
    return handleIpc(result, "db:updateViewConfig", false);
  },
};

