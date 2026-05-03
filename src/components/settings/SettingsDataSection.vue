<template>
  <section
    id="data"
    class="rounded-xl border border-(--border-color) bg-(--bg-secondary) p-6"
  >
    <div class="mb-3 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-(--text-primary)">Data</h2>
      </div>
      <AppBadge severity="info">Import & Export</AppBadge>
    </div>
    <div class="rounded-lg">
      <div class="grid gap-4 lg:grid-cols-2">
        <AppCard title="Full Archive Export">
          <div class="space-y-4">
            <p class="text-sm text-(--text-secondary)">
              Export the entire database to a single JSON archive for
              cross-machine migration or long-term storage.
            </p>
            <div class="space-y-2">
              <label
                for="archiveDescription"
                class="text-sm text-(--text-secondary)"
                >Description</label
              >
              <AppTextarea
                id="archiveDescription"
                v-model="archiveDescription"
                :rows="4"
                class="w-full"
                autoResize
                placeholder="Optional notes about this archive"
              />
            </div>
            <AppButton
              label="Export Full Archive"
              :loading="exportingArchive"
              @click="exportArchive"
            />
            <div
              v-if="lastArchiveExportPath"
              class="text-xs text-(--text-muted)"
            >
              Last export:
              <span class="font-mono">{{ lastArchiveExportPath }}</span>
            </div>
          </div>
        </AppCard>

        <AppCard title="Full Archive Restore">
          <div class="space-y-4">
            <p class="text-sm text-(--text-secondary)">
              Restore a full archive into the current database. Existing data
              will be replaced after a mandatory pre-restore backup is created.
            </p>
            <AppButton
              label="Select Archive File"
              severity="danger"
              outlined
              :loading="previewingArchive"
              @click="openArchivePreview"
            />
          </div>
        </AppCard>
      </div>
    </div>

    <div class="mt-6 rounded-lg border border-(--border-color) p-4">
      <div class="text-sm font-medium text-(--text-primary)">
        Collection Import/Export
      </div>
      <p class="mt-2 text-sm text-(--text-secondary)">
        Collection-level CSV/JSON import and export stays in Collection Settings
        for per-collection workflows.
      </p>
      <div class="mt-4">
        <AppButton
          label="Back to Dashboard"
          severity="secondary"
          outlined
          @click="store.showDashboard()"
        />
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
import { storeToRefs } from "pinia";
import AppBadge from "@/components/app/ui/AppBadge.vue";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppCard from "@/components/app/ui/AppCard.vue";
import AppTextarea from "@/components/app/ui/AppTextarea.vue";
import { useStore } from "../../store";
import { useSettingsStore } from "../../stores/settings";
import ArchivePreviewDialog from "./ArchivePreviewDialog.vue";
import ArchiveRestoreReportDialog from "./ArchiveRestoreReportDialog.vue";

const store = useStore();
const settingsStore = useSettingsStore();
const {
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
} = storeToRefs(settingsStore);

async function exportArchive() {
  await settingsStore.exportArchive();
}

async function openArchivePreview() {
  await settingsStore.openArchivePreview();
}

async function restoreArchive() {
  await settingsStore.restoreArchive();
}

function handleArchiveReportHide() {
  const shouldNavigate = navigateToDashboardAfterArchiveReport.value;
  settingsStore.handleArchiveReportHide();
  if (shouldNavigate) {
    store.showDashboard();
  }
}
</script>
