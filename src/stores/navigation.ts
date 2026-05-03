import { defineStore } from "pinia";
import { ref } from "vue";
import type { CollectionPanelType } from "../types/models";

export const useNavigationStore = defineStore("navigation", () => {
  const currentView = ref<"dashboard" | "collection" | "settings">(
    "dashboard",
  );
  const activeCollectionPanel = ref<CollectionPanelType>("data");
  const collectionSettingsOpen = ref(false);

  function setCurrentView(
    view: "dashboard" | "collection" | "settings",
  ): void {
    currentView.value = view;
  }

  function setActiveCollectionPanel(panel: CollectionPanelType): void {
    activeCollectionPanel.value = panel;
  }

  function setCollectionSettingsOpen(open: boolean): void {
    collectionSettingsOpen.value = open;
  }

  function resetCollectionUiState(): void {
    activeCollectionPanel.value = "data";
    collectionSettingsOpen.value = false;
  }

  return {
    currentView,
    activeCollectionPanel,
    collectionSettingsOpen,
    setCurrentView,
    setActiveCollectionPanel,
    setCollectionSettingsOpen,
    resetCollectionUiState,
  };
});

