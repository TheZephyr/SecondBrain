<template>
  <div class="mx-auto max-w-6xl px-10 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-semibold text-(--text-primary)">Dashboard</h1>
      <p class="mt-2 text-base text-(--text-muted)">
        Welcome to your Second Brain
      </p>
    </div>

    <div
      v-if="collections.length === 0"
      class="flex flex-col items-center rounded-xl border border-(--border-color) bg-(--bg-secondary) px-10 py-20 text-center"
    >
      <FolderOpen
        :size="64"
        :stroke-width="1.5"
        class="mb-6 text-(--text-muted)"
      />
      <h2 class="text-xl font-semibold text-(--text-secondary)">
        No Collections Yet
      </h2>
      <p class="mt-2 text-base text-(--text-muted)">
        Get started by creating your first collection
      </p>
      <p class="mt-1 text-base italic text-(--text-muted)">
        Click "New Collection" in the sidebar to begin
      </p>
    </div>

    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <AppCard
        v-for="collection in collectionsWithStats"
        :key="collection.id"
        class="cursor-pointer border border-(--border-color) bg-(--bg-secondary) transition hover:-translate-y-0.5 hover:border-(--accent-primary) hover:shadow-[0_10px_24px_var(--accent-light)]"
        @click="$emit('select-collection', collection)"
      >
        <div class="flex items-center gap-4">
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-base font-semibold text-(--text-primary)">
              {{ collection.name }}
            </h3>
            <div
              class="mt-2 flex items-center gap-2 text-base text-(--text-muted)"
            >
              <Database :size="14" />
              <span>{{ collection.itemCount }} items</span>
            </div>
          </div>
          <ChevronRight :size="20" class="text-(--text-muted)" />
        </div>
      </AppCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { ChevronRight, Database, FolderOpen } from "lucide-vue-next";
import AppCard from "@/components/app/ui/AppCard.vue";
import { useCollectionsStore } from "../../stores/collections";

const collectionsStore = useCollectionsStore();
const { collections, collectionItemCounts } = storeToRefs(collectionsStore);

defineEmits(["select-collection"]);

const collectionsWithStats = computed(() =>
  collections.value.map((collection) => ({
    ...collection,
    itemCount: collectionItemCounts.value.get(collection.id) || 0,
  })),
);

onMounted(() => {
  void collectionsStore.loadCollectionItemCounts();
});
</script>
