<template>
  <div>
    <div class="mb-2 text-base font-semibold uppercase text-[var(--text-muted)]">Options</div>
    <div class="space-y-2">
      <div v-for="(choice, index) in choices" :key="index" class="space-y-1">
        <div class="flex items-center gap-2">
          <AppInput :modelValue="choice" class="flex-1" @update:modelValue="value => updateChoice(index, value)" />
          <AppButton
            text
            class="h-8 w-8 p-0 text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
            title="Delete option"
            @click="requestRemoveChoice(choice)"
          >
            <template #icon>
              <Trash2 :size="14" />
            </template>
          </AppButton>
        </div>
        <div
          v-if="confirmingChoice === choice"
          class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 text-base"
        >
          <div class="mb-2 text-[var(--text-secondary)]">
            {{ confirmingCount }} items use this option. Removing it will clear those values. Remove anyway?
          </div>
          <div class="flex items-center gap-2">
            <AppButton @click="confirmRemoveChoice">Confirm</AppButton>
            <AppButton severity="secondary" text @click="cancelRemoveChoice">Cancel</AppButton>
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
import type { FieldOptions, ItemDataValue, MultiselectFieldOptions, SelectFieldOptions } from "../../../types/models";
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

const confirmingChoice = ref<string | null>(null);
const confirmingCount = ref(0);

const choices = computed(() => props.modelValue.choices ?? []);
const selectDefault = computed(() => (props.modelValue as SelectFieldOptions).defaultValue ?? null);
const multiselectDefault = computed(() => (props.modelValue as MultiselectFieldOptions).defaultValue ?? []);

function emitOptions(next: FieldOptions) {
  emit("update:modelValue", next);
}

function updateChoice(index: number, value: string | null | undefined) {
  const nextValue = value ?? "";
  const next = [...choices.value];
  const previous = next[index];
  next[index] = nextValue;
  let nextOptions: FieldOptions = { ...props.modelValue, choices: next } as FieldOptions;

  if (props.type === "select" && selectDefault.value === previous) {
    nextOptions = { ...nextOptions, defaultValue: nextValue || null } as FieldOptions;
  }

  if (props.type === "multiselect") {
    const current = multiselectDefault.value;
    if (current.includes(previous)) {
      const updated = current.map((entry) => (entry === previous ? nextValue : entry)).filter(Boolean);
      nextOptions = { ...nextOptions, defaultValue: updated.length > 0 ? updated : null } as FieldOptions;
    }
  }

  emitOptions(nextOptions);
}

function addChoice() {
  emitOptions({ ...props.modelValue, choices: [...choices.value, ""] } as FieldOptions);
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
  const next = choices.value.filter((option) => option !== choice);
  let nextOptions: FieldOptions = { ...props.modelValue, choices: next } as FieldOptions;

  if (props.type === "select" && selectDefault.value === choice) {
    nextOptions = { ...nextOptions, defaultValue: null } as FieldOptions;
  }

  if (props.type === "multiselect" && multiselectDefault.value.includes(choice)) {
    const updated = multiselectDefault.value.filter((entry) => entry !== choice);
    nextOptions = { ...nextOptions, defaultValue: updated.length > 0 ? updated : null } as FieldOptions;
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

    const parsed = parseMultiselectValue((value as ItemDataValue | undefined) ?? null);
    if (parsed.includes(choice)) {
      count += 1;
    }
  }
  return count;
}
</script>
