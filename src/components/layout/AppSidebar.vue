<template>
  <aside class="flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
    <div class="border-b border-[var(--border-color)] p-5">
      <div class="flex items-center gap-3">
        <i class="pi pi-lightbulb text-xl text-[var(--accent-primary)]"></i>
        <div>
          <h1 class="text-base font-semibold text-[var(--text-primary)]">Second Brain</h1>
          <p class="text-xs text-[var(--text-muted)]">Personal Organizer</p>
        </div>
      </div>
      <Button class="mt-4 w-full justify-center" icon="pi pi-plus" label="New" @click="showNewCollectionModal = true" />
    </div>

    <nav class="flex-1 space-y-2 overflow-y-auto px-2 py-3">
      <Button text class="w-full justify-start gap-3 rounded-md px-3 py-2 text-sm" :class="currentView === 'dashboard'
        ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
        @click="showDashboard">
        <template #icon>
          <i class="pi pi-chart-bar text-sm"></i>
        </template>
        <span>Dashboard</span>
      </Button>

      <div class="h-px bg-[var(--border-color)]/70"></div>
      <div class="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Collections
      </div>

      <div v-for="collection in collections" :key="collection.id" class="space-y-1">
        <Button text class="w-full justify-start rounded-md px-3 py-2 text-sm" :class="selectedCollection?.id === collection.id
          ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
          @click="handleCollectionClick(collection)">
          <div class="flex w-full items-center gap-2">
            <span class="flex items-center" @click.stop="toggleExpanded(collection.id)">
              <i class="pi text-xs"
                :class="isExpanded(collection.id) ? 'pi-angle-down' : 'pi-angle-right'"></i>
            </span>
            <i class="pi pi-folder text-sm"></i>
            <span class="min-w-0 flex-1 truncate">{{ collection.name }}</span>
          </div>
        </Button>

        <div v-if="isExpanded(collection.id)" class="ml-4 space-y-1">
          <Button text class="w-full justify-start rounded-md px-3 py-1.5 text-[13px]" :class="isActiveView(collection.id, 'grid')
            ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
            @click="handleViewClick(collection, 'grid')">
            <div class="flex w-full items-center gap-2">
              <i class="pi pi-table text-[12px]"></i>
              <span class="flex-1 truncate">Grid</span>
              <i class="pi pi-lock text-[11px] text-[var(--text-muted)]"></i>
            </div>
          </Button>

          <Button text
            class="w-full justify-start rounded-md px-3 py-1.5 text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            @click="handleAddViewClick">
            <div class="flex w-full items-center gap-2">
              <i class="pi pi-plus text-[12px]"></i>
              <span class="truncate">Add view</span>
            </div>
          </Button>
        </div>
      </div>

      <Button outlined
        class="w-full justify-start gap-3 rounded-md border-dashed px-3 py-2 text-sm text-[var(--text-muted)] border-[var(--border-color)]"
        @click="showNewCollectionModal = true">
        <template #icon>
          <i class="pi pi-plus text-sm"></i>
        </template>
        <span>New Collection</span>
      </Button>
    </nav>

    <div class="border-t border-[var(--border-color)] p-4">
      <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <div class="flex items-center gap-2">
          <i class="pi pi-cog text-[11px]"></i>
          <span>Settings</span>
        </div>
        <span>v{{ appVersion }}</span>
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

      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--text-secondary)]">Icon</label>
        <Listbox v-model="newCollection.icon" :options="iconOptions" optionLabel="label" optionValue="value"
          :pt="iconListboxPt">
          <template #option="{ option }">
            <div class="flex flex-col items-center gap-1">
              <component :is="option.component" :size="20" />
            </div>
          </template>
        </Listbox>
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
import Listbox from "primevue/listbox";
import { useIcons } from "../../composables/useIcons";
import { collectionNameSchema, iconSchema } from "../../validation/schemas";
import type { Collection } from "../../types/models";

type CollectionViewId = "grid";
type ActiveView = { collectionId: number; viewId: CollectionViewId };

const { iconOptions } = useIcons();
const store = useStore();
const { collections, selectedCollection, currentView } = storeToRefs(store);
const notifications = useNotificationsStore();

const appVersion = __APP_VERSION__;

const showNewCollectionModal = ref(false);
const newCollection = ref({
  name: "",
  icon: "folder",
});
const expandedCollectionIds = ref<number[]>([]);
const activeView = ref<ActiveView | null>(null);

const iconListboxPt = {
  root: {
    class:
      "rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)]",
  },
  list: {
    class: "grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] justify-items-center gap-1 p-2",
  },
  item: ({ context }: { context: { selected: boolean } }) => ({
    class: [
      "flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition",
      context.selected
        ? "border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]"
        : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]",
    ].join(" "),
  }),
};

function isExpanded(id: number) {
  return expandedCollectionIds.value.includes(id);
}

function toggleExpanded(id: number) {
  if (expandedCollectionIds.value.includes(id)) {
    expandedCollectionIds.value = expandedCollectionIds.value.filter(
      (entry) => entry !== id,
    );
    return;
  }
  expandedCollectionIds.value = [...expandedCollectionIds.value, id];
}

function ensureExpanded(id: number) {
  if (!expandedCollectionIds.value.includes(id)) {
    expandedCollectionIds.value = [...expandedCollectionIds.value, id];
  }
}

function handleCollectionClick(collection: Collection) {
  toggleExpanded(collection.id);
  store.selectCollection(collection);
}

function handleViewClick(collection: Collection, viewId: CollectionViewId) {
  store.selectCollection(collection);
  ensureExpanded(collection.id);
  activeView.value = { collectionId: collection.id, viewId };
}

function isActiveView(collectionId: number, viewId: CollectionViewId) {
  return (
    activeView.value?.collectionId === collectionId &&
    activeView.value?.viewId === viewId
  );
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
  const iconResult = iconSchema.safeParse(newCollection.value.icon);

  if (!nameResult.success || !iconResult.success) {
    let detail = "Please check your collection settings.";
    if (!nameResult.success) {
      detail = nameResult.error.issues[0]?.message || detail;
    } else if (!iconResult.success) {
      detail = iconResult.error.issues[0]?.message || detail;
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
    name: nameResult.data,
    icon: iconResult.data,
  });

  showNewCollectionModal.value = false;
  newCollection.value = { name: "", icon: "folder" };

  if (created) {
    store.selectCollection(created);
  }
}

function cancelNewCollection() {
  showNewCollectionModal.value = false;
  newCollection.value = { name: "", icon: "folder" };
}

watch(
  selectedCollection,
  (collection) => {
    if (collection) {
      ensureExpanded(collection.id);
      activeView.value = { collectionId: collection.id, viewId: "grid" };
    } else {
      activeView.value = null;
    }
  },
  { immediate: true },
);

onMounted(() => {
  store.loadCollections();
});
</script>
