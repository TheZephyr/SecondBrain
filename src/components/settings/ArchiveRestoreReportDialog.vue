<template>
  <AppDialog
    :visible="visible"
    header="Archive Restore Report"
    class="w-full max-w-3xl"
    @update:visible="$emit('update:visible', $event)"
    @hide="$emit('hide')"
  >
    <div v-if="report" class="space-y-4">
      <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
        <div class="text-sm font-medium text-[var(--text-primary)]">Pre-restore backup</div>
        <div class="mt-1 break-all font-mono text-sm text-[var(--text-secondary)]">
          {{ report.preRestoreBackupPath }}
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
          <div class="text-sm font-medium text-[var(--text-primary)]">
            Restored Collections ({{ report.restoredCollections.length }})
          </div>
          <div class="mt-3 space-y-2">
            <div
              v-for="name in report.restoredCollections"
              :key="name"
              class="rounded-md border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)]"
            >
              {{ name }}
            </div>
            <div v-if="report.restoredCollections.length === 0" class="text-sm text-[var(--text-muted)]">
              No collections were restored.
            </div>
          </div>
        </div>
        <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
          <div class="text-sm font-medium text-[var(--text-primary)]">
            Failed Collections ({{ report.failedCollections.length }})
          </div>
          <div class="mt-3 space-y-2">
            <div
              v-for="failure in report.failedCollections"
              :key="`${failure.collectionName}-${failure.message}`"
              class="rounded-md border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] px-3 py-2 text-sm text-[var(--text-secondary)]"
            >
              <div class="font-medium text-[var(--text-primary)]">{{ failure.collectionName }}</div>
              <div class="mt-1 text-[var(--text-muted)]">{{ failure.message }}</div>
            </div>
            <div v-if="report.failedCollections.length === 0" class="text-sm text-[var(--text-muted)]">
              No collection-level restore failures.
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
        <div class="text-sm font-medium text-[var(--text-primary)]">
          Dropped View References ({{ report.droppedViewReferences.length }})
        </div>
        <div v-if="report.droppedViewReferences.length > 0" class="mt-3 space-y-2">
          <div
            v-for="warning in report.droppedViewReferences"
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
            Skipped Entities ({{ report.skippedEntities.length }})
          </div>
          <div v-if="report.skippedEntities.length > 0" class="mt-3 space-y-2">
            <div
              v-for="warning in report.skippedEntities"
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
            Stat Mismatches ({{ report.statMismatches.length }})
          </div>
          <div v-if="report.statMismatches.length > 0" class="mt-3 space-y-2">
            <div
              v-for="mismatch in report.statMismatches"
              :key="`${mismatch.scope}-${mismatch.collectionName ?? 'total'}-${mismatch.stat}`"
              class="rounded-md border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)]"
            >
              <div class="font-medium text-[var(--text-primary)]">
                {{ mismatch.scope === "collection" ? mismatch.collectionName : "Total database" }}
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
      <AppButton @click="$emit('update:visible', false)">Close</AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import AppButton from "@/components/app/ui/AppButton.vue";
import AppDialog from "@/components/app/ui/AppDialog.vue";
import type { FullArchiveRestoreReport } from "../../types/models";

defineProps<{
  visible: boolean;
  report: FullArchiveRestoreReport | null;
}>();

defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "hide"): void;
}>();
</script>
