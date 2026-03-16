import type { Field, ItemDataValue } from "../types/models";
import { formatDateForStorage } from "./date";
import {
  parseBooleanValue,
  parseMultiselectValue,
  parseRatingValue,
} from "./fieldValues";

export function normalizeUniqueKey(
  field: Field,
  value: ItemDataValue | Date | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") {
    if (field.type === "boolean") {
      return parseBooleanValue(value) ? "1" : "0";
    }
    return null;
  }

  if (field.type === "date") {
    const formatted = formatDateForStorage(value);
    return formatted ? formatted : null;
  }

  if (field.type === "number" || field.type === "rating") {
    const parsed = parseRatingValue(value as ItemDataValue);
    return parsed === null ? null : String(parsed);
  }

  if (field.type === "multiselect") {
    const parsed = parseMultiselectValue(value as ItemDataValue);
    if (parsed.length === 0) return null;
    return JSON.stringify(parsed);
  }

  if (field.type === "boolean") {
    return parseBooleanValue(value as ItemDataValue) ? "1" : "0";
  }

  if (field.type === "select") {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
  }

  return String(value);
}
