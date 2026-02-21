export type FieldType = "text" | "textarea" | "number" | "date" | "select";

export type ItemDataValue = string | number | null;
export type ItemData = Record<string, ItemDataValue>;

export type Collection = {
  id: number;
  name: string;
  icon: string;
  created_at?: string;
};

export type ViewType = "grid";

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
  icon: string;
};

export type NewViewInput = {
  collectionId: number;
  name: string;
  type?: ViewType;
  isDefault?: 0 | 1;
  order?: number;
};

export type UpdateCollectionInput = {
  id: number;
  name: string;
  icon: string;
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
