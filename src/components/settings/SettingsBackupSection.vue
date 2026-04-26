<template>
  <section
    id="backup"
    class="rounded-xl border border-(--border-color) bg-(--bg-secondary) p-6"
  >
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-(--text-primary)">Backup</h2>
        <p class="mt-1 max-w-2xl text-sm text-(--text-muted)">
          Backups are full SQLite snapshots for disaster recovery and undo. They
          are separate from CSV/JSON export.
        </p>
      </div>
      <AppBadge severity="info">Data backup</AppBadge>
    </div>

    <div
      class="mb-6 rounded-lg border border-(--border-color) bg-(--bg-secondary) p-4"
    >
      <div class="mb-2 text-sm font-medium text-(--text-secondary)">
        Backup storage location
      </div>
      <div class="break-all font-mono text-sm text-(--text-primary)">
        {{ backupDirectory }}
      </div>
      <div class="mt-3 flex flex-wrap gap-3">
        <AppButton
          label="Reveal in Explorer"
          severity="secondary"
          outlined
          @click="openBackupsFolder"
        />
        <AppButton
          label="Open Backups Folder"
          text
          @click="openBackupsFolder"
        />
      </div>
    </div>

    <div class="mb-6 rounded-lg">
      <div class="grid gap-4 lg:grid-cols-3">
        <AppCard title="Automatic Backups">
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-4">
              <label
                for="automaticBackupsEnabled"
                class="text-sm text-(--text-secondary)"
                >Enable on startup</label
              >
              <AppSwitch
                inputId="automaticBackupsEnabled"
                :modelValue="automaticBackupsEnabled"
                @update:modelValue="onAutomaticEnabledChange"
              />
            </div>
            <div class="space-y-2">
              <label
                for="automaticBackupsLimit"
                class="text-sm text-(--text-secondary)"
                >Startup backups to keep</label
              >
              <AppNumberField
                inputId="automaticBackupsLimit"
                :modelValue="automaticBackupsLimit"
                @update:modelValue="onAutomaticLimitChange"
                :min="0"
                :max="999"
                showButtons
                inputClass="w-full"
                class="w-full"
              />
              <p class="text-xs text-(--text-muted)">
                Use 0 for unlimited retention.
              </p>
            </div>
          </div>
        </AppCard>

        <AppCard title="Manual Retention">
          <div class="space-y-2">
            <label
              for="manualBackupsLimit"
              class="text-sm text-(--text-secondary)"
            >
              Manual + pre-restore backups to keep
            </label>
            <AppNumberField
              inputId="manualBackupsLimit"
              :modelValue="manualBackupsLimit"
              @update:modelValue="onManualLimitChange"
              :min="0"
              :max="999"
              showButtons
              inputClass="w-full"
              class="w-full"
            />
            <p class="text-xs text-(--text-muted)">
              Pre-restore backups count against this limit. Use 0 for unlimited
              retention.
            </p>
          </div>
        </AppCard>

        <AppCard title="Save Changes">
          <div class="space-y-3">
            <p class="text-sm text-(--text-secondary)">
              Startup backups run before the database worker initializes.
            </p>
            <AppButton
              label="Save Backup Settings"
              severity="secondary"
              outlined
              :loading="savingSettings"
              @click="saveSettings"
            />
          </div>
        </AppCard>
      </div>
    </div>

    <div class="mb-6 rounded-lg border border-(--border-color) p-4">
      <div class="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold text-(--text-primary)">
            Existing Backups
          </h3>
          <p class="text-sm text-(--text-muted)">Newest first.</p>
        </div>
        <div class="flex gap-2">
          <AppButton
            label="Create Backup Now"
            :loading="creatingBackup"
            @click="createBackupNow"
          />
          <AppButton
            text
            rounded
            aria-label="Refresh backups"
            @click="loadBackups"
          >
            <template #icon>
              <RefreshCw class="size-4" />
            </template>
          </AppButton>
        </div>
      </div>

      <div
        v-if="loadingBackups"
        class="rounded-lg border border-dashed border-(--border-color) p-6 text-sm text-(--text-muted)"
      >
        Loading backups...
      </div>
      <div
        v-else-if="backups.length === 0"
        class="rounded-lg border border-dashed border-(--border-color) p-6 text-sm text-(--text-muted)"
      >
        No backups yet. Create your first backup or restart the app to generate
        an automatic startup backup.
      </div>
      <div
        v-else
        class="overflow-hidden rounded-lg border border-(--border-color)"
      >
        <div
          v-for="backup in backups"
          :key="backup.fileName"
          class="flex flex-col gap-4 border-b border-(--border-color) bg-(--bg-primary) p-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
        >
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-(--text-primary)">{{
                formatBackupDate(backup.createdAt)
              }}</span>
              <AppBadge
                :value="formatLabel(backup.label)"
                :severity="tagSeverity(backup.label)"
              />
            </div>
            <div class="text-sm text-(--text-secondary)">
              {{ formatFileSize(backup.sizeBytes) }}
            </div>
            <div class="break-all font-mono text-xs text-(--text-muted)">
              {{ backup.fileName }}
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <AppButton
              label="Restore"
              severity="secondary"
              outlined
              :disabled="restoringFileName === backup.fileName"
              :loading="restoringFileName === backup.fileName"
              @click="confirmRestore(backup)"
            />
            <AppButton
              severity="danger"
              text
              rounded
              :disabled="deletingFileName === backup.fileName"
              :loading="deletingFileName === backup.fileName"
              @click="confirmDelete(backup)"
            >
              <template #icon>
                <Trash2 class="size-4" />
              </template>
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { RefreshCw, Trash2 } from "lucide-vue-next";
import AppBadge from "@/components/app/ui/AppBadge.vue";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppCard from "@/components/app/ui/AppCard.vue";
import AppNumberField from "@/components/app/ui/AppNumberField.vue";
import AppSwitch from "@/components/app/ui/AppSwitch.vue";
import { useAppConfirm } from "@/components/app/ui/confirm-service";
import type { BackupEntry, BackupLabel } from "../../types/models";
import { useSettingsStore } from "../../stores/settings";

const { confirm } = useAppConfirm();
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

function onAutomaticEnabledChange(value: boolean) {
  settingsStore.onAutomaticEnabledChange(value);
}

function onAutomaticLimitChange(value: number | null) {
  settingsStore.onAutomaticLimitChange(value);
}

function onManualLimitChange(value: number | null) {
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

async function confirmRestore(backup: BackupEntry) {
  const accepted = await confirm({
    title: "Restore Backup",
    description:
      "This will replace all current data with the state from this backup. This cannot be undone. A pre_restore backup of your current state will be created first.",
    confirmLabel: "Restore Backup",
    cancelLabel: "Cancel",
    destructive: true,
  });

  if (accepted) {
    await settingsStore.restoreBackup(backup.fileName);
  }
}

async function confirmDelete(backup: BackupEntry) {
  const accepted = await confirm({
    title: "Delete Backup",
    description: `Delete backup ${backup.fileName}?`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    destructive: true,
  });

  if (accepted) {
    await settingsStore.deleteBackup(backup.fileName);
  }
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
