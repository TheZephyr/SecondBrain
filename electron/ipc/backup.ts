import { shell, app } from "electron";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type {
  BackupEntry,
  BackupLabel,
  UpdateBackupSettingsInput,
} from "../../src/types/models";
import { AppError } from "../db/worker-manager";
import {
  buildBackupFileName,
  ensureBackupDirectory,
  getBackupRetentionLimit,
  listBackups as listBackupsFromDisk,
  loadBackupSettings,
  partitionBackups,
  pruneBackupSet,
  saveBackupSettings,
} from "../lib/backup-utils";
import {
  backupFileNameSchema,
  UpdateBackupSettingsInputSchema,
} from "../../src/validation/schemas";
import {
  stopDbWorker,
  startDbWorker,
  requireDbPath,
  requireUserDataPath,
} from "../db/worker-manager";
import { parseOrThrow, handleIpc } from "./utils";

async function checkpointDatabaseFile(targetDbPath: string): Promise<void> {
  if (!(await fs.promises.stat(targetDbPath).catch(() => null))) {
    return;
  }

  const tempDb = new Database(targetDbPath);
  try {
    tempDb.pragma("busy_timeout = 5000");
    tempDb.pragma("wal_checkpoint(TRUNCATE)");
  } finally {
    tempDb.close();
  }
}

async function removeDbSidecars(targetDbPath: string): Promise<void> {
  await Promise.all(
    [`${targetDbPath}-wal`, `${targetDbPath}-shm`].map((filePath) =>
      fs.promises.unlink(filePath).catch(() => undefined),
    ),
  );
}

export async function copyDatabaseToBackup(
  label: BackupLabel,
  excludeFromPruning?: string[],
): Promise<BackupEntry> {
  const liveDbPath = requireDbPath();
  const userDataPath = requireUserDataPath();

  if (!(await fs.promises.stat(liveDbPath).catch(() => null))) {
    throw new AppError("FS_READ_FAILED", "Database file does not exist.");
  }

  await stopDbWorker(`Creating ${label} backup.`);

  try {
    await checkpointDatabaseFile(liveDbPath);

    const backupDirectory = await ensureBackupDirectory(userDataPath);
    const fileName = buildBackupFileName(label);
    const destinationPath = path.join(backupDirectory, fileName);
    await fs.promises.copyFile(liveDbPath, destinationPath);

    const backups = await listBackupsFromDisk(userDataPath);
    const created = backups.find((backup) => backup.fileName === fileName);
    if (!created) {
      throw new AppError("FS_READ_FAILED", "Backup file was not created.");
    }

    const settings = await loadBackupSettings(userDataPath);
    const limit = getBackupRetentionLimit(settings, label);
    const buckets = partitionBackups(backups);
    const excludeSet = new Set(excludeFromPruning ?? []);
    if (label === "startup") {
      const filtered = buckets.automatic.filter(
        (b) => !excludeSet.has(b.fileName),
      );
      await pruneBackupSet(filtered, limit);
    } else {
      const filtered = buckets.manual.filter(
        (b) => !excludeSet.has(b.fileName),
      );
      await pruneBackupSet(filtered, limit);
    }

    return created;
  } finally {
    try {
      await startDbWorker(liveDbPath);
    } catch (error) {
      console.error(
        `[Backup] Failed to restart database worker after ${label} backup:`,
        error,
      );
      throw error;
    }
  }
}

export async function maybeCreateStartupBackup(): Promise<void> {
  const liveDbPath = requireDbPath();
  const userDataPath = requireUserDataPath();
  const settings = await loadBackupSettings(userDataPath);

  if (!settings.automaticBackupsEnabled) {
    return;
  }
  if (!(await fs.promises.stat(liveDbPath).catch(() => null))) {
    return;
  }

  await checkpointDatabaseFile(liveDbPath);
  const backupDirectory = await ensureBackupDirectory(userDataPath);
  const fileName = buildBackupFileName("startup");
  await fs.promises.copyFile(liveDbPath, path.join(backupDirectory, fileName));

  const backups = await listBackupsFromDisk(userDataPath);
  await pruneBackupSet(
    partitionBackups(backups).automatic,
    settings.automaticBackupsLimit,
  );
}

async function restoreBackupFromFileName(fileName: string): Promise<boolean> {
  const userDataPath = requireUserDataPath();
  const liveDbPath = requireDbPath();
  const backups = await listBackupsFromDisk(userDataPath);
  const backup = backups.find((entry) => entry.fileName === fileName);
  if (!backup) {
    throw new AppError("FS_READ_FAILED", "Backup file not found.");
  }

  await copyDatabaseToBackup("pre_restore", [backup.fileName]);
  await stopDbWorker("Restore backup requested.");
  await checkpointDatabaseFile(backup.filePath);
  await removeDbSidecars(liveDbPath);
  await fs.promises.copyFile(backup.filePath, liveDbPath);
  await removeDbSidecars(liveDbPath);

  app.relaunch();
  app.exit(0);
  return true;
}

export function registerBackupIpcHandlers() {
  handleIpc("backup:getSettings", async () => {
    return loadBackupSettings(requireUserDataPath());
  });

  handleIpc(
    "backup:updateSettings",
    async (_, payload: UpdateBackupSettingsInput) => {
      const input = parseOrThrow(
        UpdateBackupSettingsInputSchema,
        payload,
        "backup:updateSettings",
      );
      return saveBackupSettings(requireUserDataPath(), input);
    },
  );

  handleIpc("backup:list", async () => {
    return listBackupsFromDisk(requireUserDataPath());
  });

  handleIpc("backup:createManual", async () => {
    return copyDatabaseToBackup("manual");
  });

  handleIpc("backup:restore", async (_, fileName: string) => {
    const parsedFileName = parseOrThrow(
      backupFileNameSchema,
      fileName,
      "backup:restore",
    );
    return restoreBackupFromFileName(parsedFileName);
  });

  handleIpc("backup:delete", async (_, fileName: string) => {
    const parsedFileName = parseOrThrow(
      backupFileNameSchema,
      fileName,
      "backup:delete",
    );
    const backupDirectory = await ensureBackupDirectory(requireUserDataPath());
    await fs.promises.unlink(path.join(backupDirectory, parsedFileName));
    return true;
  });

  handleIpc("backup:openFolder", async () => {
    const backupDirectory = await ensureBackupDirectory(requireUserDataPath());
    await shell.openPath(backupDirectory);
    return true;
  });
}
