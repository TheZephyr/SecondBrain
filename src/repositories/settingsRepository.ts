import type {
  BackupEntry,
  BackupSettings,
  FullArchiveExportInput,
  FullArchiveExportResult,
  FullArchivePreview,
  FullArchiveRestoreReport,
  UpdateBackupSettingsInput,
} from "../types/models";
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

export const settingsRepository = {
  async getBackupSettings(): Promise<BackupSettings> {
    const result = await window.electronAPI.getBackupSettings();
    return handleIpc(result, "backup:getSettings", {
      backupDirectory: "",
      automaticBackupsEnabled: true,
      automaticBackupsLimit: 10,
      manualBackupsLimit: 20,
    });
  },

  async updateBackupSettings(
    input: UpdateBackupSettingsInput,
  ): Promise<BackupSettings> {
    const result = await window.electronAPI.updateBackupSettings(input);
    return handleIpc(result, "backup:updateSettings", {
      backupDirectory: "",
      automaticBackupsEnabled: input.automaticBackupsEnabled,
      automaticBackupsLimit: input.automaticBackupsLimit,
      manualBackupsLimit: input.manualBackupsLimit,
    });
  },

  async listBackups(): Promise<BackupEntry[]> {
    const result = await window.electronAPI.listBackups();
    return handleIpc(result, "backup:list", []);
  },

  async createManualBackup(): Promise<BackupEntry | null> {
    const result = await window.electronAPI.createManualBackup();
    return handleNullableResult(result, "backup:createManual");
  },

  async restoreBackup(fileName: string): Promise<boolean> {
    const result = await window.electronAPI.restoreBackup(fileName);
    return handleIpc(result, "backup:restore", false);
  },

  async deleteBackup(fileName: string): Promise<boolean> {
    const result = await window.electronAPI.deleteBackup(fileName);
    return handleIpc(result, "backup:delete", false);
  },

  async openBackupsFolder(): Promise<boolean> {
    const result = await window.electronAPI.openBackupsFolder();
    return handleIpc(result, "backup:openFolder", false);
  },

  async exportFullArchive(
    input: FullArchiveExportInput,
  ): Promise<FullArchiveExportResult | null> {
    const result = await window.electronAPI.exportFullArchive(input);
    return handleNullableResult(result, "archive:exportFull");
  },

  async previewFullArchiveRestore(): Promise<FullArchivePreview | null> {
    const result = await window.electronAPI.previewFullArchiveRestore();
    return handleNullableResult(result, "archive:previewRestore");
  },

  async restoreFullArchive(
    filePath: string,
  ): Promise<FullArchiveRestoreReport | null> {
    const result = await window.electronAPI.restoreFullArchive(filePath);
    return handleNullableResult(result, "archive:restore");
  },
};

