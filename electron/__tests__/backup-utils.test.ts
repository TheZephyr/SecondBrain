import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBackupFileName,
  DEFAULT_BACKUP_SETTINGS,
  ensureBackupDirectory,
  getBackupDirectory,
  listBackups,
  loadBackupSettings,
  normalizeBackupSettings,
  partitionBackups,
  pruneBackupSet,
  saveBackupSettings,
  tryCreateStartupBackup,
} from "../lib/backup-utils";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secondbrain-backups-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("backup utils", () => {
  it("loads default settings when sidecar is missing", async () => {
    const dir = makeTempDir();

    const settings = await loadBackupSettings(dir);

    expect(settings).toMatchObject({
      ...DEFAULT_BACKUP_SETTINGS,
      backupDirectory: getBackupDirectory(dir),
    });
  });

  it("falls back to defaults when sidecar JSON is invalid", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "backup-settings.json"),
      "{bad json",
      "utf-8",
    );

    const settings = await loadBackupSettings(dir);

    expect(settings.automaticBackupsEnabled).toBe(true);
    expect(settings.automaticBackupsLimit).toBe(10);
    expect(settings.manualBackupsLimit).toBe(20);
  });

  it("saves normalized settings", async () => {
    const dir = makeTempDir();

    const settings = await saveBackupSettings(dir, {
      automaticBackupsEnabled: false,
      automaticBackupsLimit: 5,
      manualBackupsLimit: 0,
    });

    expect(settings).toMatchObject({
      automaticBackupsEnabled: false,
      automaticBackupsLimit: 5,
      manualBackupsLimit: 0,
      backupDirectory: getBackupDirectory(dir),
    });
  });

  it("lists valid backups newest first", async () => {
    const dir = makeTempDir();
    const backupDir = await ensureBackupDirectory(dir);
    const older = buildBackupFileName(
      "startup",
      new Date("2026-03-22T14:30:00"),
    );
    const newer = buildBackupFileName(
      "manual",
      new Date("2026-03-22T15:45:12"),
    );

    fs.writeFileSync(path.join(backupDir, older), "old");
    fs.writeFileSync(path.join(backupDir, newer), "new");
    fs.writeFileSync(path.join(backupDir, "ignore.txt"), "x");

    const backups = await listBackups(dir);

    expect(backups.map((backup) => backup.fileName)).toEqual([newer, older]);
    expect(backups[0]?.label).toBe("manual");
  });

  it("prunes oldest automatic backups to the retention limit", async () => {
    const dir = makeTempDir();
    const backupDir = await ensureBackupDirectory(dir);
    const names = [
      buildBackupFileName("startup", new Date("2026-03-22T10:00:00")),
      buildBackupFileName("startup", new Date("2026-03-22T11:00:00")),
      buildBackupFileName("startup", new Date("2026-03-22T12:00:00")),
    ];
    for (const name of names) {
      fs.writeFileSync(path.join(backupDir, name), name);
    }

    const backups = await listBackups(dir);
    const deleted = await pruneBackupSet(
      partitionBackups(backups).automatic,
      2,
    );

    expect(deleted).toEqual([names[0]]);
    expect(fs.existsSync(path.join(backupDir, names[0]))).toBe(false);
  });

  it("prunes oldest manual bucket backups including pre_restore", async () => {
    const dir = makeTempDir();
    const backupDir = await ensureBackupDirectory(dir);
    const names = [
      buildBackupFileName("manual", new Date("2026-03-22T10:00:00")),
      buildBackupFileName("pre_restore", new Date("2026-03-22T11:00:00")),
      buildBackupFileName("manual", new Date("2026-03-22T12:00:00")),
    ];
    for (const name of names) {
      fs.writeFileSync(path.join(backupDir, name), name);
    }

    const backups = await listBackups(dir);
    const deleted = await pruneBackupSet(partitionBackups(backups).manual, 2);

    expect(deleted).toEqual([names[0]]);
    expect(fs.existsSync(path.join(backupDir, names[0]))).toBe(false);
  });

  it("normalizes malformed settings values", () => {
    const settings = normalizeBackupSettings(
      {
        automaticBackupsEnabled: "yes",
        automaticBackupsLimit: -5,
        manualBackupsLimit: 5000,
      },
      "C:\\backups",
    );

    expect(settings).toEqual({
      automaticBackupsEnabled: true,
      automaticBackupsLimit: 10,
      manualBackupsLimit: 999,
      backupDirectory: "C:\\backups",
    });
  });

  it("returns true when startup backup succeeds", async () => {
    await expect(tryCreateStartupBackup(async () => undefined)).resolves.toBe(
      true,
    );
  });

  it("logs and returns false when startup backup fails", async () => {
    const error = new Error("disk full");
    const logError = vi.fn();

    const result = await tryCreateStartupBackup(async () => {
      throw error;
    }, logError);

    expect(result).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      "[Startup Backup] Failed to create startup backup:",
      error,
    );
  });
});
