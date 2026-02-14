import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "electron/**/*.test.ts",
      "electron/**/*.spec.ts",
    ],
  },
});
