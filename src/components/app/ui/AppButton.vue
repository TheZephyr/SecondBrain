<template>
  <Button
    :type="type"
    :variant="buttonVariant"
    :size="buttonSize"
    :disabled="disabled || loading"
    :class="buttonClass"
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <Loader2 v-if="loading" class="size-4 animate-spin" />
    <slot v-else name="icon" />
    <slot>
      {{ label }}
    </slot>
  </Button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HTMLAttributes } from "vue";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Severity = "secondary" | "danger" | "info" | "success" | undefined;

const props = withDefaults(defineProps<{
  label?: string;
  severity?: Severity;
  text?: boolean;
  outlined?: boolean;
  rounded?: boolean;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  class?: HTMLAttributes["class"];
}>(), {
  label: undefined,
  severity: undefined,
  text: false,
  outlined: false,
  rounded: false,
  loading: false,
  disabled: false,
  type: "button",
  class: undefined,
});

defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const buttonVariant = computed(() => {
  if (props.text) {
    if (props.severity === "danger") {
      return "ghost";
    }
    return "ghost";
  }

  if (props.outlined) {
    return props.severity === "danger" ? "destructive" : "outline";
  }

  if (props.severity === "secondary" || props.severity === "info") {
    return "secondary";
  }

  if (props.severity === "danger") {
    return "destructive";
  }

  return "default";
});

const buttonSize = computed(() => {
  if (props.rounded && !props.label) {
    return "icon";
  }

  return "default";
});

const buttonClass = computed(() =>
  cn(
    props.rounded ? "rounded-full" : undefined,
    props.text && props.severity === "danger" ? "text-[var(--danger)] hover:text-[var(--danger)]" : undefined,
    props.class,
  ),
);
</script>
