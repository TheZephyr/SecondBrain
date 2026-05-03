<template>
  <NumberField
    :id="inputId"
    :model-value="modelValue ?? undefined"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :format-options="{ useGrouping: false }"
    :class="class"
    @update:model-value="onUpdate"
  >
    <NumberFieldContent>
      <NumberFieldDecrement v-if="showButtons" />
      <NumberFieldInput :class="inputClass" />
      <NumberFieldIncrement v-if="showButtons" />
    </NumberFieldContent>
  </NumberField>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";

const props = withDefaults(defineProps<{
  modelValue?: number | null;
  inputId?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showButtons?: boolean;
  class?: HTMLAttributes["class"];
  inputClass?: HTMLAttributes["class"];
}>(), {
  modelValue: null,
  inputId: undefined,
  min: undefined,
  max: undefined,
  step: 1,
  disabled: false,
  showButtons: false,
  class: undefined,
  inputClass: undefined,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: number | null): void;
}>();

function onUpdate(value: number | undefined) {
  emit("update:modelValue", value ?? null);
}
</script>
