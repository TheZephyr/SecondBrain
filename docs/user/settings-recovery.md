# Settings & Recovery

Global `Settings` in the sidebar contains backup and full-database recovery tools.

## Open Settings

1. Click `Settings` in the sidebar.
2. Use the `Backup` and `Data` sections on the page.

## Backup

Backups are SQLite snapshots of the current database.

### What the Backup Section Includes

- Backup storage location.
- `Reveal in Explorer`
- `Open Backups Folder`
- Automatic startup backup settings.
- Manual and pre-restore retention settings.
- `Create Backup Now`
- Existing backup list with restore and delete actions.

### Startup Backups

If `Enable on startup` is on, Second Brain creates a startup backup before the database worker finishes initialization.

- `Startup backups to keep` controls retention for startup backups only.
- Use `0` for unlimited retention.

### Manual and Pre-Restore Backups

Manual backups and pre-restore backups share one retention bucket.

- `Create Backup Now` creates a manual snapshot immediately.
- `Manual + pre-restore backups to keep` controls retention for both manual backups and restore safety backups.
- Use `0` for unlimited retention.

### Restore a Backup

1. In `Existing Backups`, click `Restore`.
2. Confirm the warning.
3. The app creates a `pre_restore` backup of the current state.
4. The selected backup replaces the live database.
5. The app relaunches.

## Full Archive Export

Full archive export writes the entire database to a JSON file.

1. Open the `Data` section.
2. Enter an optional description.
3. Click `Export Full Archive`.
4. Choose where to save the file.

Use a full archive when you want a portable, human-readable copy of the entire database.

## Full Archive Restore

Full archive restore replaces the entire current database with an archive file.

1. In the `Data` section, click `Select Archive File`.
2. Choose the archive file.
3. Review the preview dialog.
4. Confirm the restore.

The preview shows:

- Archive metadata.
- Archive collection and item counts.
- Current database summary.
- Whether existing data will be replaced.

After restore, the app shows a restore report and reloads collections.

## Restore Reports

Full archive restore can report:

- Restored collections.
- Failed collections.
- Skipped entities.
- Dropped view references.
- Stat mismatches.
- The pre-restore backup path.

This gives you a record of what restored cleanly and what had to be adjusted.

## Important Differences

- Backups are SQLite snapshots designed for recovery and rollback.
- Full archives are JSON exports designed for migration and long-term portability.
- Collection-level CSV and JSON tools stay in `Collection Settings`, not in global `Settings`.
