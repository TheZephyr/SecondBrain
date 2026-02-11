export type FieldType = "text" | "textarea" | "number" | "date" | "select";

export type ItemDataValue = string | number | null;
export type ItemData = Record<string, ItemDataValue>;

export type Collection = {
  id: number;
  name: string;
  icon: string;
  created_at?: string;
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
  data: ItemData;
  created_at?: string;
  updated_at?: string;
};

export type NewCollectionInput = {
  name: string;
  icon: string;
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

export type NewItemInput = {
  collectionId: number;
  data: ItemData;
};

export type UpdateItemInput = {
  id: number;
  data: ItemData;
};

export type ExportFormat = "csv" | "json";
export type ImportMode = "append" | "replace";

export type ImportCollectionInput = {
  collectionId: number;
  mode: ImportMode;
  newFields: NewFieldInput[];
  items: NewItemInput[];
};
