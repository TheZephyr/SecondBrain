<template>
  <Select
    :model-value="stringValue"
    :disabled="disabled"
    @update:model-value="onUpdate"
  >
    <SelectTrigger :id="inputId" :class="triggerClass">
      <slot
        name="value"
        :option="selectedOption?.raw ?? null"
        :value="selectedOption?.value ?? null"
      >
        <SelectValue :placeholder="placeholder">
          {{ selectedOption?.label }}
        </SelectValue>
      </slot>
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="option in normalizedOptions"
        :key="option.key"
        :value="option.key"
      >
        <slot name="option" :option="option.raw">
          {{ option.label }}
        </slot>
      </SelectItem>
    </SelectContent>
  </Select>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HTMLAttributes } from "vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PrimitiveValue = string | number | null;
type SelectOption = Record<string, unknown> | PrimitiveValue;
const EMPTY_STRING_OPTION_KEY_PREFIX = "__app_select_empty__";

const props = defineProps<{
  modelValue?: string | number | null;
  options: SelectOption[];
  optionLabel?: string;
  optionValue?: string;
  placeholder?: string;
  disabled?: boolean;
  inputId?: string;
  class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: PrimitiveValue): void;
}>();

function toPrimitiveValue(
  value: unknown,
  fallback: PrimitiveValue,
): PrimitiveValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    value === null
  ) {
    return value;
  }

  return fallback;
}

const normalizedOptions = computed(() =>
  props.options.map((option, index) => {
    if (option !== null && typeof option === "object") {
      const labelKey = props.optionLabel ?? "label";
      const valueKey = props.optionValue ?? "value";
      const rawLabel = option[labelKey];
      const rawValue = option[valueKey];
      const value = toPrimitiveValue(rawValue ?? rawLabel, index);
      const key =
        value === ""
          ? `${EMPTY_STRING_OPTION_KEY_PREFIX}${index}`
          : String(value);
      return {
        key,
        value,
        label: String(rawLabel ?? rawValue ?? value),
        raw: option,
      };
    }

    const value = option;
    const key =
      value === ""
        ? `${EMPTY_STRING_OPTION_KEY_PREFIX}${index}`
        : String(value ?? "");
    return {
      key,
      value,
      label: String(option ?? ""),
      raw: option,
    };
  }),
);

const selectedOption = computed(
  () =>
    normalizedOptions.value.find(
      (option) => option.value === props.modelValue,
    ) ?? null,
);

const stringValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) {
    return undefined;
  }

  return String(props.modelValue);
});

const triggerClass = computed(() => cn("w-full", props.class));

function onUpdate(value: unknown) {
  const selected = normalizedOptions.value.find(
    (option) => option.key === String(value),
  );
  emit("update:modelValue", selected?.value ?? null);
}
</script>
