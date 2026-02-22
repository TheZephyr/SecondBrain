<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <ContentNavbar v-if="selectedCollection" />
    <main class="flex-1 overflow-auto bg-[var(--bg-primary)]">
      <div class="min-h-full">
        <Dashboard v-if="!selectedCollection" :collections="collections"
          @select-collection="handleSelectCollection" />
        <Collection v-else :collection="selectedCollection" @collection-deleted="handleCollectionDeleted" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useStore } from "../../store";
import Dashboard from "../views/Dashboard.vue";
import Collection from "../views/Collection.vue";
import ContentNavbar from "./ContentNavbar.vue";
import type { Collection as CollectionType } from "../../types/models";

const store = useStore();
const { collections, selectedCollection } = storeToRefs(store);

function handleSelectCollection(collection: CollectionType) {
  store.selectCollection(collection);
}

function handleCollectionDeleted() {
  store.showDashboard();
}
</script>
