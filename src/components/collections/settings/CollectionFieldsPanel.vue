<template>
  <div class="flex h-full min-h-0 flex-col px-4 py-4">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <AppInput
        v-model="searchQuery"
        type="text"
        placeholder="Search fields"
        class="w-full md:max-w-sm"
      />
      <div class="flex items-center gap-2">
        <AppButton class="gap-2" @click="createFieldDraft">
          <template #icon>
            <Plus class="size-4" />
          </template>
          New field
        </AppButton>
        <AppButton
          severity="secondary"
          text
          :disabled="!isDirty"
          @click="resetDrafts"
          >Reset</AppButton
        >
        <AppButton :disabled="!isDirty" @click="saveDrafts"
          >Save changes</AppButton
        >
      </div>
    </div>

    <div
      class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]"
    >
      <div
        class="min-h-0 overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-primary)"
      >
        <div class="max-h-full overflow-y-auto">
          <button
            v-for="draft in filteredDrafts"
            :key="draft.draftId"
            type="button"
            class="flex w-full items-center gap-3 border-b border-(--border-color) px-4 py-3 text-left last:border-b-0"
            :class="
              selectedDraftId === draft.draftId
                ? 'bg-(--bg-hover)'
                : 'hover:bg-(--bg-hover)/60'
            "
            @click="selectedDraftId = draft.draftId"
            @dragover.prevent="onDragOver(draft.draftId)"
            @drop.prevent="onDrop(draft.draftId)"
          >
            <span
              class="flex size-7 items-center justify-center text-(--text-muted)"
              :class="
                searchQuery.trim()
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-grab'
              "
              :draggable="!searchQuery.trim()"
              @dragstart="(event) => onDragStart(draft.draftId, event)"
              @dragend="onDragEnd"
            >
              <GripVertical :size="14" />
            </span>
            <component
              :is="iconMap[FIELD_TYPE_META[draft.type].icon]"
              :size="14"
              class="text-(--text-muted)"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium text-(--text-primary)">
                {{ draft.name || "Untitled field" }}
              </div>
              <div class="truncate text-sm text-(--text-muted)">
                {{ FIELD_TYPE_META[draft.type].displayName }}
              </div>
            </div>
          </button>
          <div
            v-if="filteredDrafts.length === 0"
            class="px-4 py-10 text-center text-(--text-muted)"
          >
            No fields match your search.
          </div>
        </div>
      </div>

      <div
        class="min-h-0 overflow-y-auto rounded-xl border border-(--border-color) bg-(--bg-primary) p-4"
      >
        <template v-if="selectedDraft">
          <div class="space-y-4">
            <AppInput
              :modelValue="selectedDraft.name"
              type="text"
              placeholder="Field name"
              class="w-full"
              @update:modelValue="
                (value) => updateSelectedDraft({ name: value ?? '' })
              "
            />

            <div class="space-y-2">
              <div class="text-base font-semibold uppercase text-(--text-muted)">
                Field type
              </div>
              <AppSelect
                :modelValue="selectedDraft.type"
                :options="fieldTypeOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
                @update:modelValue="
                  (value) => onSelectedDraftTypeUpdate(value as FieldType | null)
                "
              />
            </div>

            <div class="space-y-2">
              <div
                class="text-base font-semibold uppercase text-(--text-muted)"
              >
                Description
              </div>
              <AppTextarea
                :modelValue="selectedDraft.description"
                :rows="3"
                class="w-full"
                placeholder="Add description"
                @update:modelValue="
                  (value) => updateSelectedDraft({ description: value ?? '' })
                "
              />
            </div>

            <FieldOptionsForm
              :modelValue="selectedDraft.options"
              :type="selectedDraft.type"
              :items="items"
              :fieldName="selectedDraft.name"
              @update:modelValue="
                (value) => updateSelectedDraft({ options: value })
              "
            />

            <div class="flex justify-end">
              <AppButton
                text
                class="text-(--danger) hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                @click="deleteSelectedDraft"
              >
                <template #icon>
                  <Trash2 class="size-4" />
                </template>
                Delete field
              </AppButton>
            </div>
          </div>
        </template>
        <div
          v-else
          class="flex h-full items-center justify-center text-(--text-muted)"
        >
          Select a field to edit its options.
        </div>
      </div>
    </div>

    <AppDialog
      :visible="conversionDialogVisible"
      class="sm:max-w-3xl"
      header="Change field type"
      @update:visible="onConversionDialogVisibleChange"
    >
      <div class="space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm text-(--text-muted)">Field</div>
            <div class="text-lg font-semibold text-(--text-primary)">
              {{ conversionFieldName }}
            </div>
            <div class="text-sm text-(--text-muted)">
              {{ conversionSourceLabel }} to {{ conversionTargetLabel }}
            </div>
          </div>
          <AppBadge :severity="conversionRiskSeverity">
            {{ conversionRiskLabel }}
          </AppBadge>
        </div>

        <div
          v-if="conversionTargetType === 'rating'"
          class="grid gap-3 rounded-lg border border-(--border-color) p-3 md:grid-cols-2"
        >
          <div class="space-y-1">
            <label class="text-sm font-medium text-(--text-primary)">
              Minimum rating
            </label>
            <AppNumberField
              :modelValue="conversionRatingMin"
              @update:modelValue="updateConversionRatingMin"
            />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-(--text-primary)">
              Maximum rating
            </label>
            <AppNumberField
              :modelValue="conversionRatingMax"
              @update:modelValue="updateConversionRatingMax"
            />
          </div>
        </div>

        <div
          class="grid gap-3 md:grid-cols-4"
          aria-label="Conversion statistics"
        >
          <div class="rounded-lg border border-(--border-color) p-3">
            <div class="text-xs uppercase text-(--text-muted)">Affected</div>
            <div class="text-xl font-semibold">
              {{ conversionPreview?.affectedCount ?? 0 }}
            </div>
          </div>
          <div class="rounded-lg border border-(--border-color) p-3">
            <div class="text-xs uppercase text-(--text-muted)">Converted</div>
            <div class="text-xl font-semibold">
              {{ conversionPreview?.convertedCount ?? 0 }}
            </div>
          </div>
          <div class="rounded-lg border border-(--border-color) p-3">
            <div class="text-xs uppercase text-(--text-muted)">Cleared</div>
            <div class="text-xl font-semibold">
              {{ conversionPreview?.clearedCount ?? 0 }}
            </div>
          </div>
          <div class="rounded-lg border border-(--border-color) p-3">
            <div class="text-xs uppercase text-(--text-muted)">Empty</div>
            <div class="text-xl font-semibold">
              {{ conversionPreview?.skippedEmptyCount ?? 0 }}
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-sm font-semibold text-(--text-primary)">
            Preview
          </div>
          <div
            v-if="conversionLoading"
            class="rounded-lg border border-(--border-color) px-4 py-6 text-center text-(--text-muted)"
          >
            Loading conversion preview...
          </div>
          <div
            v-else-if="!conversionPreview || conversionPreview.samples.length === 0"
            class="rounded-lg border border-(--border-color) px-4 py-6 text-center text-(--text-muted)"
          >
            No non-empty values to preview.
          </div>
          <div v-else class="overflow-hidden rounded-lg border border-(--border-color)">
            <div
              v-for="sample in conversionPreview.samples"
              :key="sample.itemId"
              class="grid gap-3 border-b border-(--border-color) p-3 last:border-b-0 md:grid-cols-[1fr_auto_1fr]"
            >
              <div class="min-w-0">
                <div class="text-xs uppercase text-(--text-muted)">Before</div>
                <div class="truncate text-sm text-(--text-primary)">
                  {{ sample.before }}
                </div>
              </div>
              <ArrowRight class="mt-5 hidden size-4 text-(--text-muted) md:block" />
              <div class="min-w-0">
                <div class="text-xs uppercase text-(--text-muted)">After</div>
                <div
                  class="truncate text-sm"
                  :class="
                    sample.willClear
                      ? 'text-(--danger)'
                      : 'text-(--text-primary)'
                  "
                >
                  {{ sample.after }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="conversionPreview?.generatedChoices.length"
          class="rounded-lg border border-(--border-color) p-3"
        >
          <div class="text-sm font-semibold text-(--text-primary)">
            Choices to add
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <AppBadge
              v-for="choice in conversionPreview.generatedChoices"
              :key="choice"
              severity="info"
            >
              {{ choice }}
            </AppBadge>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <AppButton
            severity="secondary"
            text
            :disabled="conversionSubmitting"
            @click="closeConversionDialog"
          >
            Cancel
          </AppButton>
          <AppButton
            :severity="conversionConfirmSeverity"
            :disabled="!conversionPreview || conversionLoading"
            :loading="conversionSubmitting"
            @click="confirmConversion"
          >
            {{ conversionConfirmLabel }}
          </AppButton>
        </div>
      </div>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from "vue";
import * as icons from "lucide-vue-next";
import { ArrowRight, GripVertical, Plus, Trash2 } from "lucide-vue-next";
import AppBadge from "@/components/app/ui/AppBadge.vue";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppDialog from "@/components/app/ui/AppDialog.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppNumberField from "@/components/app/ui/AppNumberField.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import AppTextarea from "@/components/app/ui/AppTextarea.vue";
import { useNotificationsStore } from "@/stores/notifications";
import type {
  ConvertFieldTypeInput,
  Field,
  FieldConversionPreview,
  FieldConversionResult,
  FieldOptions,
  FieldType,
  Item,
  PreviewFieldConversionInput,
  RatingFieldOptions,
} from "../../../types/models";
import { FIELD_TYPE_META, FIELD_TYPE_OPTIONS } from "../../../types/models";
import {
  getDefaultOptions,
  parseFieldOptions,
  serializeFieldOptions,
} from "../../../utils/fieldOptions";
import FieldOptionsForm from "./FieldOptionsForm.vue";

type FieldDraft = {
  draftId: string;
  id: number | null;
  name: string;
  type: FieldType;
  description: string;
  options: FieldOptions;
  originalChoices: string[];
};

type SavedFieldDraft = {
  id: number | null;
  name: string;
  type: FieldType;
  description: string | null;
  options: FieldOptions;
};

const props = defineProps<{
  orderedFields: Field[];
  items: Item[];
  previewFieldConversion: (
    input: PreviewFieldConversionInput,
  ) => Promise<FieldConversionPreview | null>;
  convertFieldType: (
    input: ConvertFieldTypeInput,
  ) => Promise<FieldConversionResult | null>;
}>();

const emit = defineEmits<{
  (
    e: "save-fields",
    value: { drafts: SavedFieldDraft[]; deletedFieldIds: number[] },
  ): void;
}>();

const fieldTypeOptions = FIELD_TYPE_OPTIONS;
const iconMap = icons as unknown as Record<string, Component>;
const notifications = useNotificationsStore();

const searchQuery = ref("");
const drafts = ref<FieldDraft[]>([]);
const deletedFieldIds = ref<number[]>([]);
const selectedDraftId = ref<string | null>(null);
const draggedDraftId = ref<string | null>(null);
const baselineSignature = ref("");
const conversionDialogVisible = ref(false);
const conversionFieldId = ref<number | null>(null);
const conversionFieldName = ref("");
const conversionSourceType = ref<FieldType>("text");
const conversionTargetType = ref<FieldType>("text");
const conversionPreview = ref<FieldConversionPreview | null>(null);
const conversionLoading = ref(false);
const conversionSubmitting = ref(false);
const conversionRatingMin = ref<number | null>(0);
const conversionRatingMax = ref<number | null>(5);
let conversionPreviewToken = 0;
let nextDraftSequence = 0;

const filteredDrafts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return drafts.value;
  }

  return drafts.value.filter((draft) =>
    draft.name.toLowerCase().includes(query),
  );
});

const selectedDraft = computed(
  () =>
    drafts.value.find((draft) => draft.draftId === selectedDraftId.value) ??
    null,
);

const isDirty = computed(() => currentSignature() !== baselineSignature.value);

const conversionSourceLabel = computed(
  () => FIELD_TYPE_META[conversionSourceType.value].displayName,
);
const conversionTargetLabel = computed(
  () => FIELD_TYPE_META[conversionTargetType.value].displayName,
);
const conversionRiskLabel = computed(() => {
  switch (conversionPreview.value?.risk) {
    case "safe":
      return "Safe";
    case "wipe":
      return "Wipe";
    case "lossy":
      return "Lossy";
    default:
      return "Preview";
  }
});
const conversionRiskSeverity = computed(() => {
  switch (conversionPreview.value?.risk) {
    case "safe":
      return "success" as const;
    case "wipe":
      return "danger" as const;
    case "lossy":
      return "warn" as const;
    default:
      return "info" as const;
  }
});
const conversionConfirmSeverity = computed(() =>
  conversionPreview.value?.risk === "wipe" ? ("danger" as const) : undefined,
);
const conversionConfirmLabel = computed(() => {
  switch (conversionPreview.value?.risk) {
    case "wipe":
      return "Create backup and wipe values";
    case "lossy":
      return "Create backup and convert with loss";
    default:
      return "Create backup and convert";
  }
});

function getChoices(options: FieldOptions): string[] {
  const parsed = options as { choices?: string[] };
  return parsed.choices ? [...parsed.choices] : [];
}

function buildDraft(field: Field): FieldDraft {
  return {
    draftId: `field-${field.id}`,
    id: field.id,
    name: field.name,
    type: field.type,
    description: field.description ?? "",
    options: parseFieldOptions(field.type, field.options),
    originalChoices:
      field.type === "select" || field.type === "multiselect"
        ? getChoices(parseFieldOptions(field.type, field.options))
        : [],
  };
}

function currentSignature() {
  return JSON.stringify({
    drafts: drafts.value.map((draft) => ({
      id: draft.id,
      name: draft.name,
      type: draft.type,
      description: draft.description.trim(),
      options: draft.options,
    })),
    deletedFieldIds: [...deletedFieldIds.value].sort((a, b) => a - b),
  });
}

function resetDrafts() {
  drafts.value = props.orderedFields.map((field) => buildDraft(field));
  deletedFieldIds.value = [];
  selectedDraftId.value = drafts.value[0]?.draftId ?? null;
  baselineSignature.value = currentSignature();
}

function createFieldDraft() {
  nextDraftSequence += 1;
  const draftId = `new-${nextDraftSequence}`;
  drafts.value.push({
    draftId,
    id: null,
    name: "",
    type: "text",
    description: "",
    options: getDefaultOptions("text"),
    originalChoices: [],
  });
  selectedDraftId.value = draftId;
}

function updateSelectedDraft(
  patch: Partial<Pick<FieldDraft, "name" | "description" | "options">>,
) {
  if (!selectedDraft.value) {
    return;
  }

  drafts.value = drafts.value.map((draft) =>
    draft.draftId === selectedDraft.value?.draftId
      ? { ...draft, ...patch }
      : draft,
  );
}

function updateSelectedDraftType(type: FieldType) {
  if (!selectedDraft.value) {
    return;
  }

  drafts.value = drafts.value.map((draft) =>
    draft.draftId === selectedDraft.value?.draftId
      ? {
          ...draft,
          type,
          options: getDefaultOptions(type),
          originalChoices: [],
        }
      : draft,
  );
}

function onSelectedDraftTypeUpdate(type: FieldType | null) {
  const draft = selectedDraft.value;
  if (!draft) {
    return;
  }
  const nextType = type ?? draft.type;
  if (draft.id === null) {
    updateSelectedDraftType(nextType);
    return;
  }
  openConversionDialog(draft, nextType);
}

function buildConversionTargetOptions(): string {
  const options = getDefaultOptions(conversionTargetType.value);
  if (conversionTargetType.value === "rating") {
    const ratingOptions = options as RatingFieldOptions;
    return serializeFieldOptions({
      ...ratingOptions,
      min: conversionRatingMin.value ?? 0,
      max: conversionRatingMax.value ?? 5,
    });
  }
  return serializeFieldOptions(options);
}

async function loadConversionPreview() {
  const fieldId = conversionFieldId.value;
  if (!fieldId) {
    return;
  }

  const token = ++conversionPreviewToken;
  conversionLoading.value = true;
  try {
    const preview = await props.previewFieldConversion({
      fieldId,
      targetType: conversionTargetType.value,
      targetOptions: buildConversionTargetOptions(),
    });
    if (token !== conversionPreviewToken) {
      return;
    }
    conversionPreview.value = preview;
  } finally {
    if (token === conversionPreviewToken) {
      conversionLoading.value = false;
    }
  }
}

function openConversionDialog(draft: FieldDraft, targetType: FieldType) {
  if (draft.id === null || targetType === draft.type) {
    return;
  }

  if (isDirty.value) {
    notifications.push({
      severity: "warn",
      summary: "Save or reset field edits first",
      detail: "Type conversion uses the saved field state.",
      life: 5000,
    });
    return;
  }

  conversionFieldId.value = draft.id;
  conversionFieldName.value = draft.name;
  conversionSourceType.value = draft.type;
  conversionTargetType.value = targetType;
  conversionPreview.value = null;
  conversionRatingMin.value = 0;
  conversionRatingMax.value = 5;
  conversionDialogVisible.value = true;
  void loadConversionPreview();
}

function closeConversionDialog() {
  if (conversionSubmitting.value) {
    return;
  }
  conversionDialogVisible.value = false;
  conversionPreviewToken += 1;
}

function onConversionDialogVisibleChange(value: boolean) {
  if (!value) {
    closeConversionDialog();
    return;
  }
  conversionDialogVisible.value = true;
}

function updateConversionRatingMin(value: number | null) {
  conversionRatingMin.value = value;
  void loadConversionPreview();
}

function updateConversionRatingMax(value: number | null) {
  conversionRatingMax.value = value;
  void loadConversionPreview();
}

async function confirmConversion() {
  const fieldId = conversionFieldId.value;
  if (!fieldId || !conversionPreview.value) {
    return;
  }

  conversionSubmitting.value = true;
  try {
    const result = await props.convertFieldType({
      fieldId,
      targetType: conversionTargetType.value,
      targetOptions: buildConversionTargetOptions(),
    });
    if (!result) {
      return;
    }
    notifications.push({
      severity: "success",
      summary: "Field type changed",
      detail: `Converted ${result.convertedCount} values. Backup: ${result.backup.fileName}`,
      life: 5000,
    });
    conversionDialogVisible.value = false;
  } finally {
    conversionSubmitting.value = false;
  }
}

function deleteSelectedDraft() {
  if (!selectedDraft.value) {
    return;
  }

  if (selectedDraft.value.id !== null) {
    deletedFieldIds.value = [...deletedFieldIds.value, selectedDraft.value.id];
  }

  drafts.value = drafts.value.filter(
    (draft) => draft.draftId !== selectedDraft.value?.draftId,
  );
  selectedDraftId.value = drafts.value[0]?.draftId ?? null;
}

function onDragStart(draftId: string, event: DragEvent) {
  if (searchQuery.value.trim()) {
    return;
  }
  draggedDraftId.value = draftId;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draftId);
  }
}

function onDragOver(draftId: string) {
  if (
    !draggedDraftId.value ||
    draggedDraftId.value === draftId ||
    searchQuery.value.trim()
  ) {
    return;
  }
}

function onDrop(targetDraftId: string) {
  if (
    !draggedDraftId.value ||
    draggedDraftId.value === targetDraftId ||
    searchQuery.value.trim()
  ) {
    onDragEnd();
    return;
  }

  const next = [...drafts.value];
  const draggedIndex = next.findIndex(
    (draft) => draft.draftId === draggedDraftId.value,
  );
  const targetIndex = next.findIndex(
    (draft) => draft.draftId === targetDraftId,
  );
  if (draggedIndex < 0 || targetIndex < 0) {
    onDragEnd();
    return;
  }

  const [moved] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, moved);
  drafts.value = next;
  onDragEnd();
}

function onDragEnd() {
  draggedDraftId.value = null;
}

function saveDrafts() {
  emit("save-fields", {
    drafts: drafts.value.map((draft) => ({
      id: draft.id,
      name: draft.name,
      type: draft.type,
      description: draft.description.trim() || null,
      options: draft.options,
    })),
    deletedFieldIds: [...deletedFieldIds.value],
  });
}

watch(
  () => props.orderedFields,
  () => {
    resetDrafts();
  },
  { immediate: true, deep: true },
);

defineExpose({ createFieldDraft });
</script>
