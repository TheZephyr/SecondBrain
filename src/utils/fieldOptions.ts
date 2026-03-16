import type {
  Field,
  FieldOptions,
  FieldType,
  MultiselectFieldOptions,
  SelectFieldOptions,
} from "../types/models";

export function parseFieldOptions(
  type: FieldType,
  raw: string | null,
): FieldOptions {
  const defaults = getDefaultOptions(type);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as FieldOptions;
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }
    return { ...defaults, ...parsed } as FieldOptions;
  } catch {
    return defaults;
  }
}

export function serializeFieldOptions(options: FieldOptions): string {
  return JSON.stringify(options);
}

export function getDefaultOptions(type: FieldType): FieldOptions {
  switch (type) {
    case "select":
      return { choices: [] } as SelectFieldOptions;
    case "multiselect":
      return { choices: [] } as MultiselectFieldOptions;
    case "boolean":
      return { icon: "square" };
    case "rating":
      return { icon: "star", color: "currentColor", min: 0, max: 5 };
    case "date":
      return { format: "YYYY-MM-DD" };
    case "longtext":
      return { richText: false };
    default:
      return {};
  }
}

export function getSelectChoices(field: Field): string[] {
  const opts = parseFieldOptions(field.type, field.options) as SelectFieldOptions;
  return opts.choices ?? [];
}
