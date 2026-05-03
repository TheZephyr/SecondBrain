<template>
  <div
    class="grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-(--border-color) bg-(--bg-secondary) px-4"
  >
    <div
      class="flex min-w-0 items-center gap-2 text-base text-(--text-muted) justify-self-start"
    >
      <span>Collections</span>
      <span>/</span>
      <span class="min-w-0 truncate text-(--text-primary)">
        {{ selectedCollection?.name || "" }}
      </span>
      <span>/</span>
      <span class="min-w-0 truncate text-(--text-primary)">
        {{ activeViewName }}
      </span>
      <template v-if="breadcrumbTabName">
        <span>/</span>
        <span class="min-w-0 truncate text-(--text-muted)">
          {{ breadcrumbTabName }}
        </span>
      </template>
    </div>

    <div
      class="rounded-md border border-(--border-color) bg-(--bg-primary) p-1"
    >
      <AppButton
        text
        class="h-6 px-2 text-base font-semibold"
        :class="
          activeCollectionPanel === 'data'
            ? activeButtonClass
            : inactiveButtonClass
        "
        :aria-pressed="activeCollectionPanel === 'data'"
        @click="setPanel('data')"
      >
        Data
      </AppButton>
      <AppButton
        text
        class="h-6 px-2 text-base font-semibold"
        :class="
          activeCollectionPanel === 'fields'
            ? activeButtonClass
            : inactiveButtonClass
        "
        :aria-pressed="activeCollectionPanel === 'fields'"
        @click="setPanel('fields')"
      >
        Fields
      </AppButton>
    </div>

    <AppButton
      text
      class="h-8 gap-2 px-3 text-base font-semibold justify-self-end"
      :class="collectionSettingsOpen ? activeButtonClass : inactiveButtonClass"
      :aria-pressed="collectionSettingsOpen"
      @click="toggleSettings"
    >
      <template #icon>
        <Settings2 :size="14" />
      </template>
      Collection Settings
    </AppButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { Settings2 } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import { useStore } from "../../../store";

const store = useStore();
const {
  selectedCollection,
  activeCollectionPanel,
  collectionSettingsOpen,
  currentViews,
  activeViewId,
} = storeToRefs(store);

const activeButtonClass = "bg-(--accent-light) text-(--accent-primary)";
const inactiveButtonClass =
  "text-(--text-secondary) hover:text-(--text-primary)";

const activeViewName = computed(() => {
  const activeView = currentViews.value.find(
    (view) => view.id === activeViewId.value,
  );
  return activeView?.name ?? "View";
});

const breadcrumbTabName = computed(() => {
  if (!selectedCollection.value) {
    return "";
  }
  if (collectionSettingsOpen.value) {
    return "Settings";
  }
  return activeCollectionPanel.value === "fields" ? "Fields" : "Data";
});

function setPanel(panel: "data" | "fields") {
  store.setActiveCollectionPanel(panel);
  store.setCollectionSettingsOpen(false);
}

function toggleSettings() {
  store.setCollectionSettingsOpen(!collectionSettingsOpen.value);
}
</script>
