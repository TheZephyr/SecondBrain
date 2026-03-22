<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ContentNavbar v-if="selectedCollection" />
    <main class="min-h-0 flex-1 bg-[var(--bg-primary)]"
      :class="selectedCollection ? 'overflow-hidden' : 'overflow-auto'">
      <div v-if="currentView === 'dashboard'" class="min-h-full">
        <Dashboard :collections="collections" @select-collection="handleSelectCollection" />
      </div>
      <div v-else-if="currentView === 'settings'" class="min-h-full">
        <Settings />
      </div>
      <div v-else-if="selectedCollection" class="h-full min-h-0">
        <Collection :collection="selectedCollection" @collection-deleted="handleCollectionDeleted" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useStore } from "../../store";
import Dashboard from "../views/Dashboard.vue";
import Settings from "../views/Settings.vue";
import Collection from "../views/Collection.vue";
import ContentNavbar from "./ContentNavbar.vue";
import type { Collection as CollectionType } from "../../types/models";

const store = useStore();
const { collections, selectedCollection, currentView } = storeToRefs(store);

function handleSelectCollection(collection: CollectionType) {
  store.selectCollection(collection);
}

function handleCollectionDeleted() {
  store.showDashboard();
}
</script>
