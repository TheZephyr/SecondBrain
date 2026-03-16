import { computed, type Ref } from "vue";
import type { Field, Item } from "../../types/models";
import type { ItemFormData } from "./useCollectionItemForm";
import { parseFieldOptions } from "../../utils/fieldOptions";
import { normalizeUniqueKey } from "../../utils/fieldUnique";

type UseFieldUniqueCheckParams = {
  items: Ref<Item[]>;
  fields: Ref<Field[]>;
  formData: Ref<ItemFormData>;
  editingItemId: Ref<number | null>;
};

export function useFieldUniqueCheck({
  items,
  fields,
  formData,
  editingItemId,
}: UseFieldUniqueCheckParams) {
  const duplicateFields = computed(() => {
    const duplicates = new Set<string>();
    const currentItems = items.value;
    const currentEditingId = editingItemId.value;

    for (const field of fields.value) {
      const options = parseFieldOptions(field.type, field.options) as {
        uniqueCheck?: boolean;
      };
      if (!options.uniqueCheck) continue;

      const currentKey = normalizeUniqueKey(
        field,
        formData.value[field.name] as unknown as string,
      );
      if (!currentKey) {
        continue;
      }

      for (const item of currentItems) {
        if (currentEditingId && item.id === currentEditingId) {
          continue;
        }

        const itemKey = normalizeUniqueKey(field, item.data[field.name]);
        if (itemKey && itemKey === currentKey) {
          duplicates.add(field.name);
          break;
        }
      }
    }

    return duplicates;
  });

  return {
    duplicateFields,
  };
}
