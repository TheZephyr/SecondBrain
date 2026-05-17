import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSettingsStore } from '../settings';
import { settingsRepository } from '../../repositories/settingsRepository';
import { useCollectionsStore } from '../collections';
import { useNavigationStore } from '../navigation';
import type { BackupEntry, FullArchiveRestoreReport } from '../../types/models';

vi.mock('../../repositories/settingsRepository', () => ({
  settingsRepository: {
    getBackupSettings: vi.fn(),
    listBackups: vi.fn(),
    updateBackupSettings: vi.fn(),
    createManualBackup: vi.fn(),
    openBackupsFolder: vi.fn(),
    restoreBackup: vi.fn(),
    deleteBackup: vi.fn(),
    exportFullArchive: vi.fn(),
    previewFullArchiveRestore: vi.fn(),
    restoreFullArchive: vi.fn(),
  }
}));

vi.mock('../collections', () => ({
  useCollectionsStore: vi.fn(() => ({
    loadCollections: vi.fn(),
    loadCollectionItemCounts: vi.fn()
  }))
}));

vi.mock('../navigation', () => ({
  useNavigationStore: vi.fn(() => ({
    setCurrentView: vi.fn()
  }))
}));

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes limits and handles backup settings updates', () => {
    const store = useSettingsStore();

    store.onAutomaticLimitChange(NaN);
    expect(store.automaticBackupsLimit).toBe(10);
    
    store.onAutomaticLimitChange(1500);
    expect(store.automaticBackupsLimit).toBe(999);
    
    store.onManualLimitChange(-5);
    expect(store.manualBackupsLimit).toBe(0);

    store.onAutomaticLimitChange(undefined);
    expect(store.automaticBackupsLimit).toBe(999);

    store.onAutomaticEnabledChange(undefined);
    expect(store.automaticBackupsEnabled).toBe(false);

    store.onAutomaticEnabledChange(true);
    expect(store.automaticBackupsEnabled).toBe(true);
  });

  it('loads and saves backup settings', async () => {
    const store = useSettingsStore();
    
    vi.mocked(settingsRepository.getBackupSettings).mockResolvedValue({
      backupDirectory: '/test/dir',
      automaticBackupsEnabled: false,
      automaticBackupsLimit: 15,
      manualBackupsLimit: 25
    });

    await store.loadBackupSettings();
    expect(store.backupDirectory).toBe('/test/dir');
    expect(store.automaticBackupsEnabled).toBe(false);
    expect(store.automaticBackupsLimit).toBe(15);
    expect(store.manualBackupsLimit).toBe(25);

    vi.mocked(settingsRepository.updateBackupSettings).mockResolvedValue({
      backupDirectory: '/test/dir',
      automaticBackupsEnabled: true,
      automaticBackupsLimit: 5,
      manualBackupsLimit: 5
    });

    store.automaticBackupsEnabled = true;
    store.automaticBackupsLimit = 5;
    store.manualBackupsLimit = 5;
    await store.saveBackupSettings();

    expect(settingsRepository.updateBackupSettings).toHaveBeenCalledWith({
      automaticBackupsEnabled: true,
      automaticBackupsLimit: 5,
      manualBackupsLimit: 5
    });
    expect(store.savingSettings).toBe(false);
  });

  it('manages backups', async () => {
    const store = useSettingsStore();
    const mockBackup: BackupEntry = { fileName: 'test.db', filePath: '/test/test.db', label: 'manual', createdAt: '2026-05-10T10:00:00Z', sizeBytes: 1000 };
    
    vi.mocked(settingsRepository.listBackups).mockResolvedValue([mockBackup]);
    await store.loadBackups();
    expect(store.backups).toEqual([mockBackup]);
    expect(store.loadingBackups).toBe(false);

    vi.mocked(settingsRepository.createManualBackup).mockResolvedValue(mockBackup as any);
    await store.createBackupNow();
    expect(settingsRepository.createManualBackup).toHaveBeenCalled();
    expect(settingsRepository.listBackups).toHaveBeenCalledTimes(2);

    vi.mocked(settingsRepository.createManualBackup).mockResolvedValue(null as any);
    await store.createBackupNow();
    expect(settingsRepository.listBackups).toHaveBeenCalledTimes(2);

    vi.mocked(settingsRepository.openBackupsFolder).mockResolvedValue(true);
    await expect(store.openBackupsFolder()).resolves.toBe(true);

    vi.mocked(settingsRepository.restoreBackup).mockResolvedValue(true as any);
    const restorePromise = store.restoreBackup('test.db');
    expect(store.restoringFileName).toBe('test.db');
    await restorePromise;
    expect(store.restoringFileName).toBe(null);

    vi.mocked(settingsRepository.deleteBackup).mockResolvedValue(true);
    await store.deleteBackup('test.db');
    expect(settingsRepository.deleteBackup).toHaveBeenCalledWith('test.db');
    expect(store.backups).toEqual([]);

    vi.mocked(settingsRepository.deleteBackup).mockResolvedValue(false);
    await store.deleteBackup('nonexistent.db');
  });

  it('manages archives', async () => {
    const store = useSettingsStore();
    
    vi.mocked(settingsRepository.exportFullArchive).mockResolvedValue({ filePath: '/test/archive.zip', stats: { collectionCount: 1, totalFieldCount: 2, totalItemCount: 5 } });
    store.archiveDescription = "test";
    await store.exportArchive();
    expect(settingsRepository.exportFullArchive).toHaveBeenCalledWith({ description: "test" });
    expect(store.lastArchiveExportPath).toBe('/test/archive.zip');

    vi.mocked(settingsRepository.exportFullArchive).mockResolvedValue(null);
    await store.exportArchive();

    const mockPreview: any = { filePath: '/preview.zip' };
    vi.mocked(settingsRepository.previewFullArchiveRestore).mockResolvedValue(mockPreview);
    await store.openArchivePreview();
    expect(store.archivePreviewVisible).toBe(true);
    expect(store.archivePreview?.filePath).toBe('/preview.zip');

    vi.mocked(settingsRepository.previewFullArchiveRestore).mockResolvedValue(null);
    await store.openArchivePreview();

    store.archivePreview = null;
    await store.restoreArchive();

    store.archivePreview = mockPreview;
    
    const mockReport: FullArchiveRestoreReport = {
      restoredCollections: ['test'],
      failedCollections: [],
      skippedEntities: [],
      droppedViewReferences: [],
      statMismatches: [],
      preRestoreBackupPath: '/backup.zip'
    };
    vi.mocked(settingsRepository.restoreFullArchive).mockResolvedValue(mockReport);
    
    const mockCollectionsStore = {
      loadCollections: vi.fn(),
      loadCollectionItemCounts: vi.fn()
    };
    vi.mocked(useCollectionsStore).mockReturnValue(mockCollectionsStore as any);

    await store.restoreArchive();
    
    expect(store.archivePreviewVisible).toBe(false);
    expect(store.archivePreview).toBeNull();
    expect(store.archiveReportVisible).toBe(true);
    expect(store.archiveReport).toStrictEqual(mockReport);
    expect(store.navigateToDashboardAfterArchiveReport).toBe(true);
    expect(mockCollectionsStore.loadCollections).toHaveBeenCalled();

    store.archivePreview = mockPreview;
    vi.mocked(settingsRepository.restoreFullArchive).mockResolvedValue(null);
    await store.restoreArchive();

    const mockNavigationStore = { setCurrentView: vi.fn() };
    vi.mocked(useNavigationStore).mockReturnValue(mockNavigationStore as any);

    store.handleArchiveReportHide();
    expect(mockNavigationStore.setCurrentView).toHaveBeenCalledWith('dashboard');
    expect(store.navigateToDashboardAfterArchiveReport).toBe(false);

    store.handleArchiveReportHide(); // Should early return
  });

  it('formats various display strings correctly', () => {
    const store = useSettingsStore();

    expect(store.formatBackupDate('invalid-date')).toBe('invalid-date');
    expect(typeof store.formatBackupDate('2026-05-10T10:00:00Z')).toBe('string');
    expect(store.formatBackupDate('2026-05-10T10:00:00Z')).not.toBe('2026-05-10T10:00:00Z');

    expect(store.formatLabel('startup')).toBe('Startup');
    expect(store.formatLabel('manual')).toBe('Manual');
    expect(store.formatLabel('pre_restore')).toBe('Pre-restore');

    expect(store.tagSeverity('startup')).toBe('info');
    expect(store.tagSeverity('manual')).toBe('success');
    expect(store.tagSeverity('pre_restore')).toBe('warn');

    expect(store.formatFileSize(500)).toBe('500 B');
    expect(store.formatFileSize(1536)).toBe('1.5 KB');
    expect(store.formatFileSize(1572864)).toBe('1.5 MB');
  });
});
