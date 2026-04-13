<template>
  <div class="mx-auto max-h-[100vh] space-y-4 overflow-y-auto px-4 py-4 text-base">
    <div class="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-12">Order</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Type</TableHead>
            <TableHead class="w-36 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="field in orderedFields" :key="field.id">
            <TableRow
              :class="dragOverFieldId === field.id ? 'bg-[var(--bg-hover)]' : undefined"
              @dragover.prevent="onDragOver(field.id)"
              @drop.prevent="onDrop(field.id)"
            >
              <TableCell>
                <button
                  type="button"
                  class="flex size-8 items-center justify-center text-[var(--text-muted)]"
                  draggable="true"
                  title="Drag to reorder"
                  @dragstart="event => onDragStart(field.id, event)"
                  @dragend="onDragEnd"
                >
                  <GripVertical :size="14" />
                </button>
              </TableCell>
              <TableCell>
                <span>{{ field.name }}</span>
              </TableCell>
              <TableCell>
                <AppBadge class="gap-1">
                  <component :is="iconMap[FIELD_TYPE_META[field.type as FieldType].icon]" :size="12" class="text-[var(--text-primary)]" />
                  <span>{{ FIELD_TYPE_META[field.type as FieldType].displayName }}</span>
                </AppBadge>
              </TableCell>
              <TableCell>
                <div class="flex items-center justify-end gap-2">
                  <AppButton
                    text
                    class="h-8 w-8 p-0 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    title="Edit field"
                    @click="toggleEdit(field)"
                  >
                    <template #icon>
                      <Pencil :size="18" />
                    </template>
                  </AppButton>
                  <AppButton
                    text
                    class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                    title="Delete field"
                    @click="$emit('delete-field', field)"
                  >
                    <template #icon>
                      <Trash2 :size="18" />
                    </template>
                  </AppButton>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="editingFieldId === field.id">
              <TableCell :colspan="4" class="bg-[var(--bg-primary)]">
                <div class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                  <div class="mb-3 flex items-center gap-2 text-base tracking-wide text-[var(--text-secondary)]">
                    <Pencil :size="14" />
                    Edit Field
                  </div>
                  <div class="flex flex-col gap-3 md:flex-row md:items-center">
                    <AppInput v-model="editDraft.name" type="text" placeholder="Field name" class="flex-1" />
                    <AppBadge class="gap-1">
                      <component
                        :is="iconMap[FIELD_TYPE_META[field.type as FieldType].icon]"
                        :size="12"
                        class="text-[var(--text-muted)]"
                      />
                      <span>{{ FIELD_TYPE_META[field.type as FieldType].displayName }}</span>
                    </AppBadge>
                  </div>
                  <FieldOptionsForm
                    v-model="editDraft.options"
                    :type="field.type"
                    :items="items"
                    :fieldName="field.name"
                    class="mt-4"
                  />
                  <div class="mt-4 flex justify-end gap-2">
                    <AppButton severity="secondary" text @click="cancelEdit">Cancel</AppButton>
                    <AppButton @click="submitEditField(field)">Save</AppButton>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <div ref="addFieldSectionRef" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
      <div class="mb-3 flex items-center gap-2 text-base tracking-wide text-[var(--text-secondary)]">
        <Plus class="size-4" />
        Add New Field
      </div>
      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <AppInput v-model="newField.name" type="text" placeholder="Field name" class="flex-1" />
        <AppSelect
          v-model="newField.type"
          :options="fieldTypeOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full md:w-56"
        />
        <AppButton class="md:self-stretch" @click="submitAddField">Add</AppButton>
      </div>
      <FieldOptionsForm v-model="newField.options" :type="newField.type" class="mt-4" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type Component } from "vue";
import * as icons from "lucide-vue-next";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-vue-next";
import AppBadge from "@/components/app/ui/AppBadge.vue";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Field, FieldOptions, FieldType, Item } from "../../../types/models";
import { FIELD_TYPE_META, FIELD_TYPE_OPTIONS } from "../../../types/models";
import { getDefaultOptions, parseFieldOptions } from "../../../utils/fieldOptions";
import type { FieldDraftInput } from "../types";
import FieldOptionsForm from "./FieldOptionsForm.vue";

type EditDraft = {
  name: string;
  options: FieldOptions;
};

const props = defineProps<{
  orderedFields: Field[];
  items: Item[];
}>();

const emit = defineEmits<{
  (e: "add-field", value: FieldDraftInput): void;
  (e: "delete-field", value: Field): void;
  (e: "reorder-fields", value: Field[]): void;
  (e: "update-field", value: { field: Field; name: string; options: FieldOptions; removedOptions: string[] }): void;
}>();

const fieldTypeOptions = FIELD_TYPE_OPTIONS;
const iconMap = icons as unknown as Record<string, Component>;

const newField = ref<FieldDraftInput>(createEmptyFieldDraft());
const addFieldSectionRef = ref<HTMLElement | null>(null);
const editingFieldId = ref<number | null>(null);
const editingOriginalChoices = ref<string[]>([]);
const editDraft = ref<EditDraft>({
  name: "",
  options: getDefaultOptions("text"),
});
const draggedFieldId = ref<number | null>(null);
const dragOverFieldId = ref<number | null>(null);

function createEmptyFieldDraft(): FieldDraftInput {
  return {
    name: "",
    type: "text",
    options: getDefaultOptions("text"),
  };
}

watch(
  () => newField.value.type,
  (type) => {
    newField.value.options = getDefaultOptions(type);
  },
);

function submitAddField() {
  emit("add-field", { ...newField.value, options: { ...newField.value.options } });
  newField.value = createEmptyFieldDraft();
}

function onDragStart(fieldId: number, event: DragEvent) {
  draggedFieldId.value = fieldId;
  dragOverFieldId.value = null;
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", String(fieldId));
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDragOver(fieldId: number) {
  if (draggedFieldId.value === null || draggedFieldId.value === fieldId) {
    return;
  }
  dragOverFieldId.value = fieldId;
}

function onDrop(targetFieldId: number) {
  const draggedId = draggedFieldId.value;
  if (!draggedId || draggedId === targetFieldId) {
    onDragEnd();
    return;
  }

  const next = [...props.orderedFields];
  const draggedIndex = next.findIndex((field) => field.id === draggedId);
  const targetIndex = next.findIndex((field) => field.id === targetFieldId);
  if (draggedIndex < 0 || targetIndex < 0) {
    onDragEnd();
    return;
  }

  const [draggedField] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, draggedField);
  emit("reorder-fields", next);
  onDragEnd();
}

function onDragEnd() {
  draggedFieldId.value = null;
  dragOverFieldId.value = null;
}

function toggleEdit(field: Field) {
  if (editingFieldId.value === field.id) {
    cancelEdit();
    return;
  }

  editingFieldId.value = field.id;
  editDraft.value = {
    name: field.name,
    options: parseFieldOptions(field.type, field.options),
  };

  if (field.type === "select" || field.type === "multiselect") {
    const parsed = parseFieldOptions(field.type, field.options) as { choices?: string[] };
    editingOriginalChoices.value = parsed.choices ? [...parsed.choices] : [];
  } else {
    editingOriginalChoices.value = [];
  }
}

function cancelEdit() {
  editingFieldId.value = null;
  editDraft.value = {
    name: "",
    options: getDefaultOptions("text"),
  };
  editingOriginalChoices.value = [];
}

function submitEditField(field: Field) {
  const currentOptions = editDraft.value.options;
  const removedOptions = editingOriginalChoices.value.filter(
    (option) => !(currentOptions as { choices?: string[] }).choices?.includes(option),
  );

  emit("update-field", {
    field,
    name: editDraft.value.name,
    options: { ...currentOptions },
    removedOptions,
  });

  cancelEdit();
}

function focusAddField() {
  addFieldSectionRef.value?.scrollIntoView({
    block: "center",
    behavior: "smooth",
  });

  const input = addFieldSectionRef.value?.querySelector("input");
  input?.focus();
}

defineExpose({ focusAddField });
</script>
