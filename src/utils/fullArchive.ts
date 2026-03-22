import type {
  FullArchiveFile,
  FullArchivePreview,
} from "../types/models";
import {
  FULL_ARCHIVE_VERSION,
  FullArchiveFileSchema,
} from "../validation/schemas";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function summarizeIssues(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => {
      const path =
        issue.path.length > 0
          ? issue.path.map((part) => String(part)).join(".")
          : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function buildFullArchiveFileName(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `secondbrain_archive_${year}-${month}-${day}_${hours}-${minutes}.json`;
}

export function parseFullArchiveContent(content: string): FullArchiveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid archive JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = FullArchiveFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid archive structure: ${summarizeIssues(parsed.error)}`,
    );
  }

  if (parsed.data.version > FULL_ARCHIVE_VERSION) {
    throw new Error(
      `Archive version ${parsed.data.version} is not supported. Update the app before importing this archive.`,
    );
  }

  return parsed.data as FullArchiveFile;
}

export function buildFullArchivePreviewSummary(
  filePath: string,
  archive: FullArchiveFile,
  currentDbSummary: FullArchivePreview["currentDbSummary"],
): FullArchivePreview {
  return {
    filePath,
    archiveSummary: {
      appVersion: archive.appVersion,
      exportedAt: archive.exportedAt,
      description: archive.description,
      stats: archive.stats,
      collections: archive.collections.map((collection) => ({
        name: collection.name,
        stats: collection.stats,
      })),
    },
    currentDbSummary,
    willReplaceExistingData: !currentDbSummary.isEmpty,
  };
}
