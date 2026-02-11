export const SAFE_FIELD_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

export const RESERVED_FIELD_NAMES = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

export function normalizeFieldName(value: string): string {
  return value.trim();
}

export function isSafeFieldName(value: string): boolean {
  const normalized = normalizeFieldName(value);

  if (normalized !== value) return false;
  if (!normalized || normalized.includes(".")) return false;
  if (!SAFE_FIELD_NAME_REGEX.test(normalized)) return false;

  return !RESERVED_FIELD_NAMES.has(normalized.toLowerCase());
}
