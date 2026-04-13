import { defineStore } from "pinia";
import { ref } from "vue";
import { settingsRepository } from "../repositories/settingsRepository";
import type {
  BackupEntry,
  BackupLabel,
  FullArchiveRestoreReport,
} from "../types/models";
import { useCollectionsStore } from "./collections";
import { useNavigationStore } from "./navigation";

export const useSettingsStore = defineStore("settings", () => {
  const backupDirectory = ref("");
  const automaticBackupsEnabled = ref(true);
  const automaticBackupsLimit = ref(10);
  const manualBackupsLimit = ref(20);
  const backups = ref<BackupEntry[]>([]);
  const loadingBackups = ref(false);
  const creatingBackup = ref(false);
  const savingSettings = ref(false);
  const restoringFileName = ref<string | null>(null);
  const deletingFileName = ref<string | null>(null);

  const archiveDescription = ref("");
  const exportingArchive = ref(false);
  const previewingArchive = ref(false);
  const restoringArchive = ref(false);
  const archivePreview = ref<Awaited<
    ReturnType<typeof settingsRepository.previewFullArchiveRestore>
  > | null>(null);
  const archivePreviewVisible = ref(false);
  const archiveReport = ref<FullArchiveRestoreReport | null>(null);
  const archiveReportVisible = ref(false);
  const navigateToDashboardAfterArchiveReport = ref(false);
  const lastArchiveExportPath = ref<string | null>(null);

  function normalizeLimit(
    value: number | null | undefined,
    fallback: number,
  ): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return fallback;
    }
    return Math.max(0, Math.min(999, Math.trunc(value)));
  }

  function applyBackupSettings(settings: {
    backupDirectory: string;
    automaticBackupsEnabled: boolean;
    automaticBackupsLimit: number;
    manualBackupsLimit: number;
  }): void {
    backupDirectory.value = settings.backupDirectory;
    automaticBackupsEnabled.value = settings.automaticBackupsEnabled;
    automaticBackupsLimit.value = settings.automaticBackupsLimit;
    manualBackupsLimit.value = settings.manualBackupsLimit;
  }

  function onAutomaticEnabledChange(value: boolean | undefined): void {
    automaticBackupsEnabled.value = Boolean(value);
  }

  function onAutomaticLimitChange(value: number | null | undefined): void {
    automaticBackupsLimit.value = normalizeLimit(
      value,
      automaticBackupsLimit.value,
    );
  }

  function onManualLimitChange(value: number | null | undefined): void {
    manualBackupsLimit.value = normalizeLimit(
      value,
      manualBackupsLimit.value,
    );
  }

  async function loadBackupSettings(): Promise<void> {
    applyBackupSettings(await settingsRepository.getBackupSettings());
  }

  async function loadBackups(): Promise<void> {
    loadingBackups.value = true;
    try {
      backups.value = await settingsRepository.listBackups();
    } finally {
      loadingBackups.value = false;
    }
  }

  async function saveBackupSettings(): Promise<void> {
    savingSettings.value = true;
    try {
      applyBackupSettings(
        await settingsRepository.updateBackupSettings({
          automaticBackupsEnabled: automaticBackupsEnabled.value,
          automaticBackupsLimit: normalizeLimit(automaticBackupsLimit.value, 10),
          manualBackupsLimit: normalizeLimit(manualBackupsLimit.value, 20),
        }),
      );
    } finally {
      savingSettings.value = false;
    }
  }

  async function createBackupNow(): Promise<void> {
    creatingBackup.value = true;
    try {
      const created = await settingsRepository.createManualBackup();
      if (created) {
        await loadBackups();
      }
    } finally {
      creatingBackup.value = false;
    }
  }

  async function openBackupsFolder(): Promise<boolean> {
    return settingsRepository.openBackupsFolder();
  }

  async function restoreBackup(fileName: string): Promise<void> {
    restoringFileName.value = fileName;
    try {
      await settingsRepository.restoreBackup(fileName);
    } finally {
      restoringFileName.value = null;
    }
  }

  async function deleteBackup(fileName: string): Promise<void> {
    deletingFileName.value = fileName;
    try {
      const deleted = await settingsRepository.deleteBackup(fileName);
      if (deleted) {
        backups.value = backups.value.filter(
          (backup) => backup.fileName !== fileName,
        );
      }
    } finally {
      deletingFileName.value = null;
    }
  }

  async function exportArchive(): Promise<void> {
    exportingArchive.value = true;
    try {
      const exported = await settingsRepository.exportFullArchive({
        description: archiveDescription.value,
      });
      if (exported) {
        lastArchiveExportPath.value = exported.filePath;
      }
    } finally {
      exportingArchive.value = false;
    }
  }

  async function openArchivePreview(): Promise<void> {
    previewingArchive.value = true;
    try {
      const preview = await settingsRepository.previewFullArchiveRestore();
      if (preview) {
        archivePreview.value = preview;
        archivePreviewVisible.value = true;
      }
    } finally {
      previewingArchive.value = false;
    }
  }

  async function restoreArchive(): Promise<void> {
    if (!archivePreview.value) {
      return;
    }

    restoringArchive.value = true;
    try {
      const report = await settingsRepository.restoreFullArchive(
        archivePreview.value.filePath,
      );
      if (!report) {
        return;
      }

      archivePreviewVisible.value = false;
      archivePreview.value = null;
      archiveReport.value = report;
      archiveReportVisible.value = true;
      navigateToDashboardAfterArchiveReport.value = true;

      const collectionsStore = useCollectionsStore();
      await collectionsStore.loadCollections();
      await collectionsStore.loadCollectionItemCounts();
    } finally {
      restoringArchive.value = false;
    }
  }

  function handleArchiveReportHide(): void {
    if (!navigateToDashboardAfterArchiveReport.value) {
      return;
    }

    navigateToDashboardAfterArchiveReport.value = false;
    const navigationStore = useNavigationStore();
    navigationStore.setCurrentView("dashboard");
  }

  function formatBackupDate(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      return createdAt;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(date);
  }

  function formatLabel(label: BackupLabel): string {
    switch (label) {
      case "startup":
        return "Startup";
      case "manual":
        return "Manual";
      case "pre_restore":
        return "Pre-restore";
    }
  }

  function tagSeverity(label: BackupLabel): "success" | "info" | "warn" {
    switch (label) {
      case "startup":
        return "info";
      case "manual":
        return "success";
      case "pre_restore":
        return "warn";
    }
  }

  function formatFileSize(sizeBytes: number): string {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    }
    if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return {
    backupDirectory,
    automaticBackupsEnabled,
    automaticBackupsLimit,
    manualBackupsLimit,
    backups,
    loadingBackups,
    creatingBackup,
    savingSettings,
    restoringFileName,
    deletingFileName,
    archiveDescription,
    exportingArchive,
    previewingArchive,
    restoringArchive,
    archivePreview,
    archivePreviewVisible,
    archiveReport,
    archiveReportVisible,
    navigateToDashboardAfterArchiveReport,
    lastArchiveExportPath,
    normalizeLimit,
    applyBackupSettings,
    onAutomaticEnabledChange,
    onAutomaticLimitChange,
    onManualLimitChange,
    loadBackupSettings,
    loadBackups,
    saveBackupSettings,
    createBackupNow,
    openBackupsFolder,
    restoreBackup,
    deleteBackup,
    exportArchive,
    openArchivePreview,
    restoreArchive,
    handleArchiveReportHide,
    formatBackupDate,
    formatLabel,
    tagSeverity,
    formatFileSize,
  };
});
