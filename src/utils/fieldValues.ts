import type { ItemDataValue } from "../types/models";

export function parseMultiselectValue(value: ItemDataValue | undefined | null): string[] {
  if (typeof value !== "string" || value.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export function serializeMultiselectValue(values: string[] | null | undefined): string | null {
  if (!values || values.length === 0) return null;
  return JSON.stringify(values);
}

export function parseBooleanValue(value: ItemDataValue | undefined | null): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1";
  return Boolean(value);
}

export function serializeBooleanValue(value: boolean | string | number | null | undefined): string {
  if (value === true || value === "1" || value === 1) return "1";
  return "0";
}

export function parseRatingValue(value: ItemDataValue | undefined | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function serializeRatingValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}
