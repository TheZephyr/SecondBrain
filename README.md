# Second Brain

Second Brain is a local-first Electron desktop app for organizing structured personal data in custom collections.

## Features

- Custom collections with local SQLite storage
- Three view types: grid, kanban, and calendar
- Flexible field types: text, long text, number, date, select, multiselect, boolean, URL, and rating
- Per-view configuration for visible fields, sort, column widths, kanban grouping, and calendar date selection
- Collection-level CSV and JSON import/export with preview and schema-aware JSON export
- Global recovery tools: backups, full archive export, preview, and restore

## Architecture

```text
Renderer (Vue 3 + Pinia)
  -> window.electronAPI (preload bridge)
  -> Main process IPC handlers
  -> DB worker (worker_threads)
  -> SQLite
```

The renderer never talks to SQLite directly. All database work goes through the main process and the database worker.

## Tech Stack

- Electron
- Vue 3
- TypeScript
- Pinia
- PrimeVue
- Tailwind CSS 4
- SQLite via better-sqlite3
- Vite and VitePress

## Getting Started

```bash
git clone https://github.com/TheZephyr/SecondBrain.git
cd SecondBrain
npm install
npm run dev
```

Useful rebuild scripts:

- `npm run rebuild:node`
- `npm run rebuild:electron`

## Verification

Run the full repository gate before finishing work:

```bash
npm run verify
```

If you changed documentation navigation or links, also run:

```bash
npm run docs:build
```

## Documentation

- User guide: `docs/user`
- Developer guide: `docs/developer`
- Roadmap: `docs/roadmap`

The VitePress site can be previewed locally with:

```bash
npm run docs:dev
```

## Data Storage

Application data is stored locally under Electron's `userData` directory in a SQLite database file named `secondbrain.db`.

Backups and full archives are separate recovery/export mechanisms and are managed from the app UI.
