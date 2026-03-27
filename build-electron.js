const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

async function buildElectron() {
  console.log("Building Electron files...");

  const distElectronPath = path.join(__dirname, "dist-electron");
  if (!fs.existsSync(distElectronPath)) {
    fs.mkdirSync(distElectronPath);
  }

  await esbuild.build({
    entryPoints: ["electron/main.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    outfile: "dist-electron/main.js",
    external: ["electron", "better-sqlite3"],
    format: "cjs",
  });

  await esbuild.build({
    entryPoints: ["electron/db/worker.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    outfile: "dist-electron/db-worker.js",
    external: ["better-sqlite3"],
    format: "cjs",
  });

  await esbuild.build({
    entryPoints: ["electron/preload.ts"],
    bundle: true,
    platform: "node",
    target: "node22",
    outfile: "dist-electron/preload.js",
    external: ["electron"],
    format: "cjs",
  });

  console.log("Electron build complete");
}

buildElectron().catch(console.error);
