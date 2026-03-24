<template>
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

    <ArchivePreviewDialog
      v-model:visible="archivePreviewVisible"
      :preview="archivePreview"
      :restoring="restoringArchive"
      @confirm="restoreArchive"
    />

    <ArchiveRestoreReportDialog
      v-model:visible="archiveReportVisible"
      :report="archiveReport"
      @hide="handleArchiveReportHide"
    />
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import { useStore } from "../../store";
import { handleIpc } from "../../utils/ipc";
import type {
  FullArchiveExportResult,
  FullArchivePreview,
  FullArchiveRestoreReport,
} from "../../types/models";
import ArchivePreviewDialog from "./ArchivePreviewDialog.vue";
import ArchiveRestoreReportDialog from "./ArchiveRestoreReportDialog.vue";

const store = useStore();

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
</script>
