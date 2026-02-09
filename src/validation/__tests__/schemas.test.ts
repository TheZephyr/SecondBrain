import { describe, it, expect } from "vitest";
import { NewFieldInputSchema, itemDataSchema } from "../schemas";

describe("validation schemas", () => {
  it("rejects invalid field names", () => {
    const result = NewFieldInputSchema.safeParse({
      collectionId: 1,
      name: "bad.name",
      type: "text",
      options: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unsafe keys in item data", () => {
    const data = Object.create(null) as Record<string, unknown>;
    data["__proto__"] = "bad";
    const result = itemDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects non-primitive item values", () => {
    const objectResult = itemDataSchema.safeParse({
      Title: { nested: true },
    });
    const arrayResult = itemDataSchema.safeParse({
      Title: [1, 2, 3],
    });

    expect(objectResult.success).toBe(false);
    expect(arrayResult.success).toBe(false);
  });
});
