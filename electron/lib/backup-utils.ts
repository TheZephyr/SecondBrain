import fs from "fs";
import path from "path";
import type {
  BackupEntry,
  BackupLabel,
  BackupSettings,
  UpdateBackupSettingsInput,
} from "../../src/types/models";

export const BACKUP_SETTINGS_FILE = "backup-settings.json";
export const BACKUP_DIRECTORY_NAME = "backups";
export const BACKUP_FILE_PREFIX = "secondbrain";
export const DEFAULT_BACKUP_SETTINGS: UpdateBackupSettingsInput = {
  automaticBackupsEnabled: true,
  automaticBackupsLimit: 10,
  manualBackupsLimit: 20,
};

const BACKUP_FILE_RE =
  /^secondbrain_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_(startup|manual|pre_restore)\.db$/;

function clampRetention(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fallback;
  }
  if (value < 0) {
    return fallback;
  }
  return Math.min(value, 999);
}

export function getBackupDirectory(userDataPath: string): string {
  return path.join(userDataPath, BACKUP_DIRECTORY_NAME);
}

export function getBackupSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, BACKUP_SETTINGS_FILE);
}

export function normalizeBackupSettings(
  value: unknown,
  backupDirectory: string,
): BackupSettings {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<UpdateBackupSettingsInput>)
      : {};

  return {
    automaticBackupsEnabled:
      typeof input.automaticBackupsEnabled === "boolean"
        ? input.automaticBackupsEnabled
        : DEFAULT_BACKUP_SETTINGS.automaticBackupsEnabled,
    automaticBackupsLimit: clampRetention(
      input.automaticBackupsLimit,
      DEFAULT_BACKUP_SETTINGS.automaticBackupsLimit,
    ),
    manualBackupsLimit: clampRetention(
      input.manualBackupsLimit,
      DEFAULT_BACKUP_SETTINGS.manualBackupsLimit,
    ),
    backupDirectory,
  };
}

export async function loadBackupSettings(
  userDataPath: string,
): Promise<BackupSettings> {
  const backupDirectory = getBackupDirectory(userDataPath);
  const settingsPath = getBackupSettingsPath(userDataPath);

  try {
    const raw = await fs.promises.readFile(settingsPath, "utf-8");
    return normalizeBackupSettings(JSON.parse(raw), backupDirectory);
  } catch {
    return normalizeBackupSettings({}, backupDirectory);
  }
}

export async function saveBackupSettings(
  userDataPath: string,
  input: UpdateBackupSettingsInput,
): Promise<BackupSettings> {
  const backupDirectory = getBackupDirectory(userDataPath);
  const settingsPath = getBackupSettingsPath(userDataPath);
  const settings = normalizeBackupSettings(input, backupDirectory);

  await fs.promises.mkdir(userDataPath, { recursive: true });
  await fs.promises.writeFile(
    settingsPath,
    JSON.stringify(
      {
        automaticBackupsEnabled: settings.automaticBackupsEnabled,
        automaticBackupsLimit: settings.automaticBackupsLimit,
        manualBackupsLimit: settings.manualBackupsLimit,
      },
      null,
      2,
    ),
    "utf-8",
  );

  return settings;
}

export async function ensureBackupDirectory(
  userDataPath: string,
): Promise<string> {
  const backupDirectory = getBackupDirectory(userDataPath);
  await fs.promises.mkdir(backupDirectory, { recursive: true });
  return backupDirectory;
}

export async function tryCreateStartupBackup(
  createBackup: () => Promise<void>,
  logError: (
    message?: unknown,
    ...optionalParams: unknown[]
  ) => void = console.error,
): Promise<boolean> {
  try {
    await createBackup();
    return true;
  } catch (error) {
    logError("[Startup Backup] Failed to create startup backup:", error);
    return false;
  }
}

export function formatBackupTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

export function buildBackupFileName(
  label: BackupLabel,
  date: Date = new Date(),
): string {
  return `${BACKUP_FILE_PREFIX}_${formatBackupTimestamp(date)}_${label}.db`;
}

export function parseBackupFileName(
  fileName: string,
  backupDirectory: string,
  sizeBytes: number,
): BackupEntry | null {
  const match = BACKUP_FILE_RE.exec(fileName);
  if (!match) {
    return null;
  }

  const [, datePart, timePart, label] = match;
  const createdAt = `${datePart}T${timePart.replace(/-/g, ":")}`;

  return {
    fileName,
    filePath: path.join(backupDirectory, fileName),
    label: label as BackupLabel,
    createdAt,
    sizeBytes,
  };
}

export async function listBackups(
  userDataPath: string,
): Promise<BackupEntry[]> {
  const backupDirectory = await ensureBackupDirectory(userDataPath);
  const entries = await fs.promises.readdir(backupDirectory, {
    withFileTypes: true,
  });

  const backups: BackupEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const fullPath = path.join(backupDirectory, entry.name);
    const stat = await fs.promises.stat(fullPath);
    const backup = parseBackupFileName(entry.name, backupDirectory, stat.size);
    if (backup) {
      backups.push(backup);
    }
  }

  backups.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    return a.fileName < b.fileName ? 1 : -1;
  });
  return backups;
}

export function getBackupRetentionLimit(
  settings: BackupSettings,
  label: BackupLabel,
): number {
  return label === "startup"
    ? settings.automaticBackupsLimit
    : settings.manualBackupsLimit;
}

export async function pruneBackupSet(
  backups: BackupEntry[],
  limit: number,
): Promise<string[]> {
  if (limit === 0 || backups.length <= limit) {
    return [];
  }

  const toDelete = backups.slice(limit);
  await Promise.all(
    toDelete.map((backup) =>
      fs.promises.unlink(backup.filePath).catch(() => undefined),
    ),
  );
  return toDelete.map((backup) => backup.fileName);
}

export function partitionBackups(backups: BackupEntry[]): {
  automatic: BackupEntry[];
  manual: BackupEntry[];
} {
  return {
    automatic: backups.filter((backup) => backup.label === "startup"),
    manual: backups.filter(
      (backup) => backup.label === "manual" || backup.label === "pre_restore",
    ),
  };
}
