# Second Brain

A personal desktop database manager for organizing your data collections.

## ✨ Features

- 🗂️ **Flexible Collections** - Create unlimited custom collections (Games, Books, Movies, Recipes, etc.)
- 🎨 **Custom Fields** - Define your own columns with different field types
- 🔍 **Search & Filter** - Find your data quickly
- 📊 **Dashboard** - Overview of all your collections
- 🌙 **Dark Mode** - Beautiful, professional dark theme
- 💾 **Offline First** - All data stored locally in SQLite
- 🎯 **Drag & Drop** - Reorder fields easily
- 🎭 **Lucide Icons** - Sleek, modern iconography

## 🚀 Tech Stack

- **TypeScript** - Type-safe development
- **Electron** - Cross-platform desktop app framework
- **Vue 3** - Modern reactive UI framework
- **Vite** - Fast build tool
- **SQLite** - Reliable local database (via better-sqlite3)

## 📋 Prerequisites

- **Node.js** v18 or newer ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **Windows** (currently tested on Windows)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR-USERNAME/second-brain.git
cd second-brain
```

### 2. Install dependencies

```bash
npm install
```

### 3. Rebuild native modules for Electron

```bash
npm install --save-dev electron-rebuild
npx electron-rebuild
```

### 4. Build and run

```bash
node build-electron.js
npm run dev
```

## 📦 Building for Production

Build a distributable Windows executable:

```bash
npm run build:win
```

The installer will be created in the `release/` folder.

## 🗄️ Data Storage

Your database is stored at:

```
%APPDATA%/Roaming/second-brain/secondbrain.db
```

All data is stored locally and never leaves your computer.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [Vue 3](https://vuejs.org/)
- Database by [SQLite](https://www.sqlite.org/)
- Icons by [Lucide](https://lucide.dev/)

**Made with ❤️ for personal productivity**
