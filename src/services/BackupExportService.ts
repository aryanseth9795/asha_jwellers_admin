import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { zip } from "react-native-zip-archive";
import { BackupError, MANIFEST_FILE } from "../backup/format";
import { serializeSnapshot } from "../backup/serialize";
import { validateBackup } from "../backup/validate";
import { readSnapshot } from "../database/backupQueries";

/**
 * Backup v2 export (backup spec §5): snapshot → files + photos in a staging folder → zip.
 * Every backup is validated against the importer's own checks before it is shared or kept, so the app never hands
 * the owner a backup it could not restore.
 */

const EMERGENCY_DIR = "backups/";
const EMERGENCY_PREFIX = "before-restore-";
const EMERGENCY_KEEP = 3;
const EXPORT_PREFIX = "AJ-backup-";

/** Joins a directory URI (ending in "/") and a zip-relative path, percent-encoding each segment. */
export const joinUri = (dirUri: string, relativePath: string): string =>
  dirUri + relativePath.split("/").map(encodeURIComponent).join("/");

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
/** Local time, sortable and safe in a file name: 2026-10-03_1830-12. */
const stamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

const fileExists = async (uri: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory;
  } catch {
    return false;
  }
};

/** Writes the whole ledger as a v2 backup zip at `zipUri` (which must not exist yet). */
const buildBackupZip = async (zipUri: string): Promise<void> => {
  const snapshot = await readSnapshot();

  // serializeSnapshot asks synchronously, so look every photo up first.
  const present = new Set<string>();
  for (const path of new Set([...snapshot.rehan, ...snapshot.lenden].flatMap((r) => r.media))) {
    if (await fileExists(path)) present.add(path);
  }
  const { files, manifest, mediaCopies } = serializeSnapshot(snapshot, {
    createdAt: new Date().toISOString(),
    mediaExists: (path) => present.has(path),
  });
  const manifestText = JSON.stringify(manifest, null, 2);

  // Never share a backup that the importer would reject.
  const check = validateBackup({ manifestText, files, mediaPaths: new Set(mediaCopies.map((m) => m.to)) });
  if (!check.ok) {
    throw new BackupError(`The backup could not be made: ${check.errors[0]}`);
  }

  const stage = `${FileSystem.cacheDirectory}backup-stage-${Date.now()}/`;
  try {
    await FileSystem.makeDirectoryAsync(`${stage}data/`, { intermediates: true });
    await FileSystem.writeAsStringAsync(joinUri(stage, MANIFEST_FILE), manifestText);
    for (const [path, text] of Object.entries(files)) {
      await FileSystem.writeAsStringAsync(joinUri(stage, path), text);
    }
    for (const { from, to } of mediaCopies) {
      const dir = to.slice(0, to.lastIndexOf("/") + 1);
      await FileSystem.makeDirectoryAsync(joinUri(stage, dir), { intermediates: true });
      await FileSystem.copyAsync({ from, to: joinUri(stage, to) });
    }
    await FileSystem.deleteAsync(zipUri, { idempotent: true });
    await zip(stage, zipUri);
  } finally {
    await FileSystem.deleteAsync(stage, { idempotent: true }).catch(() => undefined);
  }
};

/** Builds a v2 backup of the whole ledger with its photos and opens the share sheet. */
export const exportBackup = async (): Promise<void> => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new BackupError("Sharing is not available on this phone");
  }
  const cache = FileSystem.cacheDirectory as string;
  // Earlier exports have been shared already; do not let them pile up in the cache.
  try {
    for (const name of await FileSystem.readDirectoryAsync(cache)) {
      if (name.startsWith(EXPORT_PREFIX) && name.endsWith(".zip")) {
        await FileSystem.deleteAsync(cache + name, { idempotent: true });
      }
    }
  } catch {
    // Cleaning up is best effort.
  }
  const zipUri = `${cache}${EXPORT_PREFIX}${stamp(new Date())}.zip`;
  await buildBackupZip(zipUri);
  await Sharing.shareAsync(zipUri, { mimeType: "application/zip", dialogTitle: "Save AJ backup", UTI: "public.zip-archive" });
};

/**
 * Saves a v2 backup of the current ledger in documentDirectory/backups/ before a Replace and restore, keeping the
 * newest three. Returns the zip's URI. Throws when the backup cannot be made; the restore must then stop.
 */
export const writeEmergencyBackup = async (): Promise<string> => {
  const dir = `${FileSystem.documentDirectory}${EMERGENCY_DIR}`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const zipUri = `${dir}${EMERGENCY_PREFIX}${stamp(new Date())}-${pad(Date.now() % 1000, 3)}.zip`;
  await buildBackupZip(zipUri);

  try {
    const old = (await FileSystem.readDirectoryAsync(dir))
      .filter((name) => name.startsWith(EMERGENCY_PREFIX) && name.endsWith(".zip"))
      .sort()
      .reverse()
      .slice(EMERGENCY_KEEP);
    for (const name of old) await FileSystem.deleteAsync(dir + name, { idempotent: true });
  } catch {
    // Pruning is best effort; the new backup is already safe.
  }
  return zipUri;
};
