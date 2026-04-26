<template>
  <div class="space-y-4">
    <FieldOptionsDate
      v-if="type === 'date'"
      :modelValue="modelValue as DateFieldOptions"
      @update:modelValue="onUpdate"
    />
    <FieldOptionsNumber
      v-else-if="type === 'number'"
      :modelValue="modelValue as NumberFieldOptions"
      @update:modelValue="onUpdate"
    />
    <FieldOptionsSelect
      v-else-if="type === 'select' || type === 'multiselect'"
      :modelValue="modelValue as SelectFieldOptions | MultiselectFieldOptions"
      :type="type"
      :items="items"
      :fieldName="fieldName"
      @update:modelValue="onUpdate"
    />
    <FieldOptionsRating
      v-else-if="type === 'rating'"
      :modelValue="modelValue as RatingFieldOptions"
      @update:modelValue="onUpdate"
    />
    <FieldOptionsBoolean
      v-else-if="type === 'boolean'"
      :modelValue="modelValue as BooleanFieldOptions"
      @update:modelValue="onUpdate"
    />
    <template v-else-if="type === 'longtext'">
      <div class="flex items-center justify-between gap-2">
        <div class="text-base text-(--text-secondary)">Enable rich text</div>
        <AppSwitch
          :modelValue="Boolean((modelValue as LongTextFieldOptions).richText)"
          @update:modelValue="
            (value) => emitOptions({ ...props.modelValue, richText: value })
          "
        />
      </div>
    </template>

    <template v-if="type !== 'boolean'">
      <div class="flex items-center justify-between gap-2">
        <div class="text-base text-(--text-secondary)">
          Check for unique values
        </div>
        <AppSwitch
          :modelValue="uniqueCheck"
          @update:modelValue="(value) => updateUniqueCheck(value)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppSwitch from "@/components/app/ui/AppSwitch.vue";
import type {
  BooleanFieldOptions,
  DateFieldOptions,
  FieldOptions,
  FieldType,
  LongTextFieldOptions,
  MultiselectFieldOptions,
  NumberFieldOptions,
  RatingFieldOptions,
  SelectFieldOptions,
} from "../../../types/models";
import FieldOptionsBoolean from "./FieldOptionsBoolean.vue";
import FieldOptionsDate from "./FieldOptionsDate.vue";
import FieldOptionsNumber from "./FieldOptionsNumber.vue";
import FieldOptionsRating from "./FieldOptionsRating.vue";
import FieldOptionsSelect from "./FieldOptionsSelect.vue";

const props = defineProps<{
  type: FieldType;
  modelValue: FieldOptions;
  items?: Array<{ data: Record<string, unknown> }>;
  fieldName?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: FieldOptions): void;
}>();

const uniqueCheck = computed(() =>
  Boolean((props.modelValue as { uniqueCheck?: boolean }).uniqueCheck),
);

function emitOptions(next: FieldOptions) {
  emit("update:modelValue", next);
}

function updateUniqueCheck(value: boolean) {
  emitOptions({ ...props.modelValue, uniqueCheck: value });
}

function onUpdate(value: FieldOptions) {
  emit("update:modelValue", value);
}
</script>
