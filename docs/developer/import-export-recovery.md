# Import, Export & Recovery

Second Brain has two different data-mobility layers: collection-level transfer and full-database recovery.

## Source-of-Truth Files

- Collection import/export utilities: `src/utils/collectionImportExport.ts`
- Full archive helpers: `src/utils/fullArchive.ts`
- Collection settings UI: `src/components/collections/settings/CollectionSettingsPanel.vue`
- Global settings UI: `src/components/settings/SettingsBackupSection.vue`, `src/components/settings/SettingsDataSection.vue`
- Backup IPC: `electron/ipc/backup.ts`
- Archive IPC: `electron/ipc/archive.ts`
- Archive DB implementation: `electron/lib/full-archive.ts`
- Backup file utilities: `electron/lib/backup-utils.ts`

## Collection Import and Export

Collection-level data transfer belongs to `Collection Settings`.

### Export

Supported formats:

- CSV
- JSON

JSON export can optionally include schema metadata so a future import can preserve field types and options more reliably.

### Import

Collection import supports:

- `append` mode
- `replace` mode
- preview of matched fields
- preview of new fields
- per-field type override before import
- select and multiselect choice inference

Actual import execution is still transactional in the worker.

## Backups

Backups are SQLite snapshots for rollback and disaster recovery.

Main process responsibilities:

- create manual backup
- create startup backup
- restore backup
- delete backup
- enforce retention settings
- reopen or relaunch app after restore

Backups are not the same as collection export or JSON full archive.

## Full Archive

A full archive is a JSON representation of the entire database.

The flow is split:

- renderer opens the global settings UI
- main process runs file dialogs and disk read/write
- worker exports or restores the database content
- renderer shows preview and restore report UI

## Archive Preview and Restore

Archive preview combines:

- archive metadata from the selected file
- current database summary from the worker
- replacement warning if the current database is not empty

Restore always creates a pre-restore backup before applying archive data.

The restore report can include:

- restored collections
- failed collections
- skipped unsupported entities
- dropped view references
- stat mismatches
- the pre-restore backup path

## Documentation Rule

Whenever import, export, backup, or restore behavior changes, update both:

- the user workflow docs
- this architectural page

These areas drift easily because they cross renderer, main, worker, and file-system boundaries.
