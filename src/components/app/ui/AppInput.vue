<template>
  <Input
    :id="id"
    :model-value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autofocus"
    :class="class"
    @update:model-value="$emit('update:modelValue', String($event ?? ''))"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Input } from "@/components/ui/input";

defineProps<{
  modelValue?: string;
  id?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  autofocus?: boolean;
  class?: HTMLAttributes["class"];
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>
