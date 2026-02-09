import type {
  Field,
  Item,
  ItemData,
  ItemDataValue,
  ExportFormat,
} from "../types/models";

export type ImportRow = Record<string, ItemDataValue | undefined>;

export type ImportPreview = {
  itemCount: number;
  fields: string[];
  newFields: string[];
  matchedFields: string[];
  sample: ImportRow[];
};

export type ParsedImportData = {
  rows: ImportRow[];
  fields: string[];
};

export function escapeCsvValue(value: ItemDataValue | undefined): string {
  if (value === null || value === undefined) {
    return "\"\"";
  }

  const stringValue = String(value);
  const escapedValue = stringValue.replace(/"/g, "\"\"");
  return `"${escapedValue}"`;
}

function sortFields(fields: Field[]): Field[] {
  return [...fields].sort((a, b) => a.order_index - b.order_index);
}

export function serializeItemsToCsv(items: Item[], fields: Field[]): string {
  const ordered = sortFields(fields);
  const headers = ordered.map((field) => escapeCsvValue(field.name));
  const csvLines = [headers.join(",")];

  for (const item of items) {
    const row = ordered.map((field) => {
      const value = item.data[field.name];
      return escapeCsvValue(value);
    });
    csvLines.push(row.join(","));
  }

  return csvLines.join("\n");
}

export function serializeItemsToJson(items: Item[], fields: Field[]): string {
  const ordered = sortFields(fields);
  const exportData = items.map((item) => {
    const orderedData: ItemData = {};
    for (const field of ordered) {
      orderedData[field.name] = item.data[field.name] ?? "";
    }
    return orderedData;
  });

  return JSON.stringify(exportData, null, 2);
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseImportContent(
  format: ExportFormat,
  content: string,
): ParsedImportData {
  if (format === "csv") {
    const lines = content.trim().split("\n");
    if (lines.length === 0) {
      throw new Error("EMPTY_CSV");
    }

    const headerLine = lines[0];
    const fileFields = parseCsvLine(headerLine);
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: ImportRow = {};
      for (let j = 0; j < fileFields.length; j++) {
        row[fileFields[j]] = values[j] || "";
      }
      rows.push(row);
    }

    return { rows, fields: fileFields };
  }

  const parsed = JSON.parse(content) as ImportRow[];
  if (!Array.isArray(parsed)) {
    throw new Error("JSON_NOT_ARRAY");
  }

  const fields = parsed.length > 0 ? Object.keys(parsed[0]) : [];
  return { rows: parsed, fields };
}

export function buildImportPreview(
  parsed: ParsedImportData,
  existingFields: Field[],
): ImportPreview {
  const matchedFields: string[] = [];
  const newFields: string[] = [];
  const fieldMap = new Map<string, string>();

  existingFields.forEach((field) =>
    fieldMap.set(field.name.toLowerCase(), field.name),
  );

  parsed.fields.forEach((fileField) => {
    if (fieldMap.has(fileField.toLowerCase())) {
      matchedFields.push(fileField);
    } else {
      newFields.push(fileField);
    }
  });

  return {
    itemCount: parsed.rows.length,
    fields: parsed.fields,
    newFields,
    matchedFields,
    sample: parsed.rows.slice(0, 3),
  };
}
