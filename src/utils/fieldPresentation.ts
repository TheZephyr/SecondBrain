import type {
  DateFieldOptions,
  DateHighlightRule,
  ItemDataValue,
  NumberFieldOptions,
  NumberFieldRange,
} from "../types/models";
import { parseDateValue } from "./date";

const SCALE_PRESETS = {
  ascending: { min: "#cf3f3f", max: "#35a46f" },
  descending: { min: "#35a46f", max: "#cf3f3f" },
} as const;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseHexColor(value: string): RgbColor | null {
  const normalized = value.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  const int = Number.parseInt(expanded, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function toHexColor(color: RgbColor): string {
  const toPart = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

  return `#${toPart(color.r)}${toPart(color.g)}${toPart(color.b)}`;
}

function interpolateColor(start: string, end: string, ratio: number): string {
  const startRgb = parseHexColor(start);
  const endRgb = parseHexColor(end);
  if (!startRgb || !endRgb) {
    return end;
  }

  const boundedRatio = clamp(ratio, 0, 1);
  return toHexColor({
    r: startRgb.r + (endRgb.r - startRgb.r) * boundedRatio,
    g: startRgb.g + (endRgb.g - startRgb.g) * boundedRatio,
    b: startRgb.b + (endRgb.b - startRgb.b) * boundedRatio,
  });
}

function getContrastTextColor(backgroundColor: string): string {
  const rgb = parseHexColor(backgroundColor);
  if (!rgb) {
    return "var(--text-primary)";
  }

  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.62 ? "#111111" : "#f8f8f8";
}

export function formatNumberWithFieldOptions(
  value: ItemDataValue | null | undefined,
  options: NumberFieldOptions,
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  if (!options.showThousandsSeparator) {
    return String(numericValue);
  }

  const [integerPart, fractionalPart] = String(numericValue).split(".");
  const sign = integerPart.startsWith("-") ? "-" : "";
  const digits = sign ? integerPart.slice(1) : integerPart;
  const withSeparator = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return fractionalPart
    ? `${sign}${withSeparator}.${fractionalPart}`
    : `${sign}${withSeparator}`;
}

export function resolveNumberColorScaleStyle(
  value: ItemDataValue | null | undefined,
  options: NumberFieldOptions,
  range: NumberFieldRange | null | undefined,
): Record<string, string> {
  if (!options.colorScale || !range || range.min === null || range.max === null) {
    return {};
  }

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numericValue) || range.max === range.min) {
    return {};
  }

  const preset = SCALE_PRESETS[options.colorScale.direction];
  const ratio = (numericValue - range.min) / (range.max - range.min);
  const color = interpolateColor(preset.min, preset.max, ratio);

  if (options.colorScale.style === "background") {
    return {
      backgroundColor: color,
      color: getContrastTextColor(color),
      borderColor: color,
    };
  }

  return { color };
}

function normalizeDateForComparison(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function resolveHighlightTargetDate(
  highlight: DateHighlightRule | null | undefined,
  today = new Date(),
): Date | null {
  if (!highlight) {
    return null;
  }

  if (highlight.target === "current") {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  if (!highlight.date) {
    return null;
  }

  return parseDateValue(highlight.date);
}

export function resolveDateHighlightStyle(
  value: ItemDataValue | Date | null | undefined,
  options: DateFieldOptions,
  today = new Date(),
): Record<string, string> {
  const highlight = options.highlight;
  if (!highlight || !highlight.type || !highlight.color) {
    return {};
  }

  const valueDate = parseDateValue(value);
  const targetDate = resolveHighlightTargetDate(highlight, today);
  if (!valueDate || !targetDate) {
    return {};
  }

  const valueTime = normalizeDateForComparison(valueDate);
  const targetTime = normalizeDateForComparison(targetDate);
  const isMatch =
    highlight.type === "<" ? valueTime < targetTime : valueTime > targetTime;

  return isMatch ? { color: highlight.color } : {};
}
