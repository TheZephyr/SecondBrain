<template>
  <div>
    <div class="mb-2 text-base font-semibold uppercase text-(--text-muted)">
      Options
    </div>
    <div class="space-y-3">
      <div
        v-for="(choice, index) in choices"
        :key="index"
        class="space-y-2 rounded-md border border-(--border-color) p-3"
      >
        <div class="flex items-center gap-2">
          <AppInput
            :modelValue="choice"
            class="flex-1"
            @update:modelValue="(value) => updateChoice(index, value)"
          />
          <AppButton
            text
            class="h-8 w-8 p-0 text-(--danger) hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
            title="Delete option"
            @click="requestRemoveChoice(choice)"
          >
            <template #icon>
              <Trash2 :size="14" />
            </template>
          </AppButton>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <input
            type="color"
            :value="normalizeColor(getChoiceColor(choice))"
            class="h-9 w-12 cursor-pointer rounded-md border border-(--border-color) bg-transparent p-1"
            @input="
              (event) =>
                updateChoiceColor(
                  choice,
                  (event.target as HTMLInputElement).value,
                )
            "
          />
          <AppInput
            :modelValue="getChoiceColor(choice)"
            placeholder="#000000"
            class="w-32"
            @update:modelValue="
              (value) => updateChoiceColor(choice, value ?? '')
            "
          />
          <button
            v-for="color in paletteColors"
            :key="`${choice}-${color}`"
            type="button"
            class="size-6 rounded-full border border-(--border-color)"
            :style="{ backgroundColor: color }"
            :title="color"
            @click="updateChoiceColor(choice, color)"
          />
          <AppButton text class="h-8 px-2" @click="clearChoiceColor(choice)"
            >Clear</AppButton
          >
        </div>

        <div
          v-if="confirmingChoice === choice"
          class="rounded-md border border-(--border-color) bg-(--bg-tertiary) p-2 text-base"
        >
          <div class="mb-2 text-(--text-secondary)">
            {{ confirmingCount }} items use this option. Removing it will clear
            those values. Remove anyway?
          </div>
          <div class="flex items-center gap-2">
            <AppButton @click="confirmRemoveChoice">Confirm</AppButton>
            <AppButton severity="secondary" text @click="cancelRemoveChoice"
              >Cancel</AppButton
            >
          </div>
        </div>
      </div>
    </div>
    <AppButton text class="mt-2" @click="addChoice">
      <template #icon>
        <Plus class="size-4" />
      </template>
      Add option
    </AppButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import type {
  FieldOptions,
  ItemDataValue,
  MultiselectFieldOptions,
  SelectFieldOptions,
} from "../../../types/models";
import { parseMultiselectValue } from "../../../utils/fieldValues";

const props = defineProps<{
  modelValue: SelectFieldOptions | MultiselectFieldOptions;
  type: "select" | "multiselect";
  items?: Array<{ data: Record<string, unknown> }>;
  fieldName?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: FieldOptions): void;
}>();

const paletteColors = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
];

const confirmingChoice = ref<string | null>(null);
const confirmingCount = ref(0);

const choices = computed(() => props.modelValue.choices ?? []);
const optionColors = computed(() => props.modelValue.optionColors ?? {});
const selectDefault = computed(
  () => (props.modelValue as SelectFieldOptions).defaultValue ?? null,
);
const multiselectDefault = computed(
  () => (props.modelValue as MultiselectFieldOptions).defaultValue ?? [],
);

function emitOptions(next: FieldOptions) {
  emit("update:modelValue", next);
}

function normalizeColor(value: string) {
  return /^#[\da-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#000000";
}

function getChoiceColor(choice: string) {
  return optionColors.value[choice] ?? "";
}

function updateChoice(index: number, value: string | null | undefined) {
  const nextValue = value ?? "";
  const nextChoices = [...choices.value];
  const previous = nextChoices[index];
  nextChoices[index] = nextValue;
  const nextOptionColors = { ...optionColors.value };

  if (previous !== nextValue && nextOptionColors[previous]) {
    nextOptionColors[nextValue] = nextOptionColors[previous] as string;
    delete nextOptionColors[previous];
  }

  let nextOptions: FieldOptions = {
    ...props.modelValue,
    choices: nextChoices,
    optionColors: nextOptionColors,
  } as FieldOptions;

  if (props.type === "select" && selectDefault.value === previous) {
    nextOptions = {
      ...nextOptions,
      defaultValue: nextValue || null,
    } as FieldOptions;
  }

  if (props.type === "multiselect") {
    const current = multiselectDefault.value;
    if (current.includes(previous)) {
      const updated = current
        .map((entry) => (entry === previous ? nextValue : entry))
        .filter(Boolean);
      nextOptions = {
        ...nextOptions,
        defaultValue: updated.length > 0 ? updated : null,
      } as FieldOptions;
    }
  }

  emitOptions(nextOptions);
}

function addChoice() {
  emitOptions({
    ...props.modelValue,
    choices: [...choices.value, ""],
    optionColors: { ...optionColors.value },
  } as FieldOptions);
}

function updateChoiceColor(choice: string, value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const nextOptionColors = { ...optionColors.value };

  if (!trimmed) {
    delete nextOptionColors[choice];
  } else {
    nextOptionColors[choice] = trimmed;
  }

  emitOptions({
    ...props.modelValue,
    optionColors: nextOptionColors,
  } as FieldOptions);
}

function clearChoiceColor(choice: string) {
  updateChoiceColor(choice, "");
}

function requestRemoveChoice(choice: string) {
  if (!props.items || !props.fieldName) {
    removeChoice(choice);
    return;
  }

  const count = countItemsUsingChoice(choice);
  if (count === 0) {
    removeChoice(choice);
    return;
  }

  confirmingChoice.value = choice;
  confirmingCount.value = count;
}

function confirmRemoveChoice() {
  if (!confirmingChoice.value) return;
  removeChoice(confirmingChoice.value);
  confirmingChoice.value = null;
  confirmingCount.value = 0;
}

function cancelRemoveChoice() {
  confirmingChoice.value = null;
  confirmingCount.value = 0;
}

function removeChoice(choice: string) {
  const nextChoices = choices.value.filter((option) => option !== choice);
  const nextOptionColors = { ...optionColors.value };
  delete nextOptionColors[choice];

  let nextOptions: FieldOptions = {
    ...props.modelValue,
    choices: nextChoices,
    optionColors: nextOptionColors,
  } as FieldOptions;

  if (props.type === "select" && selectDefault.value === choice) {
    nextOptions = { ...nextOptions, defaultValue: null } as FieldOptions;
  }

  if (
    props.type === "multiselect" &&
    multiselectDefault.value.includes(choice)
  ) {
    const updated = multiselectDefault.value.filter(
      (entry) => entry !== choice,
    );
    nextOptions = {
      ...nextOptions,
      defaultValue: updated.length > 0 ? updated : null,
    } as FieldOptions;
  }

  emitOptions(nextOptions);
  if (confirmingChoice.value === choice) {
    confirmingChoice.value = null;
    confirmingCount.value = 0;
  }
}

function countItemsUsingChoice(choice: string) {
  if (!props.items || !props.fieldName) return 0;
  let count = 0;
  for (const item of props.items) {
    const value = item.data[props.fieldName];
    if (props.type === "select") {
      if (typeof value === "string" && value === choice) {
        count += 1;
      }
      continue;
    }

    const parsed = parseMultiselectValue(
      (value as ItemDataValue | undefined) ?? null,
    );
    if (parsed.includes(choice)) {
      count += 1;
    }
  }
  return count;
}
</script>
