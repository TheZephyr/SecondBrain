import type {
  Field,
  FieldOptions,
  FieldType,
  MultiselectFieldOptions,
  NumberFieldOptions,
  RatingFieldOptions,
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
      return { choices: [], optionColors: {} } as SelectFieldOptions;
    case "multiselect":
      return { choices: [], optionColors: {} } as MultiselectFieldOptions;
    case "boolean":
      return { icon: "square" };
    case "rating":
      return {
        icon: "star",
        color: "currentColor",
        optionColors: {},
        min: 0,
        max: 5,
      } as RatingFieldOptions;
    case "date":
      return { format: "YYYY-MM-DD" };
    case "longtext":
      return { richText: false };
    case "number":
      return {
        showAsChip: false,
        showThousandsSeparator: false,
        colorScale: null,
      } as NumberFieldOptions;
    default:
      return {};
  }
}

export function getSelectChoices(field: Field): string[] {
  const opts = parseFieldOptions(field.type, field.options) as SelectFieldOptions;
  return opts.choices ?? [];
}

export function getSelectOptionColors(
  field: Field,
): Record<string, string> {
  const opts = parseFieldOptions(field.type, field.options) as
    | SelectFieldOptions
    | MultiselectFieldOptions;

  return opts.optionColors ?? {};
}

export function getSelectChoiceColor(
  field: Field,
  choice: string,
): string | null {
  const optionColors = getSelectOptionColors(field);
  const color = optionColors[choice];
  return typeof color === "string" && color.trim().length > 0 ? color : null;
}

export function getRatingOptionColors(field: Field): Record<string, string> {
  const opts = parseFieldOptions(field.type, field.options) as RatingFieldOptions;
  return opts.optionColors ?? {};
}

export function getRatingValueColor(
  field: Field,
  value: number | null | undefined,
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const optionColors = getRatingOptionColors(field);
  const color = optionColors[String(value)];
  return typeof color === "string" && color.trim().length > 0 ? color : null;
}
