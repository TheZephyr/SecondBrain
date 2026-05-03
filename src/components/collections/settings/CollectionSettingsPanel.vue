<template>
  <div
    class="mx-auto max-h-[calc(100vh-2rem)] max-w-4xl overflow-y-auto px-10 py-8"
  >
    <Accordion type="single" collapsible defaultValue="0">
      <AccordionItem value="0">
        <AccordionTrigger>
          <div class="flex items-center gap-2">
            <Settings2 :size="16" />
            <span>Collection Settings</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-base font-medium text-(--text-secondary)"
                >Collection Name</label
              >
              <AppInput
                v-model="collectionName"
                type="text"
                placeholder="Collection name"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="1">
        <AccordionTrigger>
          <div class="flex items-center gap-2">
            <Upload :size="16" />
            <span>Export Data</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-base font-medium text-(--text-secondary)"
                >Export Format</label
              >
              <AppSelect
                v-model="exportFormat"
                :options="exportFormatOptions"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div
              v-if="exportFormat === 'json'"
              class="flex items-center justify-between gap-4 rounded-md border border-(--border-color) bg-(--bg-tertiary) p-3"
            >
              <div>
                <div class="font-medium text-(--text-primary)">
                  Include schema
                </div>
                <div class="text-sm text-(--text-muted)">
                  Add field types and options so JSON imports can round-trip
                  without inference.
                </div>
              </div>
              <AppSwitch
                :modelValue="exportIncludeSchema"
                @update:modelValue="
                  (value) => (exportIncludeSchema = Boolean(value))
                "
              />
            </div>
            <div
              class="rounded-md border border-(--border-color) bg-(--bg-tertiary) p-3 text-base text-(--text-secondary)"
            >
              <p v-if="exportFormat === 'csv'">
                Export all items as a CSV file. All values will be enclosed in
                quotes for compatibility.
              </p>
              <p v-else>
                Export all items as JSON. By default this stays a plain array of
                objects; enabling schema wraps the data with field types and
                options for lossless re-import.
              </p>
            </div>
            <AppButton
              class="w-full justify-center gap-2"
              :disabled="isExporting"
              @click="handleExport"
            >
              <template #icon>
                <Download v-if="!isExporting" />
              </template>
              <span v-if="isExporting">Exporting...</span>
              <span v-else
                >Export {{ itemsTotal }}
                {{ itemsTotal === 1 ? "item" : "items" }}</span
              >
            </AppButton>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="2">
        <AccordionTrigger>
          <div class="flex items-center gap-2">
            <Download :size="16" />
            <span>Import Data</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div class="space-y-4">
            <div v-if="!importPreview" class="space-y-4">
              <div class="space-y-2">
                <label class="text-base font-medium text-(--text-secondary)"
                  >Import Format</label
                >
                <AppSelect
                  v-model="importFormat"
                  :options="exportFormatOptions"
                  optionLabel="label"
                  optionValue="value"
                />
              </div>

              <div class="space-y-2">
                <label class="text-base font-medium text-(--text-secondary)"
                  >Import Mode</label
                >
                <RadioGroup v-model="importMode" class="flex gap-2">
                  <label
                    class="flex flex-1 items-start gap-3 rounded-md border border-(--border-color) bg-(--bg-tertiary) p-3 text-base text-(--text-secondary)"
                  >
                    <RadioGroupItem value="append" />
                    <div>
                      <div class="font-medium text-(--text-primary)">
                        Append
                      </div>
                      <div class="text-base text-(--text-muted)">
                        Add imported items to existing data
                      </div>
                    </div>
                  </label>
                  <label
                    class="flex flex-1 items-start gap-3 rounded-md border border-(--border-color) bg-(--bg-tertiary) p-3 text-base text-(--text-secondary)"
                  >
                    <RadioGroupItem value="replace" />
                    <div>
                      <div class="font-medium text-(--text-primary)">
                        Replace
                      </div>
                      <div class="text-base text-(--text-muted)">
                        Delete all existing items and import new data
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <AppButton
                class="w-full justify-center gap-2"
                @click="handleSelectFile"
              >
                <template #icon>
                  <Download />
                </template>
                Select File to Import
              </AppButton>
            </div>

            <div v-else class="space-y-4">
              <div
                class="flex items-center justify-between border-b border-(--border-color) pb-3"
              >
                <div
                  class="flex items-center gap-2 font-semibold text-(--text-primary)"
                >
                  <FileText :size="18" />
                  Import Preview
                </div>
                <AppButton
                  text
                  class="h-8 w-8 p-0"
                  title="Cancel"
                  @click="cancelImport"
                >
                  <template #icon>
                    <X />
                  </template>
                </AppButton>
              </div>

              <div
                class="rounded-md border border-(--border-color) bg-(--bg-tertiary) p-3 text-base"
              >
                <div class="flex justify-between text-(--text-secondary)">
                  <span>Items to import:</span>
                  <span class="font-semibold text-(--text-primary)">{{
                    importPreview.itemCount
                  }}</span>
                </div>
                <div class="mt-2 flex justify-between text-(--text-secondary)">
                  <span>Import mode:</span>
                  <span class="font-semibold text-(--text-primary)">{{
                    importMode === "append" ? "Append" : "Replace"
                  }}</span>
                </div>
              </div>

              <div
                v-if="safeFields.length === 0"
                class="flex items-start gap-2 rounded-md border border-[color-mix(in_srgb,var(--accent-primary)_30%,transparent)] bg-(--accent-light) p-3 text-base text-(--text-secondary)"
              >
                <AlertTriangle :size="16" />
                This collection has no fields. New fields will be created from
                the import file using the selected preview types.
              </div>

              <div
                v-if="importPreview.matchedFields.length > 0"
                class="space-y-2"
              >
                <div class="text-base font-semibold text-(--text-primary)">
                  Matched Fields ({{ importPreview.matchedFields.length }})
                </div>
                <div class="flex flex-wrap gap-2">
                  <AppBadge
                    v-for="field in importPreview.matchedFields"
                    :key="field"
                    class="bg-[color-mix(in_srgb,var(--success)_20%,transparent)] text-(--success)"
                  >
                    {{ field }}
                  </AppBadge>
                </div>
              </div>

              <div v-if="importPreview.newFields.length > 0" class="space-y-2">
                <div
                  class="flex items-center gap-2 text-base font-semibold text-(--text-primary)"
                >
                  <AlertTriangle :size="14" />
                  New Fields ({{ importPreview.newFields.length }})
                </div>
                <p class="text-base text-(--text-muted)">
                  Review the suggested type for each new field before importing.
                </p>
                <div class="space-y-3">
                  <div
                    v-for="field in importPreview.newFields"
                    :key="field.name"
                    class="rounded-md border border-(--border-color) bg-(--bg-tertiary) p-3"
                  >
                    <div
                      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div class="min-w-0">
                        <div class="font-medium text-(--text-primary)">
                          {{ field.name }}
                        </div>
                        <div
                          class="flex flex-wrap items-center gap-2 text-sm text-(--text-muted)"
                        >
                          Suggested:
                          {{ FIELD_TYPE_META[field.inferredType].displayName }}
                          <AppBadge
                            v-if="field.source === 'schema'"
                            severity="info"
                            value="From schema"
                          />
                        </div>
                      </div>
                      <AppSelect
                        :modelValue="field.selectedType"
                        :options="fieldTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full md:w-56"
                        @update:modelValue="
                          (value) =>
                            onImportPreviewTypeChange(
                              field.name,
                              value as FieldType | null,
                            )
                        "
                      />
                    </div>

                    <div
                      v-if="shouldShowChoicesPreview(field)"
                      class="mt-3 space-y-2"
                    >
                      <div class="text-sm font-medium text-(--text-secondary)">
                        Choices Preview
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <AppBadge
                          v-for="choice in getPreviewChoices(field)"
                          :key="choice"
                          class="bg-[color-mix(in_srgb,var(--info)_18%,transparent)] text-(--text-primary)"
                        >
                          {{ choice }}
                        </AppBadge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="rounded-md border border-(--border-color) bg-(--bg-tertiary) p-3 text-base"
              >
                <div
                  class="mb-2 text-base font-semibold uppercase tracking-wide text-(--text-muted)"
                >
                  Sample Data (first 3 items)
                </div>
                <div class="flex gap-2">
                  <div
                    v-for="(item, index) in importPreview.sample"
                    :key="index"
                    class="flex-1 rounded border border-(--border-color) bg-(--bg-primary) p-2"
                  >
                    <div
                      class="mb-1 text-base font-semibold uppercase tracking-wide text-(--text-muted)"
                    >
                      Item {{ index + 1 }}
                    </div>
                    <div class="space-y-1">
                      <div
                        v-for="(value, key) in item"
                        :key="key"
                        class="flex gap-2"
                      >
                        <span class="min-w-20 text-(--text-muted)"
                          >{{ key }}:</span
                        >
                        <span class="text-(--text-primary)">{{
                          isSampleValueEmpty(value)
                            ? "(empty)"
                            : formatSampleValue(value)
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="flex items-center justify-end gap-2 border-t border-(--border-color) pt-4"
              >
                <AppButton severity="secondary" text @click="cancelImport"
                  >Cancel</AppButton
                >
                <AppButton
                  class="gap-2"
                  :disabled="isImporting"
                  @click="handleImport"
                >
                  <template #icon>
                    <Upload v-if="!isImporting" :size="16" />
                  </template>
                  <span v-if="isImporting">Importing...</span>
                  <span v-else>Import {{ importPreview.itemCount }} items</span>
                </AppButton>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="3">
        <AccordionTrigger>
          <div class="flex items-center gap-2">
            <AlertTriangle :size="16" />
            <span>Danger Zone</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div class="space-y-3">
            <p class="text-base text-(--text-muted)">
              Once you delete a collection, there is no going back.
            </p>
            <AppButton
              severity="danger"
              class="min-w-45 gap-2"
              @click="$emit('delete-collection')"
            >
              <template #icon>
                <Trash2 />
              </template>
              Delete Collection
            </AppButton>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <div class="mt-6 flex justify-end gap-2">
      <AppButton
        severity="secondary"
        text
        @click="store.setCollectionSettingsOpen(false)"
        >Cancel</AppButton
      >
      <AppButton @click="saveSettings">Save Changes</AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import {
  AlertTriangle,
  Download,
  FileText,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-vue-next";
import AppBadge from "@/components/app/ui/AppBadge.vue";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import AppSwitch from "@/components/app/ui/AppSwitch.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useStore } from "../../../store";
import { useCollectionImportExport } from "../../../composables/collection/useCollectionImportExport";
import {
  FIELD_TYPE_META,
  FIELD_TYPE_OPTIONS,
  type Collection,
  type Field,
  type FieldType,
} from "../../../types/models";
import type {
  ImportPreviewNewField,
  ImportValue,
} from "../../../utils/collectionImportExport";
import { isSafeFieldName } from "../../../validation/fieldNames";
import type { CollectionSettingsSavePayload } from "../types";

const props = defineProps<{
  collection: Collection;
  fields: Field[];
  itemsTotal: number;
}>();

const emit = defineEmits<{
  (e: "save-settings", value: CollectionSettingsSavePayload): void;
  (e: "delete-collection"): void;
}>();

const store = useStore();
const collectionName = ref("");
const safeFields = computed(() =>
  props.fields.filter((field) => isSafeFieldName(field.name)),
);
const fieldTypeOptions = FIELD_TYPE_OPTIONS;

const {
  exportFormat,
  exportIncludeSchema,
  exportFormatOptions,
  isExporting,
  handleExport,
  importFormat,
  importMode,
  isImporting,
  importPreview,
  handleSelectFile,
  getImportPreviewChoices,
  updateImportPreviewFieldType,
  handleImport,
  cancelImport,
} = useCollectionImportExport({
  collection: toRef(props, "collection"),
  fields: toRef(props, "fields"),
});

function onImportPreviewTypeChange(fieldName: string, value: FieldType | null) {
  if (!value) return;
  updateImportPreviewFieldType(fieldName, value);
}

function getPreviewChoices(field: ImportPreviewNewField) {
  return getImportPreviewChoices(field);
}

function shouldShowChoicesPreview(field: ImportPreviewNewField) {
  return (
    (field.selectedType === "select" || field.selectedType === "multiselect") &&
    getPreviewChoices(field).length > 0
  );
}

function isSampleValueEmpty(value: ImportValue | undefined) {
  return value === "" || value === null || value === undefined;
}

function formatSampleValue(value: ImportValue | undefined) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function resetSettingsState() {
  collectionName.value = props.collection.name;
}

watch(
  () => props.collection,
  () => {
    resetSettingsState();
  },
  { immediate: true },
);

function saveSettings() {
  emit("save-settings", {
    name: collectionName.value,
  });
}
</script>
