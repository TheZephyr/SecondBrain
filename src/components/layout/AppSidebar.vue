<template>
  <aside class="flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
    <div class="border-b border-[var(--border-color)] p-4">
      <div class="flex items-center gap-3">
        <Brain class="text-[var(--accent-primary)] size-9" />
        <div>
          <h1 class="text-base font-semibold text-[var(--text-primary)]">Second Brain</h1>
          <p class="text-xs text-[var(--text-muted)]">v {{ appVersion }}</p>
        </div>
      </div>
    </div>

    <nav class="flex-1 space-y-2 overflow-y-auto px-2 py-3">
      <Button text class="w-full justify-start gap-3 rounded-md px-3 py-2 text-sm" :class="currentView === 'dashboard'
        ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
        @click="showDashboard">
        <i class="pi pi-chart-bar text-sm"></i>
        <span>Dashboard</span>
      </Button>

      <div class="h-px bg-[var(--border-color)]/70"></div>
      <div class="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Collections
      </div>

      <div v-for="collection in collections" :key="collection.id" class="space-y-1">
        <Button text
          class="w-full justify-start rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          @click="handleCollectionClick(collection)">
          <div class="flex items-center gap-2">
            <span class="flex items-center" @click.stop="toggleExpanded(collection.id)">
              <i class="pi text-xs" :class="isExpanded(collection.id) ? 'pi-angle-down' : 'pi-angle-right'"></i>
            </span>
            <span class="min-w-0 flex-1 truncate">{{ collection.name }}</span>
          </div>
        </Button>

        <div v-if="isExpanded(collection.id)" class="ml-4 space-y-1">
          <template v-if="selectedCollection?.id === collection.id">
            <Button v-for="view in currentViews" :key="view.id" text
              class="w-full justify-start rounded-md px-3 py-2 text-sm" :class="isActiveView(view.id)
                ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
              @click="handleViewClick(view.id)">
              <div class="flex items-center gap-2">
                <i class="pi pi-table text-xs"></i>
                <span class="flex-1 truncate">{{ view.name }}</span>
                <i v-if="view.is_default === 1" class="pi pi-lock text-xs text-[var(--text-muted)]"></i>
              </div>
            </Button>
          </template>

          <Button text
            class="w-full justify-start rounded-md px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            @click="handleAddViewClick">
            <div class="flex w-full items-center gap-2">
              <i class="pi pi-plus text-xs"></i>
              <span class="truncate">Add view</span>
            </div>
          </Button>
        </div>
      </div>

      <Button outlined
        class="w-full justify-start gap-3 rounded-md border-dashed px-3 py-2 text-sm text-[var(--text-muted)] border-[var(--border-color)]"
        @click="showNewCollectionModal = true">
        <i class="pi pi-plus text-sm"></i>
        <span>New Collection</span>
      </Button>
    </nav>

    <div class="border-t border-[var(--border-color)] p-4">
      <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div class="flex items-center gap-2">
          <i class="pi pi-cog text-xs"></i>
          <span>Settings</span>
        </div>
      </div>
    </div>
  </aside>

  <Dialog v-model:visible="showNewCollectionModal" header="Create New Collection" modal :draggable="false"
    class="max-w-xl" @hide="cancelNewCollection">
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--text-secondary)]">Collection Name </label>
        <InputText v-model="newCollection.name" type="text" autofocus />
      </div>
    </div>

    <template #footer>
      <Button severity="secondary" text @click="cancelNewCollection">Cancel</Button>
      <Button @click="createCollection">Create Collection</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useStore } from "../../store";
import { useNotificationsStore } from "../../stores/notifications";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import { collectionNameSchema } from "../../validation/schemas";
import type { Collection } from "../../types/models";
import { Brain } from "lucide-vue-next";

const store = useStore();
const { collections, selectedCollection, currentView, currentViews, activeViewId } =
  storeToRefs(store);
const notifications = useNotificationsStore();

const appVersion = __APP_VERSION__;

const showNewCollectionModal = ref(false);
const newCollection = ref({
  name: "",
});
const expandedCollectionIds = ref<number[]>([]);

function isExpanded(id: number) {
  return expandedCollectionIds.value.includes(id);
}

function toggleExpanded(id: number) {
  if (expandedCollectionIds.value.includes(id)) {
    expandedCollectionIds.value = [];
    return;
  }
  expandedCollectionIds.value = [id];
}

function ensureExpanded(id: number) {
  expandedCollectionIds.value = [id];
}

function handleCollectionClick(collection: Collection) {
  ensureExpanded(collection.id);
  store.selectCollection(collection);
}

function handleViewClick(viewId: number) {
  store.setActiveViewId(viewId);
}

function isActiveView(viewId: number) {
  return activeViewId.value === viewId;
}

function handleAddViewClick() {
  notifications.push({
    severity: "info",
    summary: "Coming soon",
    detail: "View management is not available yet.",
    life: 3000,
  });
}

function showDashboard() {
  store.showDashboard();
}

async function createCollection() {
  const nameResult = collectionNameSchema.safeParse(newCollection.value.name);

  if (!nameResult.success) {
    let detail = "Please check your collection settings.";
    if (!nameResult.success) {
      detail = nameResult.error.issues[0]?.message || detail;
    }

    notifications.push({
      severity: "warn",
      summary: "Invalid collection",
      detail,
      life: 5000,
    });
    return;
  }

  const created = await store.addCollection({
    name: nameResult.data
  });

  showNewCollectionModal.value = false;
  newCollection.value = { name: "" };

  if (created) {
    store.selectCollection(created);
  }
}

function cancelNewCollection() {
  showNewCollectionModal.value = false;
  newCollection.value = { name: "" };
}

onMounted(() => {
  store.loadCollections();
});

watch(
  selectedCollection,
  (collection) => {
    if (collection) {
      ensureExpanded(collection.id);
      return;
    }
    expandedCollectionIds.value = [];
  },
  { immediate: true },
);
</script>
