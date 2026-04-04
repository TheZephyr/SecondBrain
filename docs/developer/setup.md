# Setup

This page covers the local development and verification workflow for Second Brain.

## Environment

- Node.js `>=22.12.0`
- Electron desktop runtime
- SQLite via `better-sqlite3`

Package metadata and scripts live in `package.json`.

## Key Scripts

- `npm run dev`: starts Vite and Electron together.
- `npm run build-electron`: builds Electron entrypoints into `dist-electron`.
- `npm run docs:dev`: runs the VitePress docs site locally.
- `npm run docs:build`: builds the docs site.
- `npm run test`: runs Vitest.
- `npm run verify`: repository gate for typecheck, tests, and Electron build validation.

## Native Module Rebuilds

`better-sqlite3` needs different rebuild targets depending on where it runs.

- `npm run rebuild:node`: rebuild for local Node-based test and script execution.
- `npm run rebuild:electron`: rebuild for the Electron runtime.

The app already wires these into the common flows:

- `pretest` runs the Node rebuild before tests.
- `predev:electron` runs the Electron rebuild before development Electron launch.

## Recommended Local Workflow

1. Install dependencies with `npm install`.
2. Run `npm run dev` while working on UI or Electron behavior.
3. Run targeted tests while iterating.
4. Run `npm run docs:build` if you changed docs navigation or links.
5. Finish with `npm run verify`.

## Docs Maintenance Rule

When behavior changes in any of these areas, update docs in the same change:

- User-visible UI labels or workflows.
- IPC contracts or validation rules.
- Field types, view configuration, backup, archive, or import/export behavior.
- Development setup or required verification steps.
