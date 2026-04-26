<template>
  <div class="min-h-full px-6 py-8">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section
        id="general"
        class="rounded-xl border border-(--border-color) bg-(--bg-secondary) p-6"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold text-(--text-primary)">
              Settings
            </h1>
            <p class="mt-1 text-sm text-(--text-muted)">
              Global preferences and recovery tools for your local data.
            </p>
          </div>
          <AppBadge value="General" severity="secondary" />
        </div>

        <div class="mb-6 rounded-lg">
          <div class="grid gap-4 md:grid-cols-2">
            <AppCard title="App">
              <div class="space-y-2 text-sm text-(--text-secondary)">
                <div class="flex items-center justify-between gap-4">
                  <span>Name</span>
                  <span class="font-medium text-(--text-primary)"
                    >Second Brain</span
                  >
                </div>
                <div class="flex items-center justify-between gap-4">
                  <span>Version</span>
                  <span class="font-medium text-(--text-primary)"
                    >v{{ appVersion }}</span
                  >
                </div>
              </div>
            </AppCard>

            <AppCard title="Quick Links">
              <div class="flex flex-wrap gap-3">
                <AppButton
                  label="Go to Dashboard"
                  severity="secondary"
                  outlined
                  @click="store.showDashboard()"
                />
                <AppButton
                  label="Open Backups Folder"
                  text
                  @click="openBackupsFolder"
                />
              </div>
            </AppCard>
          </div>
        </div>
      </section>

      <SettingsBackupSection />
      <SettingsDataSection />

      <section
        id="about"
        class="rounded-xl border border-(--border-color) bg-(--bg-secondary) p-6"
      >
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-(--text-primary)">About</h2>
          </div>
          <AppBadge severity="secondary">Build & License</AppBadge>
        </div>
        <div class="space-y-2 text-sm text-(--text-secondary)">
          <div class="flex items-center justify-between gap-4">
            <span>Application</span>
            <span class="font-medium text-(--text-primary)"
              >Second Brain v.{{ appVersion }}</span
            >
          </div>
          <div class="flex items-center justify-between gap-4">
            <span>Author</span>
            <span class="font-medium text-(--text-primary)">Zephyr</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span>License</span>
            <span class="font-medium text-(--text-primary)">MIT License</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppBadge from "@/components/app/ui/AppBadge.vue";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppCard from "@/components/app/ui/AppCard.vue";
import { useStore } from "../../store";
import { useSettingsStore } from "../../stores/settings";
import SettingsBackupSection from "./SettingsBackupSection.vue";
import SettingsDataSection from "./SettingsDataSection.vue";

const appVersion = __APP_VERSION__;
const store = useStore();
const settingsStore = useSettingsStore();

async function openBackupsFolder() {
  await settingsStore.openBackupsFolder();
}
</script>
