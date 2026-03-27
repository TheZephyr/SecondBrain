import { build } from "esbuild";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "dist-electron");

if (!existsSync(outDir)) {
  mkdirSync(outDir);
}

const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
};

await build({
  ...shared,
  entryPoints: [join(root, "electron/main.ts")],
  outfile: join(outDir, "main.js"),
  external: ["electron", "better-sqlite3"],
});

await build({
  ...shared,
  format: "cjs",
  entryPoints: [join(root, "electron/db/worker.ts")],
  outfile: join(outDir, "db-worker.cjs"),
  external: ["better-sqlite3"],
});

await build({
  ...shared,
  entryPoints: [join(root, "electron/preload.ts")],
  outfile: join(outDir, "preload.js"),
  external: ["electron"],
});

console.log("Electron build complete.");
