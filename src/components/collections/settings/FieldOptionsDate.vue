<template>
  <div class="space-y-3">
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Format</div>
      <AppSelect
        :modelValue="dateFormat"
        :options="dateFormatOptions"
        optionLabel="label"
        optionValue="value"
        class="w-full"
        @update:modelValue="value => updateDateFormat(String(value ?? 'YYYY-MM-DD'))"
      />
    </div>

    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Highlight Dates</div>
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-2 md:flex-row">
          <AppSelect
            :modelValue="highlightType"
            :options="highlightTypeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full md:w-24"
            @update:modelValue="value => updateHighlight('type', String(value ?? ''))"
          />
          <AppSelect
            :modelValue="highlightTarget"
            :options="highlightTargetOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full md:w-40"
            @update:modelValue="value => updateHighlightTarget(String(value ?? 'date'))"
          />
          <input
            v-if="highlightTarget === 'date'"
            :value="highlightDateValue"
            type="date"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            @input="event => updateHighlightDate((event.target as HTMLInputElement).value || null)"
          />
          <AppInput
            :modelValue="highlightColor"
            placeholder="#ff4400"
            class="w-full md:w-40"
            @update:modelValue="value => updateHighlight('color', value)"
          />
        </div>
      </div>
      <div v-if="highlightIncomplete" class="mt-1 text-base text-[var(--danger)]">
        Highlight rules require type and color. A custom-date target also requires a date.
      </div>
    </div>

    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Default Value</div>
      <div class="space-y-2">
        <AppSelect
          :modelValue="dateDefaultMode"
          :options="dateDefaultOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
          @update:modelValue="value => updateDateDefaultMode(String(value ?? 'none'))"
        />
        <input
          v-if="dateDefaultMode === 'custom'"
          :value="dateDefaultValue"
          type="date"
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
          @input="event => updateDateDefaultValue((event.target as HTMLInputElement).value || null)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import type { DateFieldOptions, DateFormat, DateHighlightRule } from "../../../types/models";
import { formatDateForStorage } from "../../../utils/date";

const props = defineProps<{
  modelValue: DateFieldOptions;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: DateFieldOptions): void;
}>();

const dateFormatOptions = [
  { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
  { label: "YYYY.MM.DD", value: "YYYY.MM.DD" },
  { label: "DD-MM-YYYY", value: "DD-MM-YYYY" },
  { label: "DD.MM.YYYY", value: "DD.MM.YYYY" },
];

const highlightTypeOptions = [
  { label: "None", value: "" },
  { label: "<", value: "<" },
  { label: ">", value: ">" },
];

const highlightTargetOptions = [
  { label: "Custom date", value: "date" },
  { label: "Current", value: "current" },
];

const dateDefaultOptions = [
  { label: "None", value: "none" },
  { label: "Current date", value: "current" },
  { label: "Custom date", value: "custom" },
];

const dateFormat = computed(() => (props.modelValue.format ?? "YYYY-MM-DD") as DateFormat);
const highlightType = computed(() => props.modelValue.highlight?.type ?? "");
const highlightColor = computed(() => props.modelValue.highlight?.color ?? "");
const highlightDateValue = computed(() => props.modelValue.highlight?.date ?? "");
const highlightTarget = computed(() => props.modelValue.highlight?.target ?? "date");

const highlightIncomplete = computed(() => {
  const highlight = props.modelValue.highlight;
  if (!highlight) return false;
  const hasType = Boolean(highlight.type);
  const hasColor = Boolean(highlight.color);
  const requiresDate = (highlight.target ?? "date") === "date";
  const hasDate = !requiresDate || Boolean(highlight.date);
  return (hasType || hasColor || Boolean(highlight.date)) && !(hasType && hasColor && hasDate);
});

const dateDefaultMode = computed(() => {
  const value = props.modelValue.defaultValue;
  if (value === "current") return "current";
  if (typeof value === "string" && value) return "custom";
  return "none";
});

const dateDefaultValue = computed(() => {
  const value = props.modelValue.defaultValue;
  return typeof value === "string" && value !== "current" ? value : "";
});

function emitOptions(next: DateFieldOptions) {
  emit("update:modelValue", next);
}

function updateDateFormat(value: string) {
  emitOptions({ ...props.modelValue, format: value as DateFormat });
}

function updateHighlight(key: "type" | "color", value: string) {
  if (key === "type" && !value) {
    emitOptions({ ...props.modelValue, highlight: null });
    return;
  }

  const next = props.modelValue.highlight
    ? ({ ...props.modelValue.highlight, [key]: value } as DateHighlightRule)
    : ({ type: "<", target: "date", date: "", color: "" } as DateHighlightRule);

  if (key === "type") {
    next.type = value as "<" | ">";
  } else {
    next.color = value;
  }

  emitOptions({ ...props.modelValue, highlight: !next.type && !next.color ? null : next });
}

function updateHighlightDate(value: string | null) {
  const next = props.modelValue.highlight
    ? ({ ...props.modelValue.highlight, date: value ?? "" } as DateHighlightRule)
    : ({ type: "<", target: "date", date: value ?? "", color: "" } as DateHighlightRule);

  emitOptions({ ...props.modelValue, highlight: !next.type && !next.color ? null : next });
}

function updateHighlightTarget(value: string) {
  const next = props.modelValue.highlight
    ? ({ ...props.modelValue.highlight } as DateHighlightRule)
    : ({ type: "<", target: "date", date: "", color: "" } as DateHighlightRule);

  next.target = value === "current" ? "current" : "date";
  if (next.target === "current") {
    next.date = null;
  } else if (!next.date) {
    next.date = formatDateForStorage(new Date());
  }

  emitOptions({ ...props.modelValue, highlight: next });
}

function updateDateDefaultMode(mode: string) {
  if (mode === "none") {
    emitOptions({ ...props.modelValue, defaultValue: null });
    return;
  }
  if (mode === "current") {
    emitOptions({ ...props.modelValue, defaultValue: "current" });
    return;
  }

  const existing = props.modelValue.defaultValue;
  if (typeof existing === "string" && existing && existing !== "current") {
    emitOptions({ ...props.modelValue, defaultValue: existing });
    return;
  }

  emitOptions({ ...props.modelValue, defaultValue: formatDateForStorage(new Date()) });
}

function updateDateDefaultValue(value: string | null) {
  emitOptions({ ...props.modelValue, defaultValue: value || null });
}
</script>
