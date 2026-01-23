const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function buildElectron() {
  console.log('🔨 Building Electron files...');
  
  // Create dist-electron directory
  const distElectronPath = path.join(__dirname, 'dist-electron');
  if (!fs.existsSync(distElectronPath)) {
    fs.mkdirSync(distElectronPath);
  }

  // Build main.ts
  await esbuild.build({
    entryPoints: ['electron/main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist-electron/main.js',
    external: ['electron'],
    format: 'cjs'
  });

  // Build preload.ts
  await esbuild.build({
    entryPoints: ['electron/preload.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    outfile: 'dist-electron/preload.js',
    external: ['electron'],
    format: 'cjs'
  });

  console.log('✅ Electron build complete!');
}

buildElectron().catch(console.error);