# Second Brain

A desktop application for organizing personal data collections with a flexible, database-driven approach.

## Features

- **Custom Collections** - Create unlimited collections for any data type
- **Flexible Schema** - Define custom fields with support for text, numbers, dates, dropdowns, and text areas
- **Data Management** - Import and export data in CSV or JSON formats with preview and merge options

## Tech Stack

- Runtime: Electron
- Language: TypeScript
- Database: SQLite
- Frontend: Vue 3, Vite, PrimeVue, Tailwind CSS
- State: Pinia

## Contributor Quick Map

```
┌─────────────────────────────────────────┐
│  Renderer Process (Vue 3 + TypeScript)  │
│  ┌────────────┐      ┌────────────┐     │
│  │   Views    │ ───> │   Store    │     │
│  │ Components │      │  (Pinia)   │     │
│  └────────────┘      └────────────┘     │
│         │                   │           │
│         └───────────────────┘           │
└──────────────────┼──────────────────────┘
                   │
               IPC Bridge
                   │
┌──────────────────┼──────────────────────┐
│     Main Process (Electron + Node)      │
│         ┌────────▼────────┐             │
│         │   IPC Handlers  │             │
│         └────────┬────────┘             │
│                  │                      │
│         ┌────────▼─────────┐            │
│         │   Worker Thread  │            │
│         │    (Database)    │            │
│         └────────┬─────────┘            │
│                  │                      │
│         ┌────────▼─────────┐            │
│         │  SQLite Database │            │
│         └──────────────────┘            │
└─────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Node.js 22.12 or higher
- Git

### Setup

1. Clone the repository:
```bash
git clone https://github.com/TheZephyr/SecondBrain.git
cd SecondBrain
```

2. Install dependencies:
```bash
npm install
```

3. Rebuild native modules for Electron:
```bash
npm run rebuild:electron
```

4. Start the development server:
```bash
npm run dev
```

## Testing Code Changes

Run these commands after pulling code changes:

1. Install/update dependencies:
```bash
npm install
```

2. Run unit tests (includes Node-targeted native rebuild via `pretest`):
```bash
npm run test
```

3. Run renderer type-check:
```bash
npx vue-tsc --noEmit
```

4. Run node/electron type-check:
```bash
npx tsc --noEmit -p tsconfig.node.json
```

5. Validate the production build:
```bash
npm run build:win
```

6. Launch app for manual smoke testing (includes Electron-targeted native rebuild via `predev:electron`):
```bash
npm run dev
```

7. Manual edge-case smoke checks:
- Switch between collections with saved table sort and confirm the sort preference is preserved.
- Reorder fields in a collection that includes legacy/hidden unsafe fields; the reorder mutation should succeed.
- Import data into a collection that includes legacy/hidden unsafe fields and confirm no order-index conflict errors occur.

Useful native rebuild scripts:

- `npm run rebuild:node` - rebuild `better-sqlite3` for your local Node runtime.
- `npm run rebuild:electron` - rebuild `better-sqlite3` for Electron runtime (via `@electron/rebuild`).

If you see `NODE_MODULE_VERSION` mismatch errors, run:
```bash
npm run rebuild:electron
```

## Build for Production

Create a Windows installer:
```bash
npm run build:win
```

The installer will be generated in the `release/` directory.

## Data Storage

Application data is stored locally in an SQLite database:

**Windows:** `%APPDATA%/second-brain/secondbrain.db`

All data remains on your machine and is never transmitted externally.
