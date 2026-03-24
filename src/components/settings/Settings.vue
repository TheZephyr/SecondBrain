<template>
  <div class="min-h-full px-6 py-8">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <!-- General Section -->
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

      <!-- Backup Management Section -->
      <SettingsBackupSection />

      <!-- Data Import/Export Section -->
      <SettingsDataSection />

      <!-- About Section -->
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
import Button from "primevue/button";
import Card from "primevue/card";
import Tag from "primevue/tag";
import { useStore } from "../../store";
import { handleIpc } from "../../utils/ipc";
import SettingsBackupSection from "./SettingsBackupSection.vue";
import SettingsDataSection from "./SettingsDataSection.vue";

const appVersion = __APP_VERSION__;
const store = useStore();

async function openBackupsFolder() {
  const result = await window.electronAPI.openBackupsFolder();
  handleIpc(result, "backup:openFolder", false);
}
</script>
