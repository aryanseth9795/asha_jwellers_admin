# Backup Import and Restore Plan

## Objective

Allow the app to import exported backups without duplicating records, while
preserving all customer, transaction, payment, item, and image relationships.

## 1. Upgrade the backup format

Update `src/services/ExportService.ts` to produce a versioned backup archive.

- Add `manifest.json` containing the backup format version, creation time,
  record counts, and integrity checks.
- Include every ledger table: `users`, `rehan`, `lenden`, `jama_entries`,
  `rehan_transactions`, `lenden_items`, and `lenden_old_jewellery_items`.
- Store relationships through stable backup IDs rather than local SQLite row
  IDs.
- Store copied images in unique record-specific paths, so images with the
  same filename cannot overwrite each other.

## 2. Add stable record identities

Add an immutable UUID-style `backupKey` to every importable table in
`src/database/entryDatabase.ts` and `src/database/lendenItems.ts`.

- Migrate and backfill existing rows once.
- Add unique indexes for the new keys.
- Generate a key for every new record.
- Use these keys in exported data and imports; numeric SQLite IDs remain local
  implementation details.

## 3. Implement a validated import service

Create `src/services/ImportService.ts`.

- Select a `.zip` file using a document picker, then unzip it into a temporary
  app directory.
- Validate the manifest, schema version, record counts, JSON shape, checksums,
  media paths, unique keys, and every parent-child reference before writing
  data.
- Import in dependency order: users, Rehan and Len-Den records, then payments
  and Len-Den items.
- Use a single exclusive SQLite transaction, so any error leaves the database
  unchanged.
- Copy imported images using deterministic unique local paths and remove newly
  copied files if the transaction fails.
- Return a summary of inserted, skipped, conflicting, invalid, and missing
  records/files.

## 4. Restore behaviour

Offer two explicit modes.

### Safe merge (default)

- Insert only records whose `backupKey` is not already present.
- Skip identical records, making repeated imports of the same backup
  idempotent.
- Never silently overwrite differing existing records; report them as
  conflicts.

### Replace and restore

- Warn clearly that current data will be replaced.
- First create an emergency backup of the current ledger.
- Replace local ledger data and restore the selected archive for an exact
  backup state.

## 5. Existing (legacy) backup support

Current archives have no manifest or stable identities and omit payment and
line-item data.

- Treat them as legacy backups.
- Allow only a clearly labelled restore into empty/replaced data, never a
  merge into existing data.
- Warn that payment history and Len-Den line items cannot be recovered when
  they were absent from the original export.

## 6. User interface

Add an **Import backup** action beside the current export action in
`src/screen/homeScreen.tsx`.

- Show a preview with backup date, version, included data, and record counts.
- Require confirmation of the chosen import mode.
- Disable actions and show progress while importing.
- Display useful errors for cancelled, corrupted, unsupported, or incomplete
  archives.
- Refresh the visible customer and transaction data after success.

## 7. Verification

- Restore a v2 archive into an empty database and confirm every record,
  relationship, payment, item, balance, and image is present.
- Import the same archive twice and confirm the second import inserts nothing.
- Test local-ID collisions from different devices.
- Test corrupt archives, bad foreign references, missing images, and a failed
  write; the original database must remain unchanged.
- Test duplicate image filenames in different records.
- Test legacy-backup warnings and merge prevention.
- Run TypeScript and Jest checks, followed by an Android device test for file
  selection and extraction.

## Delivery note

The import picker requires adding an Expo document-picker dependency and a
native rebuild. The existing ZIP library already supports extraction.
