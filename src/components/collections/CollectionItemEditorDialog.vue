<template>
  <AppDialog
    :visible="visible"
    :header="editingItem ? 'Edit Item' : 'Add New Item'"
    class="max-w-2xl"
    @update:visible="onVisibilityChange"
    @hide="cancelDialog"
  >
    <form @submit.prevent="saveDialog">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          v-for="field in orderedFields"
          :key="field.id"
          class="gap-2"
          :class="field.type === 'longtext' ? 'md:col-span-2' : ''"
        >
          <FieldLabel :for="getFieldInputId(field)" :class="labelClass(field)">
            {{ field.name }}
          </FieldLabel>

          <AppInput
            v-if="field.type === 'text'"
            :id="getFieldInputId(field)"
            :modelValue="getTextValue(field.name) ?? ''"
            type="text"
            class="w-full"
            @update:modelValue="value => setTextValue(field.name, value)"
          />

          <AppTextarea
            v-else-if="field.type === 'longtext'"
            :id="getFieldInputId(field)"
            :modelValue="getTextValue(field.name) ?? ''"
            :rows="3"
            class="w-full"
            @update:modelValue="value => setTextValue(field.name, value)"
          />

          <AppNumberField
            v-else-if="field.type === 'number'"
            :inputId="getFieldInputId(field)"
            :modelValue="getNumberValue(field.name)"
            inputClass="w-full"
            class="w-full"
            @update:modelValue="value => setNumberValue(field.name, value)"
          />

          <input
            v-else-if="field.type === 'date'"
            :id="getFieldInputId(field)"
            :value="getDateInputValue(field.name)"
            type="date"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            @input="event => updateDateInputValue(field.name, (event.target as HTMLInputElement).value)"
          />

          <AppSelect
            v-else-if="field.type === 'select'"
            :modelValue="getSelectValue(field.name)"
            :options="getSelectChoices(field)"
            class="w-full"
            @update:modelValue="value => setSelectValue(field.name, typeof value === 'string' ? value : null)"
          />

          <Popover v-else-if="field.type === 'multiselect'">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-xs"
              >
                <div class="flex flex-wrap gap-1">
                  <template v-if="getMultiselectValue(field.name).length > 0">
                    <span
                      v-for="option in getMultiselectValue(field.name)"
                      :key="option"
                      class="inline-flex h-5 items-center rounded-full border px-2 py-0.5 text-xs leading-none"
                      :style="getChipStyle(option, getSelectChoices(field))"
                    >
                      {{ option }}
                    </span>
                  </template>
                  <span v-else class="text-[var(--text-muted)]">Select options</span>
                </div>
                <ChevronDown class="size-4 text-[var(--text-muted)]" />
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search options..." />
                <CommandList>
                  <CommandEmpty>No options found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      v-for="option in getSelectChoices(field)"
                      :key="option"
                      :value="option"
                      @select.prevent="toggleMultiselectOption(field.name, option)"
                    >
                      <div class="flex w-full items-center gap-2">
                        <AppCheckbox :modelValue="getMultiselectValue(field.name).includes(option)" />
                        <span>{{ option }}</span>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div v-else-if="field.type === 'boolean'" class="flex min-h-9 items-center gap-2">
            <button type="button" class="flex items-center" @click="setBooleanValue(field.name, !getBooleanValue(field.name))">
              <component
                :is="getBooleanIcon(field)"
                :size="20"
                :fill="getBooleanValue(field.name) ? 'currentColor' : 'transparent'"
                :stroke-width="getBooleanValue(field.name) ? 0 : 1.5"
                :class="getBooleanValue(field.name) ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'"
              />
            </button>
          </div>

          <div v-else-if="field.type === 'url'" class="relative w-full">
            <AppInput
              :id="getFieldInputId(field)"
              :modelValue="getTextValue(field.name) ?? ''"
              type="text"
              class="w-full pr-8"
              @update:modelValue="value => setTextValue(field.name, value)"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--accent-primary)]"
              title="Open link"
              @click="openExternal(getTextValue(field.name))"
            >
              <Link :size="14" />
            </button>
          </div>

          <AppSelect
            v-else-if="field.type === 'rating'"
            :modelValue="getRatingValue(field.name)"
            :options="getRatingOptions(field)"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            @update:modelValue="value => setRatingValue(field.name, typeof value === 'number' ? value : null)"
          />
        </Field>
      </div>
    </form>

    <template #footer>
      <AppButton severity="secondary" text @click="cancelDialog">Cancel</AppButton>
      <AppButton @click="saveDialog">{{ editingItem ? "Update" : "Add" }}</AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, toRef, watch } from "vue";
import * as icons from "lucide-vue-next";
import { ChevronDown, Link } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppDialog from "@/components/app/ui/AppDialog.vue";
import AppCheckbox from "@/components/app/ui/AppCheckbox.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppNumberField from "@/components/app/ui/AppNumberField.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import AppTextarea from "@/components/app/ui/AppTextarea.vue";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCollectionItemForm } from "../../composables/collection/useCollectionItemForm";
import { useFieldUniqueCheck } from "../../composables/collection/useFieldUniqueCheck";
import { systemRepository } from "../../repositories/systemRepository";
import type { BooleanIcon, Field as ItemField, Item, ItemData, RatingFieldOptions } from "../../types/models";
import { formatDateForStorage, parseDateValue } from "../../utils/date";
import { getSelectChoices, parseFieldOptions } from "../../utils/fieldOptions";
import { getChipStyle } from "../../utils/selectChip";
import type { ItemEditorSavePayload } from "./types";

const props = defineProps<{
  visible: boolean;
  orderedFields: ItemField[];
  editingItem: Item | null;
  items: Item[];
  initialData?: ItemData | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "save", value: ItemEditorSavePayload): void;
}>();

const initialDataRef = computed(() => props.initialData ?? null);

const {
  formData,
  startCreate,
  startEdit,
  cancelForm,
  toItemData,
  getFieldInputId,
  getTextValue,
  setTextValue,
  getSelectValue,
  setSelectValue,
  getNumberValue,
  setNumberValue,
  getDateValue,
  setDateValue,
  getMultiselectValue,
  setMultiselectValue,
  getBooleanValue,
  setBooleanValue,
  getRatingValue,
  setRatingValue,
} = useCollectionItemForm(toRef(props, "orderedFields"), initialDataRef);

const { duplicateFields } = useFieldUniqueCheck({
  items: toRef(props, "items"),
  fields: toRef(props, "orderedFields"),
  formData,
  editingItemId: computed(() => props.editingItem?.id ?? null),
});

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) return;
    if (props.editingItem) {
      startEdit(props.editingItem);
      return;
    }
    startCreate();
  },
  { immediate: true },
);

watch(
  () => props.editingItem,
  (item) => {
    if (!props.visible) return;
    if (item) {
      startEdit(item);
      return;
    }
    startCreate();
  },
);

watch(
  () => props.orderedFields,
  () => {
    if (!props.visible || props.editingItem) return;
    startCreate();
  },
  { deep: true },
);

function onVisibilityChange(nextVisible: boolean) {
  emit("update:visible", nextVisible);
}

function cancelDialog() {
  emit("update:visible", false);
  cancelForm();
}

function saveDialog() {
  emit("save", {
    data: toItemData(),
    editingItemId: props.editingItem?.id ?? null,
  });
}

function labelClass(field: ItemField) {
  return duplicateFields.value.has(field.name) ? "text-[var(--danger)]" : "";
}

function getDateInputValue(fieldName: string) {
  return formatDateForStorage(getDateValue(fieldName));
}

function updateDateInputValue(fieldName: string, value: string) {
  setDateValue(fieldName, parseDateValue(value));
}

function getRatingMin(field: ItemField) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions;
  return Number.isFinite(options.min) ? Number(options.min) : 0;
}

function getRatingMax(field: ItemField) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions;
  return Math.max(Number.isFinite(options.max) ? Number(options.max) : 5, getRatingMin(field));
}

function getRatingOptions(field: ItemField) {
  const options: Array<{ label: string; value: number | null }> = [{ label: "None", value: null }];
  const min = getRatingMin(field);
  const max = getRatingMax(field);
  for (let i = min; i <= max; i += 1) {
    options.push({ label: `${i} / ${max} *`, value: i });
  }
  return options;
}

function getBooleanIcon(field: ItemField) {
  return booleanIconMap[((parseFieldOptions(field.type, field.options) as { icon?: BooleanIcon }).icon ?? "square") as BooleanIcon];
}

function toggleMultiselectOption(fieldName: string, option: string) {
  const current = getMultiselectValue(fieldName);
  if (current.includes(option)) {
    setMultiselectValue(fieldName, current.filter((entry) => entry !== option));
    return;
  }
  setMultiselectValue(fieldName, [...current, option]);
}

async function openExternal(url: string | null) {
  if (!url) return;
  await systemRepository.openExternal(url);
}

const booleanIconMap: Record<BooleanIcon, typeof icons.Square> = {
  square: icons.Square,
  circle: icons.Circle,
  heart: icons.Heart,
  star: icons.Star,
  flame: icons.Flame,
  "thumbs-up": icons.ThumbsUp,
  "thumbs-down": icons.ThumbsDown,
  flag: icons.Flag,
};
</script>
