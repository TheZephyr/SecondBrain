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

      <div v-if="colorScaleMode === 'custom'" class="mt-2 space-y-3">
        <div class="flex flex-col gap-1">
          <div class="text-sm text-(--text-secondary)">Start Color</div>
          <div class="flex flex-wrap items-center gap-2">
            <input
              type="color"
              :value="normalizeColor(customStartColor)"
              class="h-9 w-12 cursor-pointer rounded-md border border-(--border-color) bg-transparent p-1"
              @input="(event) => updateCustomStartColor((event.target as HTMLInputElement).value)"
            />
            <AppInput
              :modelValue="customStartColor"
              placeholder="#ffffff"
              class="w-32"
              @update:modelValue="(value) => updateCustomStartColor(value ?? '')"
            />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="text-sm text-(--text-secondary)">End Color</div>
          <div class="flex flex-wrap items-center gap-2">
            <input
              type="color"
              :value="normalizeColor(customEndColor)"
              class="h-9 w-12 cursor-pointer rounded-md border border-(--border-color) bg-transparent p-1"
              @input="(event) => updateCustomEndColor((event.target as HTMLInputElement).value)"
            />
            <AppInput
              :modelValue="customEndColor"
              placeholder="#000000"
              class="w-32"
              @update:modelValue="(value) => updateCustomEndColor(value ?? '')"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppNumberField from "@/components/app/ui/AppNumberField.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import AppSwitch from "@/components/app/ui/AppSwitch.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
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
  { label: "Custom", value: "custom" },
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
const customStartColor = computed(() => props.modelValue.colorScale?.startColor ?? "");
const customEndColor = computed(() => props.modelValue.colorScale?.endColor ?? "");

function normalizeColor(value: string) {
  return /^#[\da-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#000000";
}

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
    value === "ascending" || value === "descending" || value === "custom" ? value : null;
  emitOptions({
    ...props.modelValue,
    colorScale: direction
      ? {
          direction,
          style: colorScaleStyle.value === "background" ? "background" : "text",
          startColor: direction === "custom" ? customStartColor.value : undefined,
          endColor: direction === "custom" ? customEndColor.value : undefined,
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

function updateCustomStartColor(value: string) {
  if (props.modelValue.colorScale?.direction !== "custom") return;
  emitOptions({
    ...props.modelValue,
    colorScale: {
      ...props.modelValue.colorScale,
      startColor: value.trim()
    }
  });
}

function updateCustomEndColor(value: string) {
  if (props.modelValue.colorScale?.direction !== "custom") return;
  emitOptions({
    ...props.modelValue,
    colorScale: {
      ...props.modelValue.colorScale,
      endColor: value.trim()
    }
  });
}
</script>
