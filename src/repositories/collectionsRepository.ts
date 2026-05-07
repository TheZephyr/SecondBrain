import type {
  Collection,
  CollectionItemCount,
  Field,
  FieldConversionPreview,
  FieldConversionResult,
  NewCollectionInput,
  NewFieldInput,
  PreviewFieldConversionInput,
  ReorderFieldsInput,
  ConvertFieldTypeInput,
  UpdateCollectionInput,
  UpdateFieldInput,
} from "../types/models";
import { handleIpc } from "../utils/ipc";

type CreatedField = NewFieldInput & { id: number };

export const collectionsRepository = {
  async getCollections(): Promise<Collection[]> {
    const result = await window.electronAPI.getCollections();
    return handleIpc(result, "db:getCollections", []);
  },

  async getCollectionItemCounts(): Promise<CollectionItemCount[]> {
    const result = await window.electronAPI.getCollectionItemCounts();
    return handleIpc(result, "db:getCollectionItemCounts", []);
  },

  async addCollection(
    input: NewCollectionInput,
  ): Promise<Collection | null> {
    const result = await window.electronAPI.addCollection(input);
    return handleIpc(result, "db:addCollection", null);
  },

  async updateCollection(input: UpdateCollectionInput): Promise<boolean> {
    const result = await window.electronAPI.updateCollection(input);
    return handleIpc(result, "db:updateCollection", false);
  },

  async deleteCollection(id: number): Promise<boolean> {
    const result = await window.electronAPI.deleteCollection(id);
    return handleIpc(result, "db:deleteCollection", false);
  },

  async getFields(collectionId: number): Promise<Field[]> {
    const result = await window.electronAPI.getFields(collectionId);
    return handleIpc(result, "db:getFields", []);
  },

  async addField(input: NewFieldInput): Promise<CreatedField | null> {
    const result = await window.electronAPI.addField(input);
    return handleIpc(result, "db:addField", null);
  },

  async updateField(input: UpdateFieldInput): Promise<boolean> {
    const result = await window.electronAPI.updateField(input);
    return handleIpc(result, "db:updateField", false);
  },

  async previewFieldConversion(
    input: PreviewFieldConversionInput,
  ): Promise<FieldConversionPreview | null> {
    const result = await window.electronAPI.previewFieldConversion(input);
    return handleIpc(result, "db:previewFieldConversion", null);
  },

  async convertFieldType(
    input: ConvertFieldTypeInput,
  ): Promise<FieldConversionResult | null> {
    const result = await window.electronAPI.convertFieldType(input);
    return handleIpc(result, "db:convertFieldType", null);
  },

  async reorderFields(input: ReorderFieldsInput): Promise<boolean> {
    const result = await window.electronAPI.reorderFields(input);
    return handleIpc(result, "db:reorderFields", false);
  },

  async deleteField(fieldId: number): Promise<boolean> {
    const result = await window.electronAPI.deleteField(fieldId);
    return handleIpc(result, "db:deleteField", false);
  },
};
