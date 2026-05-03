import type { Field, ItemSortSpec, ViewConfig } from "../types/models";

export const MIN_VIEW_COLUMN_WIDTH = 60;

export type NormalizedViewConfig = Omit<
  ViewConfig,
  "columnWidths" | "sort" | "selectedFieldIds"
> & {
  columnWidths: Record<number, number>;
  sort: ItemSortSpec[];
  selectedFieldIds: number[];
};

function normalizePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function normalizeSelectedFieldIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<number>();
  const normalized: number[] = [];
  for (const entry of value) {
    const parsed = Number(entry);
    if (!Number.isInteger(parsed) || parsed <= 0 || seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    normalized.push(parsed);
  }
  return normalized;
}

export function normalizeColumnWidths(
  value: Record<number, number> | Record<string, number> | undefined,
  allowedFieldIds?: Set<number>,
): Record<number, number> {
  if (!value) {
    return {};
  }

  const normalized: Record<number, number> = {};
  for (const [fieldId, width] of Object.entries(value)) {
    const parsedFieldId = Number(fieldId);
    if (!Number.isInteger(parsedFieldId) || parsedFieldId <= 0) {
      continue;
    }
    if (allowedFieldIds && !allowedFieldIds.has(parsedFieldId)) {
      continue;
    }

    const parsedWidth = Number(width);
    if (!Number.isFinite(parsedWidth)) {
      continue;
    }

    normalized[parsedFieldId] = Math.max(
      MIN_VIEW_COLUMN_WIDTH,
      Math.round(parsedWidth),
    );
  }

  return normalized;
}

export function normalizeSortSpecs(sort: ItemSortSpec[] | undefined): ItemSortSpec[] {
  if (!Array.isArray(sort)) {
    return [];
  }

  return sort
    .filter((entry) => typeof entry.field === "string")
    .map((entry) => ({
      field: String(entry.field),
      order: entry.order === -1 ? -1 : 1,
      emptyPlacement: entry.emptyPlacement === "first" ? "first" : "last",
    }));
}

export function normalizeKanbanColumnOrder(
  value: unknown,
  availableOptions?: string[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    return availableOptions?.length ? [...availableOptions] : undefined;
  }

  const allowed = availableOptions ? new Set(availableOptions) : null;
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    if (allowed && !allowed.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  if (availableOptions) {
    for (const option of availableOptions) {
      if (!seen.has(option)) {
        normalized.push(option);
      }
    }
  }

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCalendarDateField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildDefaultViewConfig(
  overrides: Partial<ViewConfig> = {},
): NormalizedViewConfig {
  return normalizeViewConfig({
    columnWidths: {},
    sort: [],
    selectedFieldIds: [],
    ...overrides,
  });
}

export function mergeViewConfig(
  base: ViewConfig | null | undefined,
  overrides: Partial<ViewConfig>,
): NormalizedViewConfig {
  const normalizedBase = normalizeViewConfig(base);

  return normalizeViewConfig({
    ...normalizedBase,
    ...overrides,
  });
}

export function normalizeViewConfig(
  config: ViewConfig | null | undefined,
): NormalizedViewConfig {
  const normalized: NormalizedViewConfig = {
    columnWidths: normalizeColumnWidths(config?.columnWidths),
    sort: normalizeSortSpecs(config?.sort),
    calendarDateField: normalizeCalendarDateField(config?.calendarDateField),
    calendarDateFieldId: normalizePositiveInt(config?.calendarDateFieldId),
    groupingFieldId: normalizePositiveInt(config?.groupingFieldId),
    kanbanColumnOrder: normalizeKanbanColumnOrder(config?.kanbanColumnOrder),
    selectedFieldIds: normalizeSelectedFieldIds(config?.selectedFieldIds),
  };
  const cardTitleFieldId = normalizePositiveInt(config?.cardTitleFieldId);
  if (cardTitleFieldId !== undefined) {
    normalized.cardTitleFieldId = cardTitleFieldId;
  }
  return normalized;
}

export function areViewConfigFieldSelectionsEqual(
  a: number[],
  b: number[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((entry, index) => entry === b[index]);
}

export function getOrderedFieldIds(fields: Field[]): number[] {
  return [...fields]
    .sort((a, b) => {
      if (a.order_index !== b.order_index) {
        return a.order_index - b.order_index;
      }
      return a.id - b.id;
    })
    .map((field) => field.id);
}
