<template>
  <aside class="flex w-64 min-w-[240px] flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
    <div class="border-b border-[var(--border-color)] p-4">
      <div class="flex items-center gap-3">
        <Brain class="size-10 pt-1 text-[var(--accent-primary)]" />
        <div>
          <h1 class="text-lg font-semibold text-[var(--text-primary)]">Second Brain</h1>
          <p class="text-xs text-[var(--text-muted)]">{{ appVersion }}</p>
        </div>
      </div>
    </div>

    <nav class="flex-1 space-y-2 overflow-y-auto px-2 py-3">
      <AppButton
        text
        class="w-full justify-start gap-3 rounded-md px-3 py-2 text-base"
        :class="currentView === 'dashboard'
          ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
        @click="showDashboard"
      >
        <template #icon>
          <LayoutDashboard class="size-4" />
        </template>
        <span>Dashboard</span>
      </AppButton>

      <div class="h-px bg-[var(--border-color)]" />
      <div class="px-3 pt-2 text-base font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Collections
      </div>

      <div v-for="collection in collections" :key="collection.id" class="space-y-1">
        <AppButton
          text
          class="w-full justify-start rounded-md px-3 py-2 text-base text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          @click="handleCollectionClick(collection)"
        >
          <div class="flex items-center gap-2">
            <span class="flex items-center" @click.stop="toggleExpanded(collection.id)">
              <ChevronDown v-if="isExpanded(collection.id)" class="size-4" />
              <ChevronRight v-else class="size-4" />
            </span>
            <span class="min-w-0 flex-1 truncate text-base">{{ collection.name }}</span>
          </div>
        </AppButton>

        <div v-if="isExpanded(collection.id)" class="space-y-1">
          <template v-if="selectedCollection?.id === collection.id">
            <div v-if="sourceView" class="relative">
              <AppButton
                text
                class="group w-full justify-start rounded-md px-3 py-2 pl-10 text-base"
                :class="isActiveView(sourceView.id)
                  ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
                @click="handleViewClick(sourceView.id)"
              >
                <div class="flex w-full items-center gap-2">
                  <LockKeyhole class="size-4 text-[var(--accent-primary)]" />
                  <span class="flex-1 truncate text-left">{{ sourceView.name }}</span>
                </div>
              </AppButton>
            </div>

            <div
              v-for="view in childViews"
              :key="view.id"
              class="relative"
              @dragover="event => onViewDragOver(view.id, event)"
              @drop="event => onViewDrop(collection.id, view.id, event)"
            >
              <AppButton
                text
                class="group w-full justify-start rounded-md px-3 py-2 text-base"
                :class="[
                  isActiveView(view.id)
                    ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                  dragOverViewId === view.id ? 'bg-[var(--bg-hover)]' : '',
                ]"
                @click="handleViewClick(view.id)"
              >
                <div class="flex w-full items-center gap-2">
                  <span
                    class="flex size-5 items-center justify-center text-[var(--text-muted)]"
                    title="Drag to reorder"
                    draggable="true"
                    @dragstart="event => onViewDragStart(view.id, event)"
                    @dragend="onViewDragEnd"
                    @mousedown.stop
                    @click.stop
                  >
                    <GripVertical :size="14" />
                  </span>
                  <component :is="getViewTypeMeta(view.type).icon" class="size-4 text-[var(--accent-primary)]" />
                  <span class="flex-1 truncate text-left">{{ view.name }}</span>
                  <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      class="flex size-5 items-center justify-center rounded text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
                      title="Rename view"
                      @mousedown.stop
                      @click.stop="openEditViewModal(view)"
                    >
                      <Pencil class="size-4" />
                    </span>
                    <span
                      class="flex size-5 items-center justify-center rounded text-[var(--danger)] hover:bg-[var(--bg-hover)]"
                      title="Delete view"
                      @mousedown.stop
                      @click.stop="toggleDeleteConfirm(view.id)"
                    >
                      <Trash2 class="size-4" />
                    </span>
                  </div>
                </div>
              </AppButton>

              <div
                v-if="confirmDeleteViewId === view.id"
                :ref="setDeleteConfirmContainer"
                class="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] p-2 text-base text-[var(--text-secondary)] shadow-lg"
                @mousedown.stop
              >
                <div>Are you sure?</div>
                <div class="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="rounded px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    @click.stop="closeDeleteConfirm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="rounded bg-[var(--accent-primary)] px-2 py-1 text-black hover:opacity-90"
                    @click.stop="confirmDeleteView(view)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div :ref="setViewPickerContainer" class="relative">
              <AppButton
                text
                class="w-full justify-start rounded-md px-3 py-2 text-base text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                :aria-expanded="isViewPickerOpen"
                aria-controls="view-type-picker"
                @click="event => toggleViewPicker(event, collection.id)"
              >
                <div class="flex w-full items-center gap-2 pl-1">
                  <Plus class="size-4" />
                  <span class="text-sm">Add view</span>
                </div>
              </AppButton>

              <ViewTypePicker
                id="view-type-picker"
                :open="isViewPickerOpen"
                :placement="viewPickerPlacement"
                :viewTypes="viewTypeOptions"
                @select="type => handleViewTypeSelect(collection.id, type)"
                @close="closeViewPicker"
              />
            </div>
          </template>
        </div>
      </div>

      <AppButton
        outlined
        class="w-full justify-start gap-3 rounded-md border-[var(--border-color)] border-dashed px-3 py-2 text-base text-[var(--text-muted)]"
        @click="showNewCollectionModal = true"
      >
        <template #icon>
          <Plus class="size-4" />
        </template>
        <span>New Collection</span>
      </AppButton>
    </nav>

    <div class="border-t border-[var(--border-color)] px-2 py-2">
      <AppButton
        text
        class="w-full justify-start gap-3 rounded-md px-3 py-2 text-base"
        :class="currentView === 'settings'
          ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'"
        @click="showSettings"
      >
        <template #icon>
          <Settings class="size-4" />
        </template>
        <span>Settings</span>
      </AppButton>
    </div>
  </aside>

  <AppDialog
    :visible="showNewCollectionModal"
    header="Create New Collection"
    class="max-w-xl"
    @update:visible="showNewCollectionModal = $event"
    @hide="cancelNewCollection"
  >
    <div class="space-y-4">
      <div class="space-y-2">
        <AppInput v-model="newCollection.name" placeholder="Name" type="text" autofocus />
      </div>
    </div>

    <template #footer>
      <AppButton severity="secondary" text @click="cancelNewCollection">Cancel</AppButton>
      <AppButton @click="createCollection">Create Collection</AppButton>
    </template>
  </AppDialog>

  <AppDialog
    :visible="showViewModal"
    :header="viewModalHeader"
    class="max-w-xl"
    @update:visible="showViewModal = $event"
    @hide="closeViewModal"
  >
    <div class="space-y-4">
      <div class="space-y-2">
        <AppInput v-model="viewModalName" placeholder="Name" type="text" autofocus />
      </div>
      <div v-if="viewModalMode === 'create' && viewModalType === 'kanban'" class="space-y-2">
        <label class="text-base font-medium text-[var(--text-secondary)]">Stacked by</label>
        <AppSelect
          v-model="viewModalKanbanFieldId"
          :options="kanbanFieldOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Choose select field"
          class="w-full"
        />
      </div>
      <div v-if="viewModalMode === 'create' && viewModalType === 'calendar'" class="space-y-2">
        <label class="text-base font-medium text-[var(--text-secondary)]">Date field</label>
        <AppSelect
          v-model="viewModalCalendarFieldId"
          :options="calendarFieldOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Choose date field"
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <AppButton severity="secondary" text @click="closeViewModal">Cancel</AppButton>
      <AppButton @click="saveViewModal">
        {{ viewModalMode === "edit" ? "Save" : "Create View" }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component, type ComponentPublicInstance } from "vue";
import { storeToRefs } from "pinia";
import {
  Brain,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  GripVertical,
  KanbanSquare,
  LayoutDashboard,
  LayoutGrid,
  LockKeyhole,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppDialog from "@/components/app/ui/AppDialog.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import { useStore } from "../../../store";
import { useNotificationsStore } from "../../../stores/notifications";
import type { Collection, View, ViewType } from "../../../types/models";
import { getOrderedFieldIds } from "../../../utils/viewConfig";
import { collectionNameSchema, viewNameSchema } from "../../../validation/schemas";
import ViewTypePicker from "./ViewTypePicker.vue";
import { createConfiguredView } from "./viewCreation";

type ViewTypeOption = {
  type: ViewType;
  label: string;
  icon: Component;
  disabled?: boolean;
  tooltip?: string;
};

const store = useStore();
const { collections, selectedCollection, currentView, currentViews, activeViewId, fields } = storeToRefs(store);
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
const viewModalCalendarFieldId = ref<number | null>(null);
const viewModalKanbanFieldId = ref<number | null>(null);
const draggedViewId = ref<number | null>(null);
const dragOverViewId = ref<number | null>(null);

const sourceView = computed(() => currentViews.value.find((view) => view.is_default === 1) ?? null);

const childViews = computed(() =>
  [...currentViews.value]
    .filter((view) => view.is_default === 0)
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.id - b.id;
    }),
);

const sourceDateFields = computed(() => fields.value.filter((field) => field.type === "date"));
const sourceSelectFields = computed(() => fields.value.filter((field) => field.type === "select"));

const calendarFieldOptions = computed(() =>
  sourceDateFields.value.map((field) => ({
    label: field.name,
    value: field.id,
  })),
);

const kanbanFieldOptions = computed(() =>
  sourceSelectFields.value.map((field) => ({
    label: field.name,
    value: field.id,
  })),
);

const viewTypeOptions = computed<ViewTypeOption[]>(() => {
  const calendarDisabled = sourceDateFields.value.length === 0;
  const kanbanDisabled = sourceSelectFields.value.length === 0;

  return [
    { type: "grid", label: "Grid", icon: LayoutGrid },
    {
      type: "kanban",
      label: "Kanban",
      icon: KanbanSquare,
      disabled: kanbanDisabled,
      tooltip: kanbanDisabled ? "Add a select field to the source view first." : undefined,
    },
    {
      type: "calendar",
      label: "Calendar",
      icon: CalendarDays,
      disabled: calendarDisabled,
      tooltip: calendarDisabled ? "Add a date field to the source view first." : undefined,
    },
  ];
});

const isViewPickerOpen = computed(
  () => viewPickerOpenFor.value !== null && viewPickerOpenFor.value === selectedCollection.value?.id,
);

const viewModalHeader = computed(() => {
  const label = getViewTypeMeta(viewModalType.value).label;
  return viewModalMode.value === "edit" ? `Rename ${label} view` : `Create new ${label} view`;
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
  return viewTypeOptions.value.find((option) => option.type === type) ?? viewTypeOptions.value[0];
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

function setViewPickerContainer(element: Element | ComponentPublicInstance | null) {
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
  const estimatedHeight = viewTypeOptions.value.length * 40 + 16;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  viewPickerPlacement.value = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? "top" : "bottom";
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
  viewModalCalendarFieldId.value = type === "calendar" ? (calendarFieldOptions.value[0]?.value ?? null) : null;
  viewModalKanbanFieldId.value = type === "kanban" ? (kanbanFieldOptions.value[0]?.value ?? null) : null;
  closeDeleteConfirm();
  showViewModal.value = true;
}

function openEditViewModal(view: View) {
  viewModalMode.value = "edit";
  viewModalType.value = view.type;
  viewModalCollectionId.value = view.collection_id;
  viewModalViewId.value = view.id;
  viewModalName.value = view.name;
  viewModalCalendarFieldId.value = null;
  viewModalKanbanFieldId.value = null;
  closeDeleteConfirm();
  showViewModal.value = true;
}

function closeViewModal() {
  showViewModal.value = false;
  viewModalName.value = "";
  viewModalViewId.value = null;
  viewModalCollectionId.value = null;
  viewModalCalendarFieldId.value = null;
  viewModalKanbanFieldId.value = null;
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
    const calendarFieldId = viewModalType.value === "calendar" ? viewModalCalendarFieldId.value : null;
    const kanbanFieldId = viewModalType.value === "kanban" ? viewModalKanbanFieldId.value : null;

    if (viewModalType.value === "calendar" && !calendarFieldId) {
      notifications.push({
        severity: "warn",
        summary: "Missing date field",
        detail: "Choose a date field for the calendar view.",
        life: 5000,
      });
      return;
    }

    if (viewModalType.value === "kanban" && !kanbanFieldId) {
      notifications.push({
        severity: "warn",
        summary: "Missing select field",
        detail: "Choose a select field for the kanban view.",
        life: 5000,
      });
      return;
    }

    await createConfiguredView({
      store,
      collectionId: viewModalCollectionId.value,
      name: nameResult.data,
      type: viewModalType.value,
      calendarFieldId,
      kanbanFieldId,
      selectedFieldIds: getOrderedFieldIds(
        fields.value.filter((field) => field.collection_id === viewModalCollectionId.value),
      ),
    });
  }

  closeViewModal();
}

function onViewDragStart(viewId: number, event: DragEvent) {
  draggedViewId.value = viewId;
  dragOverViewId.value = null;
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", String(viewId));
    event.dataTransfer.setDragImage?.(event.currentTarget as Element, 0, 0);
    event.dataTransfer.effectAllowed = "move";
  }
}

function onViewDragEnd() {
  draggedViewId.value = null;
  dragOverViewId.value = null;
}

function onViewDragOver(viewId: number, event: DragEvent) {
  if (draggedViewId.value === null || draggedViewId.value === viewId) {
    return;
  }
  dragOverViewId.value = viewId;
  event.preventDefault();
}

async function onViewDrop(collectionId: number, viewId: number, event: DragEvent) {
  event.preventDefault();
  const draggedId = draggedViewId.value;
  if (!draggedId || draggedId === viewId) {
    onViewDragEnd();
    return;
  }

  const ids = childViews.value.map((view) => view.id);
  if (!ids.includes(draggedId) || !ids.includes(viewId)) {
    onViewDragEnd();
    return;
  }

  const nextIds = ids.filter((id) => id !== draggedId);
  const targetIndex = nextIds.indexOf(viewId);
  if (targetIndex < 0) {
    onViewDragEnd();
    return;
  }

  nextIds.splice(targetIndex, 0, draggedId);
  await store.reorderViews({
    collectionId,
    viewOrders: nextIds.map((id, index) => ({
      id,
      order: index + 1,
    })),
  });

  onViewDragEnd();
}

function toggleDeleteConfirm(viewId: number) {
  confirmDeleteViewId.value = confirmDeleteViewId.value === viewId ? null : viewId;
}

function setDeleteConfirmContainer(element: Element | ComponentPublicInstance | null) {
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

function showSettings() {
  store.showSettings();
}

async function createCollection() {
  const nameResult = collectionNameSchema.safeParse(newCollection.value.name);

  if (!nameResult.success) {
    const detail = nameResult.error.issues[0]?.message || "Please check your collection settings.";
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
    (!deleteConfirmContainer.value || (target && !deleteConfirmContainer.value.contains(target)))
  ) {
    closeDeleteConfirm();
  }

  if (isViewPickerOpen.value && (!viewPickerContainer.value || (target && !viewPickerContainer.value.contains(target)))) {
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
