// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settingsRepository } from '../settingsRepository';
import { handleIpc } from '../../utils/ipc';

vi.mock('../../utils/ipc', () => ({
  handleIpc: vi.fn((result, _context, fallback) => {
    if (result.ok) return result.data;
    return fallback;
  })
}));

const mockElectronAPI = {
  getBackupSettings: vi.fn(),
  updateBackupSettings: vi.fn(),
  listBackups: vi.fn(),
  createManualBackup: vi.fn(),
  restoreBackup: vi.fn(),
  deleteBackup: vi.fn(),
  openBackupsFolder: vi.fn(),
  exportFullArchive: vi.fn(),
  previewFullArchiveRestore: vi.fn(),
  restoreFullArchive: vi.fn(),
};

(global as any).window = {
  electronAPI: mockElectronAPI,
};

describe('settingsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBackupSettings', () => {
    it('returns data on success', async () => {
      const mockData = { backupDirectory: '/path', automaticBackupsEnabled: true, automaticBackupsLimit: 5, manualBackupsLimit: 10 };
      mockElectronAPI.getBackupSettings.mockResolvedValue({ ok: true, data: mockData });
      const result = await settingsRepository.getBackupSettings();
      expect(result).toEqual(mockData);
      expect(handleIpc).toHaveBeenCalledWith({ ok: true, data: mockData }, 'backup:getSettings', expect.any(Object));
    });

    it('returns default settings on failure', async () => {
      mockElectronAPI.getBackupSettings.mockResolvedValue({ ok: false, error: { message: 'fail' } });
      const result = await settingsRepository.getBackupSettings();
      expect(result.automaticBackupsLimit).toBe(10);
      expect(handleIpc).toHaveBeenCalled();
    });
  });

  describe('updateBackupSettings', () => {
    it('calls update and returns result', async () => {
      const input = { automaticBackupsEnabled: false, automaticBackupsLimit: 1, manualBackupsLimit: 2 };
      const mockData = { backupDirectory: '', ...input };
      mockElectronAPI.updateBackupSettings.mockResolvedValue({ ok: true, data: mockData });
      const result = await settingsRepository.updateBackupSettings(input);
      expect(result).toEqual(mockData);
      expect(mockElectronAPI.updateBackupSettings).toHaveBeenCalledWith(input);
    });
  });

  describe('listBackups', () => {
    it('returns list of backups', async () => {
      const mockData = [{ fileName: 'b1' }];
      mockElectronAPI.listBackups.mockResolvedValue({ ok: true, data: mockData });
      const result = await settingsRepository.listBackups();
      expect(result).toEqual(mockData);
    });
  });

  describe('createManualBackup', () => {
    it('returns backup entry on success (covers handleNullableResult success)', async () => {
      const mockData = { fileName: 'manual' };
      mockElectronAPI.createManualBackup.mockResolvedValue({ ok: true, data: mockData });
      const result = await settingsRepository.createManualBackup();
      expect(result).toEqual(mockData);
    });

    it('returns null on failure (covers handleNullableResult failure)', async () => {
      mockElectronAPI.createManualBackup.mockResolvedValue({ ok: false, error: { message: 'fail' } });
      const result = await settingsRepository.createManualBackup();
      expect(result).toBeNull();
      expect(handleIpc).toHaveBeenCalledWith(expect.anything(), 'backup:createManual', null);
    });
  });

  describe('restoreBackup', () => {
    it('returns boolean result', async () => {
      mockElectronAPI.restoreBackup.mockResolvedValue({ ok: true, data: true });
      const result = await settingsRepository.restoreBackup('file.db');
      expect(result).toBe(true);
      expect(mockElectronAPI.restoreBackup).toHaveBeenCalledWith('file.db');
    });
  });

  describe('deleteBackup', () => {
    it('returns boolean result', async () => {
      mockElectronAPI.deleteBackup.mockResolvedValue({ ok: true, data: true });
      const result = await settingsRepository.deleteBackup('file.db');
      expect(result).toBe(true);
      expect(mockElectronAPI.deleteBackup).toHaveBeenCalledWith('file.db');
    });
  });

  describe('openBackupsFolder', () => {
    it('returns boolean result', async () => {
      mockElectronAPI.openBackupsFolder.mockResolvedValue({ ok: true, data: true });
      const result = await settingsRepository.openBackupsFolder();
      expect(result).toBe(true);
    });
  });

  describe('exportFullArchive', () => {
    it('calls export and returns result', async () => {
      const input = { description: 'test' };
      const mockData = { filePath: 'arch.zip', stats: {} };
      mockElectronAPI.exportFullArchive.mockResolvedValue({ ok: true, data: mockData });
      const result = await settingsRepository.exportFullArchive(input);
      expect(result).toEqual(mockData);
      expect(mockElectronAPI.exportFullArchive).toHaveBeenCalledWith(input);
    });
  });

  describe('previewFullArchiveRestore', () => {
    it('returns preview data', async () => {
      const mockData = { filePath: 'preview.zip' };
      mockElectronAPI.previewFullArchiveRestore.mockResolvedValue({ ok: true, data: mockData });
      const result = await settingsRepository.previewFullArchiveRestore();
      expect(result).toEqual(mockData);
    });
  });

  describe('restoreFullArchive', () => {
    it('calls restore and returns report', async () => {
      const mockData = { restoredCollections: ['c1'] };
      mockElectronAPI.restoreFullArchive.mockResolvedValue({ ok: true, data: mockData });
      const result = await settingsRepository.restoreFullArchive('path/to/arch.zip');
      expect(result).toEqual(mockData);
      expect(mockElectronAPI.restoreFullArchive).toHaveBeenCalledWith('path/to/arch.zip');
    });
  });
});
