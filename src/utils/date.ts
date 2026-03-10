import type { ItemDataValue } from "../types/models";

export type MonthGridCell = {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function parseDateValue(
  value: ItemDataValue | Date | null | undefined,
): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const date = new Date(year, month, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateForStorage(
  value: ItemDataValue | Date | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : parseDateValue(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(
  value: ItemDataValue | Date | null | undefined,
): string {
  const date = parseDateValue(value);
  if (!date) return "-";
  return date.toLocaleDateString();
}

function startOfMondayWeek(date: Date): Date {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildMonthGrid(
  year: number,
  monthIndex: number,
  today = new Date(),
): MonthGridCell[] {
  const monthStart = new Date(year, monthIndex, 1);
  const gridStart = startOfMondayWeek(monthStart);
  const todayKey = formatDateKey(today);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );

    return {
      key: formatDateKey(date),
      date,
      isCurrentMonth: date.getMonth() === monthIndex,
      isToday: formatDateKey(date) === todayKey,
    };
  });
}

export function formatMonthYear(
  year: number,
  monthIndex: number,
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
}
