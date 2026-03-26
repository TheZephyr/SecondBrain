<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    header="Restore Full Archive"
    class="w-full max-w-3xl"
    @update:visible="$emit('update:visible', $event)"
  >
    <div v-if="preview" class="space-y-4">
      <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
        <div class="text-sm font-medium text-[var(--text-secondary)]">Archive file</div>
        <div class="mt-1 break-all font-mono text-sm text-[var(--text-primary)]">
          {{ preview.filePath }}
        </div>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <div class="rounded-md border border-[var(--border-color)] p-3">
            <div class="text-xs uppercase tracking-wide text-[var(--text-muted)]">Archive</div>
            <div class="mt-2 text-sm text-[var(--text-secondary)]">
              <div>{{ preview.archiveSummary.stats.collectionCount }} collections</div>
              <div>{{ preview.archiveSummary.stats.totalFieldCount }} fields</div>
              <div>{{ preview.archiveSummary.stats.totalItemCount }} items</div>
            </div>
          </div>
          <div class="rounded-md border border-[var(--border-color)] p-3">
            <div class="text-xs uppercase tracking-wide text-[var(--text-muted)]">Current Database</div>
            <div class="mt-2 text-sm text-[var(--text-secondary)]">
              <div>{{ preview.currentDbSummary.collectionCount }} collections</div>
              <div>{{ preview.currentDbSummary.totalFieldCount }} fields</div>
              <div>{{ preview.currentDbSummary.totalItemCount }} items</div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="rounded-lg border p-4 text-sm"
        :class="preview.willReplaceExistingData
          ? 'border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--text-secondary)]'
          : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'"
      >
        <div class="font-medium text-[var(--text-primary)]">
          {{ preview.willReplaceExistingData ? 'Existing data will be replaced.' : 'Current database is empty.' }}
        </div>
        <div class="mt-1">
          A <span class="font-medium">pre_restore</span> backup will be created automatically before the restore begins.
        </div>
      </div>

      <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
        <div class="text-sm font-medium text-[var(--text-primary)]">Collections in archive</div>
        <div class="mt-3 max-h-64 space-y-2 overflow-y-auto">
          <div
            v-for="collection in preview.archiveSummary.collections"
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
        :disabled="restoring"
        @click="$emit('update:visible', false)"
      >
        Cancel
      </Button>
      <Button
        severity="danger"
        :loading="restoring"
        @click="$emit('confirm')"
      >
        Restore Full Archive
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import type { FullArchivePreview } from "../../types/models";

defineProps<{
  visible: boolean;
  preview: FullArchivePreview | null;
  restoring: boolean;
}>();

defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "confirm"): void;
}>();
</script>
