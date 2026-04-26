<template>
  <div class="space-y-4">
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-(--text-muted)">
        Default Value
      </div>
      <AppNumberField
        :modelValue="defaultValue"
        inputClass="w-full"
        class="w-full"
        @update:modelValue="updateDefaultValue"
      />
    </div>

    <div class="flex items-center justify-between gap-2">
      <div class="text-base text-(--text-secondary)">Show as chip</div>
      <AppSwitch
        :modelValue="showAsChip"
        @update:modelValue="updateShowAsChip"
      />
    </div>

    <div class="flex items-center justify-between gap-2">
      <div class="text-base text-(--text-secondary)">
        Show thousands separator
      </div>
      <AppSwitch
        :modelValue="showThousandsSeparator"
        @update:modelValue="updateThousandsSeparator"
      />
    </div>

    <div class="space-y-3">
      <div class="text-base font-semibold uppercase text-(--text-muted)">
        Color Scale
      </div>
      <AppSelect
        :modelValue="colorScaleMode"
        :options="colorScaleModes"
        optionLabel="label"
        optionValue="value"
        class="w-full"
        @update:modelValue="updateColorScaleMode"
      />
      <AppSelect
        v-if="colorScaleMode !== 'none'"
        :modelValue="colorScaleStyle"
        :options="colorScaleStyles"
        optionLabel="label"
        optionValue="value"
        class="w-full"
        @update:modelValue="updateColorScaleStyle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppNumberField from "@/components/app/ui/AppNumberField.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import AppSwitch from "@/components/app/ui/AppSwitch.vue";
import type { NumberFieldOptions } from "../../../types/models";

const props = defineProps<{
  modelValue: NumberFieldOptions;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: NumberFieldOptions): void;
}>();

const colorScaleModes = [
  { label: "None", value: "none" },
  { label: "Red to green", value: "ascending" },
  { label: "Green to red", value: "descending" },
];

const colorScaleStyles = [
  { label: "Font color", value: "text" },
  { label: "Background color", value: "background" },
];

const defaultValue = computed(() =>
  typeof props.modelValue.defaultValue === "number"
    ? props.modelValue.defaultValue
    : null,
);
const showAsChip = computed(() => Boolean(props.modelValue.showAsChip));
const showThousandsSeparator = computed(() =>
  Boolean(props.modelValue.showThousandsSeparator),
);
const colorScaleMode = computed(
  () => props.modelValue.colorScale?.direction ?? "none",
);
const colorScaleStyle = computed(
  () => props.modelValue.colorScale?.style ?? "text",
);

function emitOptions(next: NumberFieldOptions) {
  emit("update:modelValue", next);
}

function updateDefaultValue(value: number | null) {
  emitOptions({
    ...props.modelValue,
    defaultValue: Number.isFinite(value) ? Number(value) : null,
  });
}

function updateShowAsChip(value: boolean) {
  emitOptions({ ...props.modelValue, showAsChip: value });
}

function updateThousandsSeparator(value: boolean) {
  emitOptions({ ...props.modelValue, showThousandsSeparator: value });
}

function updateColorScaleMode(value: string | number | null) {
  const direction =
    value === "ascending" || value === "descending" ? value : null;
  emitOptions({
    ...props.modelValue,
    colorScale: direction
      ? {
          direction,
          style: colorScaleStyle.value === "background" ? "background" : "text",
        }
      : null,
  });
}

function updateColorScaleStyle(value: string | number | null) {
  const style = value === "background" ? "background" : "text";
  emitOptions({
    ...props.modelValue,
    colorScale: props.modelValue.colorScale
      ? { ...props.modelValue.colorScale, style }
      : {
          direction: "ascending",
          style,
        },
  });
}
</script>
