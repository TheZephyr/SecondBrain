<template>
  <div class="min-h-full px-6 py-8">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ConfirmDialog />
      <Dialog
        v-model:visible="archivePreviewVisible"
        modal
        :draggable="false"
        header="Restore Full Archive"
        class="w-full max-w-3xl"
      >
        <div v-if="archivePreview" class="space-y-4">
          <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
            <div class="text-sm font-medium text-[var(--text-secondary)]">Archive file</div>
            <div class="mt-1 break-all font-mono text-sm text-[var(--text-primary)]">
              {{ archivePreview.filePath }}
            </div>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <div class="rounded-md border border-[var(--border-color)] p-3">
                <div class="text-xs uppercase tracking-wide text-[var(--text-muted)]">Archive</div>
                <div class="mt-2 text-sm text-[var(--text-secondary)]">
                  <div>{{ archivePreview.archiveSummary.stats.collectionCount }} collections</div>
                  <div>{{ archivePreview.archiveSummary.stats.totalFieldCount }} fields</div>
                  <div>{{ archivePreview.archiveSummary.stats.totalItemCount }} items</div>
                </div>
              </div>
              <div class="rounded-md border border-[var(--border-color)] p-3">
                <div class="text-xs uppercase tracking-wide text-[var(--text-muted)]">Current Database</div>
                <div class="mt-2 text-sm text-[var(--text-secondary)]">
                  <div>{{ archivePreview.currentDbSummary.collectionCount }} collections</div>
                  <div>{{ archivePreview.currentDbSummary.totalFieldCount }} fields</div>
                  <div>{{ archivePreview.currentDbSummary.totalItemCount }} items</div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border p-4 text-sm"
            :class="archivePreview.willReplaceExistingData
              ? 'border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--text-secondary)]'
              : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'"
          >
            <div class="font-medium text-[var(--text-primary)]">
              {{ archivePreview.willReplaceExistingData ? 'Existing data will be replaced.' : 'Current database is empty.' }}
            </div>
            <div class="mt-1">
              A <span class="font-medium">pre_restore</span> backup will be created automatically before the restore begins.
            </div>
          </div>

          <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
            <div class="text-sm font-medium text-[var(--text-primary)]">Collections in archive</div>
            <div class="mt-3 max-h-64 space-y-2 overflow-y-auto">
              <div
                v-for="collection in archivePreview.archiveSummary.collections"
                :key="collection.name"
                class="flex items-center justify-between rounded-md border border-[var(--border-color)] px-3 py-2 text-sm"
              >
                <span class="font-medium text-[var(--text-primary)]">{{ collection.name }}</span>
                <span class="text-[var(--text-muted)]">
                  {{ collection.stats.fieldCount }} fields, {{ collection.stats.itemCount }} items
                </span>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <Button
            severity="secondary"
            text
            :disabled="restoringArchive"
            @click="archivePreviewVisible = false"
          >
            Cancel
          </Button>
          <Button
            severity="danger"
            :loading="restoringArchive"
            @click="restoreArchive"
          >
            Restore Full Archive
          </Button>
        </template>
      </Dialog>

      <Dialog
        v-model:visible="archiveReportVisible"
        modal
        :draggable="false"
        header="Archive Restore Report"
        class="w-full max-w-3xl"
        @hide="handleArchiveReportHide"
      >
        <div v-if="archiveReport" class="space-y-4">
          <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
            <div class="text-sm font-medium text-[var(--text-primary)]">Pre-restore backup</div>
            <div class="mt-1 break-all font-mono text-sm text-[var(--text-secondary)]">
              {{ archiveReport.preRestoreBackupPath }}
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
              <div class="text-sm font-medium text-[var(--text-primary)]">
                Restored Collections ({{ archiveReport.restoredCollections.length }})
              </div>
              <div class="mt-3 space-y-2">
                <div
                  v-for="name in archiveReport.restoredCollections"
                  :key="name"
                  class="rounded-md border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  {{ name }}
                </div>
                <div
                  v-if="archiveReport.restoredCollections.length === 0"
                  class="text-sm text-[var(--text-muted)]"
                >
                  No collections were restored.
                </div>
              </div>
            </div>
            <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
              <div class="text-sm font-medium text-[var(--text-primary)]">
                Failed Collections ({{ archiveReport.failedCollections.length }})
              </div>
              <div class="mt-3 space-y-2">
                <div
                  v-for="failure in archiveReport.failedCollections"
                  :key="`${failure.collectionName}-${failure.message}`"
                  class="rounded-md border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  <div class="font-medium text-[var(--text-primary)]">{{ failure.collectionName }}</div>
                  <div class="mt-1 text-[var(--text-muted)]">{{ failure.message }}</div>
                </div>
                <div
                  v-if="archiveReport.failedCollections.length === 0"
                  class="text-sm text-[var(--text-muted)]"
                >
                  No collection-level restore failures.
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
            <div class="text-sm font-medium text-[var(--text-primary)]">
              Dropped View References ({{ archiveReport.droppedViewReferences.length }})
            </div>
            <div class="mt-3 space-y-2" v-if="archiveReport.droppedViewReferences.length > 0">
              <div
                v-for="warning in archiveReport.droppedViewReferences"
                :key="`${warning.collectionName}-${warning.viewName}-${warning.referenceType}-${warning.referenceValue}`"
                class="rounded-md border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)]"
              >
                <div class="font-medium text-[var(--text-primary)]">
                  {{ warning.collectionName }} / {{ warning.viewName }}
                </div>
                <div class="mt-1 text-[var(--text-muted)]">
                  {{ warning.referenceType }}: {{ warning.referenceValue }}. {{ warning.reason }}
                </div>
              </div>
            </div>
            <div v-else class="mt-3 text-sm text-[var(--text-muted)]">No dropped view references.</div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
              <div class="text-sm font-medium text-[var(--text-primary)]">
                Skipped Entities ({{ archiveReport.skippedEntities.length }})
              </div>
              <div class="mt-3 space-y-2" v-if="archiveReport.skippedEntities.length > 0">
                <div
                  v-for="warning in archiveReport.skippedEntities"
                  :key="`${warning.collectionName}-${warning.scope}-${warning.name}-${warning.type}`"
                  class="rounded-md border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  <div class="font-medium text-[var(--text-primary)]">
                    {{ warning.collectionName }} / {{ warning.name }}
                  </div>
                  <div class="mt-1 text-[var(--text-muted)]">
                    {{ warning.scope }} type "{{ warning.type }}" skipped. {{ warning.reason }}
                  </div>
                </div>
              </div>
              <div v-else class="mt-3 text-sm text-[var(--text-muted)]">No skipped fields or views.</div>
            </div>
            <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
              <div class="text-sm font-medium text-[var(--text-primary)]">
                Stat Mismatches ({{ archiveReport.statMismatches.length }})
              </div>
              <div class="mt-3 space-y-2" v-if="archiveReport.statMismatches.length > 0">
                <div
                  v-for="mismatch in archiveReport.statMismatches"
                  :key="`${mismatch.scope}-${mismatch.collectionName ?? 'total'}-${mismatch.stat}`"
                  class="rounded-md border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  <div class="font-medium text-[var(--text-primary)]">
                    {{ mismatch.scope === 'collection' ? mismatch.collectionName : 'Total database' }}
                  </div>
                  <div class="mt-1 text-[var(--text-muted)]">
                    {{ mismatch.stat }} expected {{ mismatch.expected }}, got {{ mismatch.actual }}.
                  </div>
                </div>
              </div>
              <div v-else class="mt-3 text-sm text-[var(--text-muted)]">No stat mismatches detected.</div>
            </div>
          </div>
        </div>

        <template #footer>
          <Button @click="archiveReportVisible = false">Close</Button>
        </template>
      </Dialog>

      <section id="general" class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold text-[var(--text-primary)]">Settings</h1>
            <p class="mt-1 text-sm text-[var(--text-muted)]">
              Global preferences and recovery tools for your local data.
            </p>
          </div>
          <Tag value="General" severity="secondary" />
        </div>

        <div class="mb-6 rounded-lg border border-[var(--border-color)]">

          <div class="grid gap-4 md:grid-cols-2">
            <Card>
              <template #title>App</template>
              <template #content>
                <div class="space-y-2 text-sm text-[var(--text-secondary)]">
                  <div class="flex items-center justify-between gap-4">
                    <span>Name</span>
                    <span class="font-medium text-[var(--text-primary)]">Second Brain</span>
                  </div>
                  <div class="flex items-center justify-between gap-4">
                    <span>Version</span>
                    <span class="font-medium text-[var(--text-primary)]">v{{ appVersion }}</span>
                  </div>
                </div>
              </template>
            </Card>

            <Card>
              <template #title>Quick Links</template>
              <template #content>
                <div class="flex flex-wrap gap-3">
                  <Button label="Go to Dashboard" severity="secondary" outlined @click="store.showDashboard()" />
                  <Button label="Open Backups Folder" text @click="openBackupsFolder" />
                </div>
              </template>
            </Card>
          </div>
        </div>
      </section>

      <section id="backup" class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
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

      <section id="data" class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-[var(--text-primary)]">Data</h2>
          </div>
          <Tag severity="info">Import & Export</Tag>
        </div>
        <div class="rounded-lg border border-[var(--border-color)]">
          <div class="grid gap-4 lg:grid-cols-2">
            <Card>
              <template #title>Full Archive Export</template>
              <template #content>
                <div class="space-y-4">
                  <p class="text-sm text-[var(--text-secondary)]">
                    Export the entire database to a single JSON archive for cross-machine migration or long-term
                    storage.
                  </p>
                  <div class="space-y-2">
                    <label for="archiveDescription" class="text-sm text-[var(--text-secondary)]">Description</label>
                    <Textarea id="archiveDescription" v-model="archiveDescription" rows="4" class="w-full" autoResize
                      placeholder="Optional notes about this archive" />
                  </div>
                  <Button label="Export Full Archive" :loading="exportingArchive" @click="exportArchive" />
                  <div v-if="lastArchiveExportPath" class="text-xs text-[var(--text-muted)]">
                    Last export: <span class="font-mono">{{ lastArchiveExportPath }}</span>
                  </div>
                </div>
              </template>
            </Card>

            <Card>
              <template #title>Full Archive Restore</template>
              <template #content>
                <div class="space-y-4">
                  <p class="text-sm text-[var(--text-secondary)]">
                    Restore a full archive into the current database. Existing data will be replaced after a mandatory
                    pre-restore backup is created.
                  </p>
                  <Button label="Select Archive File" severity="danger" outlined :loading="previewingArchive"
                    @click="openArchivePreview" />
                </div>
              </template>
            </Card>
          </div>
        </div>
        
        <div class="mt-6 rounded-lg border border-[var(--border-color)] p-4">
          <div class="text-sm font-medium text-[var(--text-primary)]">Collection Import/Export</div>
          <p class="mt-2 text-sm text-[var(--text-secondary)]">
            Collection-level CSV/JSON import and export stays in Collection Settings for per-collection workflows.
          </p>
          <div class="mt-4">
            <Button label="Back to Dashboard" severity="secondary" outlined @click="store.showDashboard()" />
          </div>
        </div>
      </section>

      <section id="about" class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-[var(--text-primary)]">About</h2>
          </div>
          <Tag severity="secondary">Build & License</Tag>
        </div>
        <div class="space-y-2 text-sm text-[var(--text-secondary)]">
          <div class="flex items-center justify-between gap-4">
            <span>Application</span>
            <span class="font-medium text-[var(--text-primary)]">Second Brain v.{{ appVersion }}</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span>Author</span>
            <span class="font-medium text-[var(--text-primary)]">Zephyr</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span>License</span>
            <span class="font-medium text-[var(--text-primary)]">MIT License</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import ConfirmDialog from "primevue/confirmdialog";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import ToggleSwitch from "primevue/toggleswitch";
import { useConfirm } from "primevue/useconfirm";
import { useStore } from "../../store";
import { handleIpc } from "../../utils/ipc";
import type {
  BackupEntry,
  BackupLabel,
  FullArchiveExportResult,
  FullArchivePreview,
  FullArchiveRestoreReport,
} from "../../types/models";

const appVersion = __APP_VERSION__;
const store = useStore();
const confirm = useConfirm();

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
const archivePreview = ref<FullArchivePreview | null>(null);
const archivePreviewVisible = ref(false);
const archiveReport = ref<FullArchiveRestoreReport | null>(null);
const archiveReportVisible = ref(false);
const navigateToDashboardAfterArchiveReport = ref(false);
const lastArchiveExportPath = ref<string | null>(null);

function normalizeLimit(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(999, Math.trunc(value)));
}

function onAutomaticEnabledChange(value: boolean | undefined) {
  automaticBackupsEnabled.value = Boolean(value);
}

function onAutomaticLimitChange(value: number | null | undefined) {
  automaticBackupsLimit.value = normalizeLimit(
    value,
    automaticBackupsLimit.value,
  );
}

function onManualLimitChange(value: number | null | undefined) {
  manualBackupsLimit.value = normalizeLimit(value, manualBackupsLimit.value);
}

function applySettings(settings: {
  backupDirectory: string;
  automaticBackupsEnabled: boolean;
  automaticBackupsLimit: number;
  manualBackupsLimit: number;
}) {
  backupDirectory.value = settings.backupDirectory;
  automaticBackupsEnabled.value = settings.automaticBackupsEnabled;
  automaticBackupsLimit.value = settings.automaticBackupsLimit;
  manualBackupsLimit.value = settings.manualBackupsLimit;
}

async function loadSettings() {
  const result = await window.electronAPI.getBackupSettings();
  const fallback = {
    backupDirectory: "",
    automaticBackupsEnabled: true,
    automaticBackupsLimit: 10,
    manualBackupsLimit: 20,
  };
  const settings = handleIpc(result, "backup:getSettings", fallback);
  applySettings(settings);
}

async function loadBackups() {
  loadingBackups.value = true;
  try {
    const result = await window.electronAPI.listBackups();
    backups.value = handleIpc(result, "backup:list", []);
  } finally {
    loadingBackups.value = false;
  }
}

async function saveSettings() {
  savingSettings.value = true;
  try {
    const result = await window.electronAPI.updateBackupSettings({
      automaticBackupsEnabled: automaticBackupsEnabled.value,
      automaticBackupsLimit: normalizeLimit(
        automaticBackupsLimit.value,
        10,
      ),
      manualBackupsLimit: normalizeLimit(manualBackupsLimit.value, 20),
    });
    const fallback = {
      backupDirectory: backupDirectory.value,
      automaticBackupsEnabled: automaticBackupsEnabled.value,
      automaticBackupsLimit: automaticBackupsLimit.value,
      manualBackupsLimit: manualBackupsLimit.value,
    };
    applySettings(handleIpc(result, "backup:updateSettings", fallback));
  } finally {
    savingSettings.value = false;
  }
}

async function createBackupNow() {
  creatingBackup.value = true;
  try {
    const result = await window.electronAPI.createManualBackup();
    const created = handleIpc<BackupEntry | null>(
      result,
      "backup:createManual",
      null,
    );
    if (created) {
      await loadBackups();
    }
  } finally {
    creatingBackup.value = false;
  }
}

async function openBackupsFolder() {
  const result = await window.electronAPI.openBackupsFolder();
  handleIpc(result, "backup:openFolder", false);
}

async function exportArchive() {
  exportingArchive.value = true;
  try {
    const result = await window.electronAPI.exportFullArchive({
      description: archiveDescription.value,
    });
    const exported = handleIpc<FullArchiveExportResult | null>(
      result,
      "archive:exportFull",
      null,
    );
    if (exported) {
      lastArchiveExportPath.value = exported.filePath;
    }
  } finally {
    exportingArchive.value = false;
  }
}

async function openArchivePreview() {
  previewingArchive.value = true;
  try {
    const result = await window.electronAPI.previewFullArchiveRestore();
    const preview = handleIpc<FullArchivePreview | null>(
      result,
      "archive:previewRestore",
      null,
    );
    if (preview) {
      archivePreview.value = preview;
      archivePreviewVisible.value = true;
    }
  } finally {
    previewingArchive.value = false;
  }
}

async function restoreArchive() {
  if (!archivePreview.value) {
    return;
  }

  restoringArchive.value = true;
  try {
    const result = await window.electronAPI.restoreFullArchive(
      archivePreview.value.filePath,
    );
    const report = handleIpc<FullArchiveRestoreReport | null>(
      result,
      "archive:restore",
      null,
    );
    if (!report) {
      return;
    }

    archivePreviewVisible.value = false;
    archivePreview.value = null;
    archiveReport.value = report;
    archiveReportVisible.value = true;
    navigateToDashboardAfterArchiveReport.value = true;
    await store.loadCollections();
  } finally {
    restoringArchive.value = false;
  }
}

function handleArchiveReportHide() {
  if (!navigateToDashboardAfterArchiveReport.value) {
    return;
  }

  navigateToDashboardAfterArchiveReport.value = false;
  store.showDashboard();
}

async function restoreBackup(fileName: string) {
  restoringFileName.value = fileName;
  try {
    const result = await window.electronAPI.restoreBackup(fileName);
    handleIpc(result, "backup:restore", false);
  } finally {
    restoringFileName.value = null;
  }
}

async function deleteBackup(fileName: string) {
  deletingFileName.value = fileName;
  try {
    const result = await window.electronAPI.deleteBackup(fileName);
    const deleted = handleIpc(result, "backup:delete", false);
    if (deleted) {
      backups.value = backups.value.filter((backup) => backup.fileName !== fileName);
    }
  } finally {
    deletingFileName.value = null;
  }
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
      void restoreBackup(backup.fileName);
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
      void deleteBackup(backup.fileName);
    },
  });
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

onMounted(async () => {
  await Promise.all([loadSettings(), loadBackups()]);
});
</script>
