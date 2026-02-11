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

## Installation

### Prerequisites

- Node.js 18 or higher
- Git

### Setup

1. Clone the repository:
```bash
git clone https://github.com/TheZephyr/second-brain.git
cd second-brain
```

2. Install dependencies:
```bash
npm install
```

3. Rebuild native modules for Electron:
```bash
npx electron-rebuild
```

4. Build Electron main process:
```bash
node build-electron.js
```

5. Start the development server:
```bash
npm run dev
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
