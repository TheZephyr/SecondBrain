import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-vue": ["vue", "pinia"],
          "vendor-ui": ["reka-ui", "@vueuse/core"],
          "vendor-table": ["@tanstack/vue-table", "@tanstack/vue-virtual"],
          "vendor-utils": ["zod", "papaparse"],
          "vendor-icons": ["lucide-vue-next"],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
