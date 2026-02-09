import { z } from "zod";
import { isSafeFieldName, normalizeFieldName } from "./fieldNames";

export const collectionNameSchema = z.string().trim().min(1).max(80);
export const iconSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9-]+$/);

export const fieldNameSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (!isSafeFieldName(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Field name must be 1-64 chars, use letters/numbers/spaces/_/-, and avoid dots or reserved names.",
      });
    }
  })
  .transform((value) => normalizeFieldName(value));

export const positiveIntSchema = z.number().int().positive();
export const orderIndexSchema = z.number().int().min(0);

export const itemDataValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.null(),
]);

export const itemDataSchema = z
  .record(itemDataValueSchema)
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (!isSafeFieldName(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsafe field name: ${key}`,
          path: [key],
        });
      }
    }
  });

export const NewCollectionInputSchema = z.object({
  name: collectionNameSchema,
  icon: iconSchema,
});

export const UpdateCollectionInputSchema = z.object({
  id: positiveIntSchema,
  name: collectionNameSchema,
  icon: iconSchema,
});

export const NewFieldInputSchema = z.object({
  collectionId: positiveIntSchema,
  name: fieldNameSchema,
  type: z.enum(["text", "textarea", "number", "date", "select"]),
  options: z.string().nullable(),
  orderIndex: orderIndexSchema.optional(),
});

export const UpdateFieldInputSchema = z.object({
  id: positiveIntSchema,
  name: fieldNameSchema,
  type: z.enum(["text", "textarea", "number", "date", "select"]),
  options: z.string().nullable(),
  orderIndex: orderIndexSchema.optional(),
});

export const NewItemInputSchema = z.object({
  collectionId: positiveIntSchema,
  data: itemDataSchema,
});

export const UpdateItemInputSchema = z.object({
  id: positiveIntSchema,
  data: itemDataSchema,
});
