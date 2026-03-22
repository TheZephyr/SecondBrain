export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "boolean"
  | "url"
  | "rating";

export const FIELD_TYPE_META: Record<
  FieldType,
  { displayName: string; icon: string }
> = {
  text: { displayName: "Single Line Text", icon: "Type" },
  longtext: { displayName: "Long Text", icon: "TextInitial" },
  number: { displayName: "Number", icon: "Hash" },
  date: { displayName: "Date", icon: "Calendar" },
  select: { displayName: "Select", icon: "BadgeCheck" },
  multiselect: { displayName: "Multiselect", icon: "List" },
  boolean: { displayName: "Checkbox", icon: "Check" },
  url: { displayName: "URL", icon: "Link" },
  rating: { displayName: "Rating", icon: "Star" },
};

export type BooleanIcon =
  | "square"
  | "circle"
  | "heart"
  | "star"
  | "flame"
  | "thumbs-up"
  | "thumbs-down"
  | "flag";

export type DateFormat =
  | "YYYY-MM-DD"
  | "YYYY.MM.DD"
  | "DD-MM-YYYY"
  | "DD.MM.YYYY";

export type DateHighlightRule = {
  type: "<" | ">";
  date: string;
  color: string;
};

export type TextFieldOptions = {
  defaultValue?: string | null;
  uniqueCheck?: boolean;
};

export type LongTextFieldOptions = {
  richText?: boolean;
  defaultValue?: string | null;
  uniqueCheck?: boolean;
};

export type NumberFieldOptions = {
  defaultValue?: number | null;
  uniqueCheck?: boolean;
};

export type DateFieldOptions = {
  format?: DateFormat;
  highlight?: DateHighlightRule | null;
  defaultValue?: string | null;
  uniqueCheck?: boolean;
};

export type SelectFieldOptions = {
  choices: string[];
  defaultValue?: string | null;
  uniqueCheck?: boolean;
};

export type MultiselectFieldOptions = {
  choices: string[];
  defaultValue?: string[] | null;
  uniqueCheck?: boolean;
};

export type BooleanFieldOptions = {
  icon?: BooleanIcon;
};

export type UrlFieldOptions = {
  defaultValue?: string | null;
  uniqueCheck?: boolean;
};

export type RatingFieldOptions = {
  icon?: BooleanIcon;
  color?: string;
  min?: number;
  max?: number;
  defaultValue?: number | null;
  uniqueCheck?: boolean;
};

export type FieldOptions =
  | TextFieldOptions
  | LongTextFieldOptions
  | NumberFieldOptions
  | DateFieldOptions
  | SelectFieldOptions
  | MultiselectFieldOptions
  | BooleanFieldOptions
  | UrlFieldOptions
  | RatingFieldOptions;

export type ItemDataValue = string | number | null;
export type ItemData = Record<string, ItemDataValue>;

export type Collection = {
  id: number;
  name: string;
  created_at?: string;
};

export type BackupLabel = "startup" | "manual" | "pre_restore";

export type BackupEntry = {
  fileName: string;
  filePath: string;
  label: BackupLabel;
  createdAt: string;
  sizeBytes: number;
};

export type BackupSettings = {
  automaticBackupsEnabled: boolean;
  automaticBackupsLimit: number;
  manualBackupsLimit: number;
  backupDirectory: string;
};

export type UpdateBackupSettingsInput = {
  automaticBackupsEnabled: boolean;
  automaticBackupsLimit: number;
  manualBackupsLimit: number;
};

export type ViewType = "grid" | "kanban" | "calendar";

export type View = {
  id: number;
  collection_id: number;
  name: string;
  type: ViewType;
  is_default: 0 | 1;
  order: number;
};

export type Field = {
  id: number;
  collection_id: number;
  name: string;
  type: FieldType;
  options: string | null;
  order_index: number;
};

export type Item = {
  id: number;
  collection_id: number;
  order: number;
  data: ItemData;
  created_at?: string;
  updated_at?: string;
};

export type ItemSortSpec = {
  field: string;
  order: 1 | -1;
};

export type ViewConfig = {
  columnWidths: Record<number, number>;
  sort: ItemSortSpec[];
  calendarDateField?: string;
  calendarDateFieldId?: number;
  groupingFieldId?: number;
  kanbanColumnOrder?: string[];
  selectedFieldIds?: number[];
};

export type UpdateViewConfigInput = {
  viewId: number;
  config: ViewConfig;
};

export type ItemOrderUpdate = {
  id: number;
  order: number;
};

export type ReorderItemsInput = {
  collectionId: number;
  itemOrders: ItemOrderUpdate[];
};

export type GetItemsInput = {
  collectionId: number;
  limit: number;
  offset: number;
  search?: string;
  sort?: ItemSortSpec[];
};

export type PaginatedItemsResult = {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
};

export type CollectionItemCount = {
  collectionId: number;
  itemCount: number;
};

export type NewCollectionInput = {
  name: string;
  icon?: string | null;
};

export type NewViewInput = {
  collectionId: number;
  name: string;
  type?: ViewType;
  isDefault?: 0 | 1;
  order?: number;
};

export type UpdateViewInput = {
  id: number;
  name: string;
};

export type ViewOrderUpdate = {
  id: number;
  order: number;
};

export type ReorderViewsInput = {
  collectionId: number;
  viewOrders: ViewOrderUpdate[];
};

export type UpdateCollectionInput = {
  id: number;
  name: string;
  icon?: string | null;
};

export type NewFieldInput = {
  collectionId: number;
  name: string;
  type: FieldType;
  options: string | null;
  orderIndex?: number;
};

export type UpdateFieldInput = {
  id: number;
  name: string;
  type: FieldType;
  options: string | null;
  orderIndex?: number;
};

export type FieldOrderUpdate = {
  id: number;
  orderIndex: number;
};

export type ReorderFieldsInput = {
  collectionId: number;
  fieldOrders: FieldOrderUpdate[];
};

export type NewItemInput = {
  collectionId: number;
  data: ItemData;
};

export type UpdateItemInput = {
  id: number;
  data: ItemData;
};

export type InsertItemAtInput = {
  collectionId: number;
  afterOrder: number | null;
};

export type DuplicateItemInput = {
  collectionId: number;
  itemId: number;
};

export type MoveItemInput = {
  collectionId: number;
  itemId: number;
  direction: "up" | "down";
};

export type BulkDeleteItemsInput = {
  collectionId: number;
  itemIds: number[];
};

export type BulkPatchItemUpdate = {
  id: number;
  patch: ItemData;
};

export type BulkPatchItemsInput = {
  collectionId: number;
  updates: BulkPatchItemUpdate[];
};

export type BulkMutationResult = {
  affectedCount: number;
};

export type ExportFormat = "csv" | "json";
export type ImportMode = "append" | "replace";

export type ImportCollectionInput = {
  collectionId: number;
  mode: ImportMode;
  newFields: NewFieldInput[];
  items: NewItemInput[];
};

export type CollectionViewType = ViewType;

export type CollectionPanelType = "data" | "fields";

export type CollectionView = {
  id: number;
  type: CollectionViewType;
  name: string;
};

export type FullArchiveItemValue =
  | string
  | number
  | boolean
  | null
  | string[];

export type FullArchiveItemData = Record<string, FullArchiveItemValue>;

export type FullArchiveStats = {
  collectionCount: number;
  totalFieldCount: number;
  totalItemCount: number;
};

export type FullArchiveCollectionStats = {
  fieldCount: number;
  itemCount: number;
};

export type FullArchiveSortSpec = {
  field: string;
  order: 1 | -1;
};

export type FullArchiveField = {
  name: string;
  type: string;
  orderIndex: number;
  options: Record<string, unknown> | null;
};

export type FullArchiveGridViewConfig = {
  columnWidths: Record<string, number>;
  sort: FullArchiveSortSpec[];
  selectedFields: string[];
};

export type FullArchiveKanbanViewConfig = {
  groupingField: string | null;
  columnOrder: string[];
  selectedFields: string[];
};

export type FullArchiveCalendarViewConfig = {
  dateField: string | null;
  selectedFields: string[];
};

export type FullArchiveViewConfig =
  | FullArchiveGridViewConfig
  | FullArchiveKanbanViewConfig
  | FullArchiveCalendarViewConfig
  | Record<string, never>;

export type FullArchiveView = {
  name: string;
  type: string;
  isDefault: boolean;
  order: number;
  config: FullArchiveViewConfig;
};

export type FullArchiveItem = {
  order: number;
  data: FullArchiveItemData;
};

export type FullArchiveCollection = {
  name: string;
  exportedAt: string;
  stats: FullArchiveCollectionStats;
  fields: FullArchiveField[];
  views: FullArchiveView[];
  items: FullArchiveItem[];
};

export type FullArchiveFile = {
  type: "full_archive";
  version: number;
  appVersion: string;
  exportedAt: string;
  description: string;
  stats: FullArchiveStats;
  collections: FullArchiveCollection[];
};

export type FullArchiveExportInput = {
  description: string;
};

export type FullArchiveExportResult = {
  filePath: string;
  stats: FullArchiveStats;
};

export type FullArchiveDatabaseSummary = {
  isEmpty: boolean;
  collectionCount: number;
  totalFieldCount: number;
  totalItemCount: number;
  collectionNames: string[];
};

export type FullArchivePreview = {
  filePath: string;
  archiveSummary: {
    appVersion: string;
    exportedAt: string;
    description: string;
    stats: FullArchiveStats;
    collections: Array<{
      name: string;
      stats: FullArchiveCollectionStats;
    }>;
  };
  currentDbSummary: FullArchiveDatabaseSummary;
  willReplaceExistingData: boolean;
};

export type FullArchiveSkippedEntityWarning = {
  scope: "field" | "view";
  collectionName: string;
  name: string;
  type: string;
  reason: string;
};

export type FullArchiveDroppedViewReferenceWarning = {
  collectionName: string;
  viewName: string;
  viewType: string;
  referenceType:
    | "columnWidth"
    | "sort"
    | "selectedField"
    | "groupingField"
    | "dateField";
  referenceValue: string;
  reason: string;
};

export type FullArchiveStatMismatch = {
  scope: "total" | "collection";
  collectionName?: string;
  stat: "collectionCount" | "fieldCount" | "itemCount";
  expected: number;
  actual: number;
};

export type FullArchiveCollectionFailure = {
  collectionName: string;
  message: string;
};

export type FullArchiveRestoreReport = {
  restoredCollections: string[];
  failedCollections: FullArchiveCollectionFailure[];
  skippedEntities: FullArchiveSkippedEntityWarning[];
  droppedViewReferences: FullArchiveDroppedViewReferenceWarning[];
  statMismatches: FullArchiveStatMismatch[];
  preRestoreBackupPath: string;
};
