# Data Model & Validation

This page is the shared contract reference for the app.

## Source-of-Truth Files

- Product and archive model types: `src/types/models.ts`
- Renderer-visible Electron contract: `src/types/electron.d.ts`
- IPC result and error types: `src/types/ipc.ts`
- Worker operation contract: `electron/db/worker-protocol.ts`
- Runtime validation: `src/validation/schemas.ts`

## Core Product Types

`src/types/models.ts` defines the application data model used by both renderer and backend code.

Key groups:

- collection, field, view, and item records
- mutation inputs such as `NewFieldInput`, `ReorderViewsInput`, and `BulkPatchItemsInput`
- `ViewConfig`
- backup settings and backup entries
- full archive export, preview, and restore report types

## Field Types

`FieldType` is the canonical enum for user-visible schema behavior:

- `text`
- `longtext`
- `number`
- `date`
- `select`
- `multiselect`
- `boolean`
- `url`
- `rating`

`Field` now also includes an optional top-level `description` property. This is field metadata, not a type-specific option.

Field option types in the same file document which settings are supported for each field kind.

Notable option groups:

- `longtext`: `richText`
- `number`: `showAsChip`, `showThousandsSeparator`, `colorScale`
- `date`: `highlight` supports `target: "date" | "current"`
- `select` / `multiselect`: `optionColors` remains separate from `choices`
- `rating`: icon, fallback color, per-value `optionColors`, bounds, and default value

`GetNumberFieldRangeInput` and `NumberFieldRange` define the worker query contract used by renderer presentation logic for whole-collection number color scales.

## View Config

`ViewConfig` is the canonical per-view renderer persistence object.

It can include:

- `columnWidths`
- `sort`
- `calendarDateField`
- `calendarDateFieldId`
- `groupingFieldId`
- `kanbanColumnOrder`
- `selectedFieldIds`

Backend code normalizes and validates this before storage.

## Electron Bridge Contract

`src/types/electron.d.ts` defines everything the renderer is allowed to call on `window.electronAPI`.

When new backend behavior is added:

1. update the type contract
2. update preload exposure
3. update main IPC registration
4. update docs if the contract is user-facing or architectural

## Validation Boundary

`src/validation/schemas.ts` is the IPC input boundary.

It validates:

- collection, view, field, and item mutations
- number-range aggregate queries
- item pagination and sort payloads
- reorder payload shapes
- bulk mutation limits
- backup settings
- archive import/export metadata
- full archive file structure

## Why Validation Lives Here

The shared schemas let the codebase do three things consistently:

- validate untrusted renderer input in main
- reuse some rules in renderer forms
- keep worker code focused on database execution rather than request-shape policing

## Stability Rule

Treat these files as stable contracts:

- `src/types/models.ts`
- `src/types/electron.d.ts`
- `electron/db/worker-protocol.ts`
- `src/validation/schemas.ts`

If behavior changes but these files do not, docs are probably drifting.
