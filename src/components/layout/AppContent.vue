<template>
  <main class="flex-1 overflow-auto bg-[var(--bg-primary)]">
    <div class="min-h-full">
      <Dashboard
        v-if="currentView === 'dashboard' || !selectedCollection"
        :collections="collections"
        @select-collection="handleSelectCollection"
      />
      <Collection
        v-else
        :collection="selectedCollection"
        @collection-deleted="handleCollectionDeleted"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useStore } from "../../store";
import Dashboard from "../views/Dashboard.vue";
import Collection from "../views/Collection.vue";

const store = useStore();
const { collections, selectedCollection, currentView } = storeToRefs(store);

function handleSelectCollection(collection: any) {
  store.selectCollection(collection);
}

function handleCollectionDeleted() {
  store.showDashboard();
}
</script>
