<template>
  <section id="backup" class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
    <ConfirmDialog />
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-[var(--text-primary)]">Backup</h2>
        <p class="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Backups are full SQLite snapshots for disaster recovery and undo. They are separate from CSV/JSON export.
        </p>
      </div>
      <Tag severity="info">Data backup</Tag>
    </div>

    <div class="mb-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
      <div class="mb-2 text-sm font-medium text-[var(--text-secondary)]">Backup storage location</div>
      <div class="break-all font-mono text-sm text-[var(--text-primary)]">{{ backupDirectory }}</div>
      <div class="mt-3 flex flex-wrap gap-3">
        <Button label="Reveal in Explorer" severity="secondary" outlined @click="openBackupsFolder" />
        <Button label="Open Backups Folder" text @click="openBackupsFolder" />
      </div>
    </div>

    <div class="mb-6 rounded-lg border border-[var(--border-color)]">
      <div class="grid gap-4 lg:grid-cols-3">
        <Card>
          <template #title>Automatic Backups</template>
          <template #content>
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-4">
                <label for="automaticBackupsEnabled" class="text-sm text-[var(--text-secondary)]">Enable on
                  startup</label>
                <ToggleSwitch inputId="automaticBackupsEnabled" :modelValue="automaticBackupsEnabled"
                  @update:modelValue="onAutomaticEnabledChange" />
              </div>
              <div class="space-y-2">
                <label for="automaticBackupsLimit" class="text-sm text-[var(--text-secondary)]">Startup backups to
                  keep</label>
                <InputNumber inputId="automaticBackupsLimit" :modelValue="automaticBackupsLimit"
                  @update:modelValue="onAutomaticLimitChange" :min="0" :max="999" showButtons inputClass="w-full"
                  class="w-full" />
                <p class="text-xs text-[var(--text-muted)]">Use 0 for unlimited retention.</p>
              </div>
            </div>
          </template>
        </Card>

        <Card>
          <template #title>Manual Retention</template>
          <template #content>
            <div class="space-y-2">
              <label for="manualBackupsLimit" class="text-sm text-[var(--text-secondary)]">Manual + pre-restore
                backups to keep</label>
              <InputNumber inputId="manualBackupsLimit" :modelValue="manualBackupsLimit"
                @update:modelValue="onManualLimitChange" :min="0" :max="999" showButtons inputClass="w-full"
                class="w-full" />
              <p class="text-xs text-[var(--text-muted)]">Pre-restore backups count against this limit. Use 0 for
                unlimited retention.</p>
            </div>
          </template>
        </Card>

        <Card>
          <template #title>Save Changes</template>
          <template #content>
            <div class="space-y-3">
              <p class="text-sm text-[var(--text-secondary)]">
                Startup backups run before the database worker initializes.
              </p>
              <Button label="Save Backup Settings" severity="secondary" outlined :loading="savingSettings"
                @click="saveSettings" />
            </div>
          </template>
        </Card>
      </div>
    </div>

    <div class="mb-6 p-4 rounded-lg border border-[var(--border-color)]">

      <div class="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-[var(--text-primary)]">Existing Backups</h3>
          <p class="text-sm text-[var(--text-muted)]">Newest first.</p>
        </div>
        <div>
          <Button label="Create Backup Now" :loading="creatingBackup" @click="createBackupNow" />
          <Button label="Refresh" icon="pi pi-refresh" text rounded aria-label="Refresh backups"
            @click="loadBackups" />
        </div>
      </div>

      <div v-if="loadingBackups"
        class="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-sm text-[var(--text-muted)]">
        Loading backups...
      </div>
      <div v-else-if="backups.length === 0"
        class="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-sm text-[var(--text-muted)]">
        No backups yet. Create your first backup or restart the app to generate an automatic startup backup.
      </div>
      <div v-else class="overflow-hidden rounded-lg border border-[var(--border-color)]">
        <div v-for="backup in backups" :key="backup.fileName"
          class="flex flex-col gap-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] p-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-[var(--text-primary)]">{{ formatBackupDate(backup.createdAt) }}</span>
              <Tag :value="formatLabel(backup.label)" :severity="tagSeverity(backup.label)" />
            </div>
            <div class="text-sm text-[var(--text-secondary)]">{{ formatFileSize(backup.sizeBytes) }}</div>
            <div class="break-all font-mono text-xs text-[var(--text-muted)]">{{ backup.fileName }}</div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button label="Restore" severity="secondary" outlined :disabled="restoringFileName === backup.fileName"
              :loading="restoringFileName === backup.fileName" @click="confirmRestore(backup)" />
            <Button icon="pi pi-trash" severity="danger" text rounded
              :disabled="deletingFileName === backup.fileName" :loading="deletingFileName === backup.fileName"
              @click="confirmDelete(backup)" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import Button from "primevue/button";
import Card from "primevue/card";
import ConfirmDialog from "primevue/confirmdialog";
import InputNumber from "primevue/inputnumber";
import Tag from "primevue/tag";
import ToggleSwitch from "primevue/toggleswitch";
import { useConfirm } from "primevue/useconfirm";
import type { BackupEntry, BackupLabel } from "../../types/models";
import { useSettingsStore } from "../../stores/settings";

const confirm = useConfirm();
const settingsStore = useSettingsStore();
const {
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
} = storeToRefs(settingsStore);

function onAutomaticEnabledChange(value: boolean | undefined) {
  settingsStore.onAutomaticEnabledChange(value);
}

function onAutomaticLimitChange(value: number | null | undefined) {
  settingsStore.onAutomaticLimitChange(value);
}

function onManualLimitChange(value: number | null | undefined) {
  settingsStore.onManualLimitChange(value);
}

async function saveSettings() {
  await settingsStore.saveBackupSettings();
}

async function createBackupNow() {
  await settingsStore.createBackupNow();
}

async function openBackupsFolder() {
  await settingsStore.openBackupsFolder();
}

async function loadBackups() {
  await settingsStore.loadBackups();
}

function confirmRestore(backup: BackupEntry) {
  confirm.require({
    header: "Restore Backup",
    message:
      "This will replace all current data with the state from this backup. This cannot be undone. A pre_restore backup of your current state will be created first.",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    acceptLabel: "Restore Backup",
    rejectLabel: "Cancel",
    accept: () => {
      void settingsStore.restoreBackup(backup.fileName);
    },
  });
}

function confirmDelete(backup: BackupEntry) {
  confirm.require({
    header: "Delete Backup",
    message: `Delete backup ${backup.fileName}?`,
    icon: "pi pi-trash",
    acceptClass: "p-button-danger",
    acceptLabel: "Delete",
    rejectLabel: "Cancel",
    accept: () => {
      void settingsStore.deleteBackup(backup.fileName);
    },
  });
}

function formatBackupDate(createdAt: string): string {
  return settingsStore.formatBackupDate(createdAt);
}

function formatLabel(label: BackupLabel): string {
  return settingsStore.formatLabel(label);
}

function tagSeverity(label: BackupLabel): "success" | "info" | "warn" {
  return settingsStore.tagSeverity(label);
}

function formatFileSize(sizeBytes: number): string {
  return settingsStore.formatFileSize(sizeBytes);
}

onMounted(async () => {
  await Promise.all([
    settingsStore.loadBackupSettings(),
    settingsStore.loadBackups(),
  ]);
});
</script>
