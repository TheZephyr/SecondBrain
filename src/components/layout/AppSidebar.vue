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
            <div v-for="view in currentViews" :key="view.id" class="relative">
              <Button text class="group w-full justify-start rounded-md px-3 py-2 text-sm" :class="isActiveView(view.id)
                ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
                @click="handleViewClick(view.id)">
                <div class="flex w-full items-center gap-2">
                  <i class="pi text-xs"
                    :class="[getViewTypeMeta(view.type).icon, getViewTypeMeta(view.type).iconClass]"></i>
                  <span class="flex-1 truncate">{{ view.name }}</span>
                  <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      class="flex size-5 items-center justify-center rounded text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
                      title="Rename view" @mousedown.stop @click.stop="openEditViewModal(view)">
                      <i class="pi pi-pencil text-xs"></i>
                    </span>
                    <span
                      class="flex size-5 items-center justify-center rounded text-[#f87171] hover:bg-[var(--bg-hover)]"
                      title="Delete view" @mousedown.stop @click.stop="toggleDeleteConfirm(view.id)">
                      <i class="pi pi-trash text-xs"></i>
                    </span>
                  </div>
                </div>
              </Button>

              <div v-if="confirmDeleteViewId === view.id" :ref="setDeleteConfirmContainer"
                class="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)] shadow-lg"
                @mousedown.stop>
                <div>Are you sure?</div>
                <div class="mt-2 flex items-center justify-end gap-2">
                  <button type="button"
                    class="rounded px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    @click.stop="closeDeleteConfirm">
                    Cancel
                  </button>
                  <button type="button" class="rounded bg-[var(--accent-primary)] px-2 py-1 text-white hover:opacity-90"
                    @click.stop="confirmDeleteView(view)">
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div :ref="setViewPickerContainer" class="relative">
              <Button text
                class="w-full justify-start rounded-md px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                :aria-expanded="isViewPickerOpen" aria-controls="view-type-picker"
                @click="event => toggleViewPicker(event, collection.id)">
                <div class="flex w-full items-center gap-2">
                  <i class="pi pi-plus text-xs"></i>
                  <span class="truncate">Add view</span>
                </div>
              </Button>

              <ViewTypePicker id="view-type-picker" :open="isViewPickerOpen" :placement="viewPickerPlacement"
                :viewTypes="viewTypeOptions" @select="type => handleViewTypeSelect(collection.id, type)"
                @close="closeViewPicker" />
            </div>
          </template>
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

  <Dialog v-model:visible="showViewModal" :header="viewModalHeader" modal :draggable="false" class="max-w-xl"
    @hide="closeViewModal">
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs font-medium text-[var(--text-secondary)]">View Name</label>
        <InputText v-model="viewModalName" type="text" autofocus />
      </div>
    </div>

    <template #footer>
      <Button severity="secondary" text @click="closeViewModal">Cancel</Button>
      <Button @click="saveViewModal">
        {{ viewModalMode === 'edit' ? 'Save' : 'Create View' }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from "vue";
import type { ComponentPublicInstance } from "vue";
import { storeToRefs } from "pinia";
import { useStore } from "../../store";
import { useNotificationsStore } from "../../stores/notifications";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import { collectionNameSchema, viewNameSchema } from "../../validation/schemas";
import type { Collection, View, ViewType } from "../../types/models";
import { Brain } from "lucide-vue-next";
import ViewTypePicker from "./ViewTypePicker.vue";

const store = useStore();
const { collections, selectedCollection, currentView, currentViews, activeViewId } =
  storeToRefs(store);
const notifications = useNotificationsStore();

const appVersion = __APP_VERSION__;

const showNewCollectionModal = ref(false);
const newCollection = ref({ name: "" });
const expandedCollectionIds = ref<number[]>([]);
const viewPickerOpenFor = ref<number | null>(null);
const viewPickerPlacement = ref<"top" | "bottom">("bottom");
const viewPickerContainer = ref<HTMLElement | null>(null);
const viewPickerTrigger = ref<HTMLElement | null>(null);
const confirmDeleteViewId = ref<number | null>(null);
const deleteConfirmContainer = ref<HTMLElement | null>(null);
const showViewModal = ref(false);
const viewModalMode = ref<"create" | "edit">("create");
const viewModalType = ref<ViewType>("grid");
const viewModalName = ref("");
const viewModalCollectionId = ref<number | null>(null);
const viewModalViewId = ref<number | null>(null);

const viewTypeOptions: Array<{
  type: ViewType;
  label: string;
  icon: string;
  iconClass: string;
}> = [
    {
      type: "grid",
      label: "Grid",
      icon: "pi-table",
      iconClass: "text-[var(--accent-primary)]",
    },
    {
      type: "kanban",
      label: "Kanban",
      icon: "pi-bars",
      iconClass: "text-[#c084fc]",
    },
    {
      type: "calendar",
      label: "Calendar",
      icon: "pi-calendar",
      iconClass: "text-[#a78bfa]",
    },
  ];

const isViewPickerOpen = computed(
  () => viewPickerOpenFor.value !== null && viewPickerOpenFor.value === selectedCollection.value?.id,
);

const viewModalHeader = computed(() => {
  const label = getViewTypeMeta(viewModalType.value).label;
  return viewModalMode.value === "edit"
    ? `Rename ${label} view`
    : `Create new ${label} view`;
});

function isExpanded(id: number) {
  return expandedCollectionIds.value.includes(id);
}

function toggleExpanded(id: number) {
  if (expandedCollectionIds.value.includes(id)) {
    expandedCollectionIds.value = [];
    closeViewPicker();
    closeDeleteConfirm();
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
  closeDeleteConfirm();
  store.setActiveViewId(viewId);
}

function isActiveView(viewId: number) {
  return activeViewId.value === viewId;
}

function getViewTypeMeta(type: ViewType) {
  return viewTypeOptions.find((option) => option.type === type) ?? viewTypeOptions[0];
}

function toggleViewPicker(event: MouseEvent, collectionId: number) {
  closeDeleteConfirm();
  if (viewPickerOpenFor.value === collectionId) {
    closeViewPicker();
    return;
  }
  viewPickerOpenFor.value = collectionId;
  viewPickerTrigger.value = event.currentTarget as HTMLElement | null;
  nextTick(() => updateViewPickerPlacement());
}

function setViewPickerContainer(
  element: Element | ComponentPublicInstance | null,
) {
  viewPickerContainer.value = element instanceof HTMLElement ? element : null;
}

function closeViewPicker() {
  viewPickerOpenFor.value = null;
}

function updateViewPickerPlacement() {
  const trigger = viewPickerTrigger.value;
  if (!trigger) {
    viewPickerPlacement.value = "bottom";
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const estimatedHeight = viewTypeOptions.length * 40 + 16;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  viewPickerPlacement.value =
    spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? "top" : "bottom";
}

function buildViewName(type: ViewType) {
  const baseName = getViewTypeMeta(type).label;
  const existingNames = currentViews.value.map((view) => view.name.trim());
  if (!existingNames.includes(baseName)) {
    return baseName;
  }
  let suffix = 2;
  while (existingNames.includes(`${baseName} ${suffix}`)) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

async function handleViewTypeSelect(collectionId: number, type: ViewType) {
  openCreateViewModal(collectionId, type);
  closeViewPicker();
}

function openCreateViewModal(collectionId: number, type: ViewType) {
  viewModalMode.value = "create";
  viewModalType.value = type;
  viewModalCollectionId.value = collectionId;
  viewModalViewId.value = null;
  viewModalName.value = buildViewName(type);
  closeDeleteConfirm();
  showViewModal.value = true;
}

function openEditViewModal(view: View) {
  viewModalMode.value = "edit";
  viewModalType.value = view.type;
  viewModalCollectionId.value = view.collection_id;
  viewModalViewId.value = view.id;
  viewModalName.value = view.name;
  closeDeleteConfirm();
  showViewModal.value = true;
}

function closeViewModal() {
  showViewModal.value = false;
  viewModalName.value = "";
  viewModalViewId.value = null;
  viewModalCollectionId.value = null;
}

async function saveViewModal() {
  const nameResult = viewNameSchema.safeParse(viewModalName.value);
  if (!nameResult.success) {
    notifications.push({
      severity: "warn",
      summary: "Invalid view name",
      detail: nameResult.error.issues[0]?.message || "Please enter a valid view name.",
      life: 5000,
    });
    return;
  }

  if (viewModalMode.value === "edit") {
    if (!viewModalViewId.value) return;
    await store.updateView({
      id: viewModalViewId.value,
      name: nameResult.data,
    });
  } else {
    if (!viewModalCollectionId.value) return;
    await store.addView({
      collectionId: viewModalCollectionId.value,
      name: nameResult.data,
      type: viewModalType.value,
      isDefault: 0,
    });
  }

  closeViewModal();
}

function toggleDeleteConfirm(viewId: number) {
  confirmDeleteViewId.value =
    confirmDeleteViewId.value === viewId ? null : viewId;
}

function setDeleteConfirmContainer(
  element: Element | ComponentPublicInstance | null,
) {
  deleteConfirmContainer.value = element instanceof HTMLElement ? element : null;
}

function closeDeleteConfirm() {
  confirmDeleteViewId.value = null;
}

async function confirmDeleteView(view: View) {
  await store.deleteView(view.id);
  closeDeleteConfirm();
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
    closeViewModal();
    if (collection) {
      ensureExpanded(collection.id);
      closeViewPicker();
      closeDeleteConfirm();
      return;
    }
    expandedCollectionIds.value = [];
    closeViewPicker();
    closeDeleteConfirm();
  },
  { immediate: true },
);

function handleDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node | null;
  if (
    confirmDeleteViewId.value !== null &&
    (!deleteConfirmContainer.value ||
      (target && !deleteConfirmContainer.value.contains(target)))
  ) {
    closeDeleteConfirm();
  }

  if (
    isViewPickerOpen.value &&
    (!viewPickerContainer.value ||
      (target && !viewPickerContainer.value.contains(target)))
  ) {
    closeViewPicker();
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeDeleteConfirm();
  closeViewPicker();
  viewPickerTrigger.value?.focus?.();
}

function handleWindowResize() {
  if (!isViewPickerOpen.value) return;
  updateViewPickerPlacement();
}

onMounted(() => {
  document.addEventListener("mousedown", handleDocumentMouseDown);
  document.addEventListener("keydown", handleDocumentKeydown);
  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleDocumentMouseDown);
  document.removeEventListener("keydown", handleDocumentKeydown);
  window.removeEventListener("resize", handleWindowResize);
});
</script>
