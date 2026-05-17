// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { systemRepository } from '../systemRepository';
import { handleIpc } from '../../utils/ipc';

vi.mock('../../utils/ipc', () => ({
  handleIpc: vi.fn((result, _context, fallback) => {
    if (result.ok) return result.data;
    return fallback;
  })
}));

const mockElectronAPI = {
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  openExternal: vi.fn(),
};

(global as any).window = {
  electronAPI: mockElectronAPI,
};

describe('systemRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showSaveDialog', () => {
    it('returns file path on success', async () => {
      const options = { title: 'Save' };
      mockElectronAPI.showSaveDialog.mockResolvedValue({ ok: true, data: '/path/to/save' });
      const result = await systemRepository.showSaveDialog(options);
      expect(result).toBe('/path/to/save');
      expect(mockElectronAPI.showSaveDialog).toHaveBeenCalledWith(options);
    });

    it('returns null and calls handleIpc on failure (covers lines 16-17)', async () => {
      mockElectronAPI.showSaveDialog.mockResolvedValue({ ok: false, error: { message: 'cancelled' } });
      const result = await systemRepository.showSaveDialog({});
      expect(result).toBeNull();
      expect(handleIpc).toHaveBeenCalledWith(
        { ok: false, error: { message: 'cancelled' } },
        'export:showSaveDialog',
        null
      );
    });
  });

  describe('showOpenDialog', () => {
    it('returns file path on success', async () => {
      mockElectronAPI.showOpenDialog.mockResolvedValue({ ok: true, data: '/path/to/open' });
      const result = await systemRepository.showOpenDialog({});
      expect(result).toBe('/path/to/open');
    });

    it('returns null on failure', async () => {
      mockElectronAPI.showOpenDialog.mockResolvedValue({ ok: false, error: { message: 'fail' } });
      const result = await systemRepository.showOpenDialog({});
      expect(result).toBeNull();
    });
  });

  describe('writeFile', () => {
    it('returns true on success', async () => {
      mockElectronAPI.writeFile.mockResolvedValue({ ok: true, data: true });
      const result = await systemRepository.writeFile('path', 'content');
      expect(result).toBe(true);
      expect(mockElectronAPI.writeFile).toHaveBeenCalledWith('path', 'content');
    });

    it('returns false on failure', async () => {
      mockElectronAPI.writeFile.mockResolvedValue({ ok: false, error: { message: 'fail' } });
      const result = await systemRepository.writeFile('path', 'content');
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('returns content on success', async () => {
      mockElectronAPI.readFile.mockResolvedValue({ ok: true, data: 'file content' });
      const result = await systemRepository.readFile('path');
      expect(result).toBe('file content');
    });

    it('returns null on failure', async () => {
      mockElectronAPI.readFile.mockResolvedValue({ ok: false, error: { message: 'fail' } });
      const result = await systemRepository.readFile('path');
      expect(result).toBeNull();
    });
  });

  describe('openExternal', () => {
    it('returns true on success (covers lines 43-45)', async () => {
      mockElectronAPI.openExternal.mockResolvedValue({ ok: true, data: null });
      const result = await systemRepository.openExternal('https://example.com');
      expect(result).toBe(true);
      expect(mockElectronAPI.openExternal).toHaveBeenCalledWith('https://example.com');
    });

    it('returns false and calls handleIpc on failure (covers lines 47-48)', async () => {
      mockElectronAPI.openExternal.mockResolvedValue({ ok: false, error: { message: 'fail' } });
      const result = await systemRepository.openExternal('invalid-url');
      expect(result).toBe(false);
      expect(handleIpc).toHaveBeenCalledWith(
        { ok: false, error: { message: 'fail' } },
        'openExternal',
        null
      );
    });
  });
});
