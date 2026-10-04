import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { unzip } from "react-native-zip-archive";
import {
  BackupData,
  BackupError,
  DATA_FILES,
  ImportMode,
  ImportPreview,
  ImportResult,
  MANIFEST_FILE,
  MergePlan,
  TABLE_KEYS,
} from "../backup/format";
import { convertLegacy } from "../backup/legacy";
import { countRows, planMerge } from "../backup/plan";
import { validateBackup, validateData } from "../backup/validate";
import { applyMerge, applyReplace, mediaKey, newUuids, readSnapshot } from "../database/backupQueries";
import { joinUri, writeEmergencyBackup } from "./BackupExportService";

/**
 * Backup import (backup spec §6): pick → stage → validate → plan → preview, then apply in one transaction.
 * Nothing on the phone changes until applyImport, and a failed apply leaves the ledger and the images folder as they
 * were.
 */

export interface StagedImport {
  preview: ImportPreview;
  data: BackupData;
  /** Null for an old backup: only Replace and restore is allowed. */
  plan: MergePlan | null;
  /** The staging folder (deleted by applyImport or discardStagedImport). */
  dir: string;
  /** The folder holding the unzipped backup (inside `dir`). */
  contentDir: string;
  /** Photo files found in the zip, relative to contentDir: media/** (v2) or images/** (old backup). */
  mediaPaths: string[];
}

type MediaRoot = "media" | "images";

/** What the picker hands back: a file:// or content:// URI, and its display name when the platform gives one. */
type PickedFile = { uri: string; name?: unknown };

const LEGACY_FILES = ["users.json", "rehan.json", "lenden.json"] as const;

// ---------- Pure helpers (unit-tested in src/backup/roundtrip.test.ts) ----------

/**
 * True for a plain relative path inside the backup's photo folder: "<root>/<segment>/…/<file>". Rejects absolute
 * paths, URIs, backslashes, empty segments and "." / ".." segments. Paths in a backup are untrusted.
 */
export const isSafeMediaPath = (relativePath: string, root: MediaRoot): boolean => {
  if (typeof relativePath !== "string" || relativePath.includes("\\") || relativePath.includes("\0")) return false;
  const segments = relativePath.split("/");
  if (segments.length < 2 || segments[0] !== root) return false;
  return segments.every((s) => s !== "" && s !== "." && s !== "..");
};

/**
 * File name for a restored photo: <recordUuid>-<n>-<name>, keeping only [A-Za-z0-9._-]. The "<n>-" the export puts
 * in front of the name, and a "<recordUuid>-<n>-" left by an earlier restore, are taken off first, so the name is the
 * same however many times a photo goes through export and import (re-imports then reuse the file).
 */
export const photoFileName = (recordUuid: string, n: number, relativePath: string): string => {
  let name = relativePath.split(/[\\/]/).pop() ?? "";
  if (relativePath.startsWith("media/")) name = name.replace(/^\d+-/, "");
  if (name.startsWith(`${recordUuid}-`)) name = name.slice(recordUuid.length + 1).replace(/^\d+-/, "");
  name = name.replace(/[^A-Za-z0-9._-]/g, "");
  if (name.length > 80) name = name.slice(name.length - 80);
  if (name === "" || /^\.+$/.test(name)) name = "photo";
  else if (name.startsWith(".")) name = `photo${name}`;
  return `${recordUuid}-${n}-${name}`;
};

// ---------- File helpers ----------

const imagesDirectory = () => `${FileSystem.documentDirectory}images/`;

const info = async (uri: string, md5 = false): Promise<{ exists: boolean; isDirectory: boolean; md5?: string }> => {
  try {
    const i = await FileSystem.getInfoAsync(uri, { md5 });
    return i.exists ? { exists: true, isDirectory: i.isDirectory, md5: i.md5 } : { exists: false, isDirectory: false };
  } catch {
    return { exists: false, isDirectory: false };
  }
};

const readText = async (uri: string): Promise<string | undefined> => {
  const i = await info(uri);
  if (!i.exists || i.isDirectory) return undefined;
  return FileSystem.readAsStringAsync(uri);
};

/** Every file under `root`, as paths relative to `contentDir` ("media/<uuid>/1-a.jpg"). */
const listFiles = async (contentDir: string, root: MediaRoot): Promise<string[]> => {
  const out: string[] = [];
  const walk = async (relative: string, depth: number) => {
    if (depth > 4) return;
    let names: string[];
    try {
      names = await FileSystem.readDirectoryAsync(joinUri(contentDir, relative));
    } catch {
      return;
    }
    for (const name of names) {
      const child = `${relative}/${name}`;
      const i = await info(joinUri(contentDir, child));
      if (i.isDirectory) await walk(child, depth + 1);
      else if (i.exists && isSafeMediaPath(child, root)) out.push(child);
    }
  };
  const top = await info(joinUri(contentDir, root));
  if (top.exists && top.isDirectory) await walk(root, 0);
  return out;
};

const isCancel = (error: unknown): boolean => {
  const e = error as { code?: unknown; message?: unknown } | null;
  return (
    (typeof e?.code === "string" && /cancel/i.test(e.code)) ||
    (typeof e?.message === "string" && /cancel/i.test(e.message))
  );
};

const firstProblem = (problems: string[]): string =>
  problems.length > 1 ? `${problems[0]} (and ${problems.length - 1} more problems)` : problems[0];

/** The export's own note about photos missing on the old phone; the sheet already says that from missingMedia. */
const MISSING_PHOTOS_WARNING = /photos listed on records were not found on the phone/;

/** The notes shown before a v2 import: the export's own notes (less the missing-photos one), then what the check found. */
export const previewWarnings = (manifestWarnings: unknown, found: string[]): string[] => [
  ...(Array.isArray(manifestWarnings) ? manifestWarnings : []).filter(
    (w): w is string => typeof w === "string" && !MISSING_PHOTOS_WARNING.test(w),
  ),
  ...found,
];

// ---------- Pick and stage ----------

/** Where the unzipped backup starts: the folder itself, or its one sub-folder when the zip wraps everything in one. */
const findContentRoot = async (unzipped: string): Promise<{ dir: string; kind: "v2" | "legacy" } | null> => {
  const detect = async (dir: string) => {
    if ((await info(joinUri(dir, MANIFEST_FILE))).exists) return "v2" as const;
    const legacy = await Promise.all(LEGACY_FILES.map(async (f) => (await info(joinUri(dir, f))).exists));
    return legacy.every(Boolean) ? ("legacy" as const) : null;
  };
  const kind = await detect(unzipped);
  if (kind) return { dir: unzipped, kind };
  const entries = (await FileSystem.readDirectoryAsync(unzipped)).filter((n) => n !== "__MACOSX");
  if (entries.length === 1 && (await info(joinUri(unzipped, entries[0]))).isDirectory) {
    const inner = `${joinUri(unzipped, entries[0])}/`;
    const innerKind = await detect(inner);
    if (innerKind) return { dir: inner, kind: innerKind };
  }
  return null;
};

/** Old exports were named export_<ms>.zip; that is the only date an old backup carries. */
const legacyDate = (file: PickedFile): string | null => {
  try {
    const text = `${typeof file.name === "string" ? file.name : ""} ${decodeURIComponent(file.uri)}`;
    const m = /export_(\d{13})\.zip/.exec(text);
    return m ? new Date(Number(m[1])).toISOString() : null;
  } catch {
    return null;
  }
};

const stageV2 = async (contentDir: string): Promise<Omit<StagedImport, "dir" | "contentDir">> => {
  const manifestText = (await readText(joinUri(contentDir, MANIFEST_FILE))) ?? null;
  const files: Record<string, string | undefined> = {};
  for (const k of TABLE_KEYS) files[DATA_FILES[k]] = await readText(joinUri(contentDir, DATA_FILES[k]));
  const mediaPaths = await listFiles(contentDir, "media");

  const result = validateBackup({ manifestText, files, mediaPaths: new Set(mediaPaths) });
  if (!result.ok) throw new BackupError(firstProblem(result.errors));
  const { manifest, data } = result;

  const plan = planMerge(data, await readSnapshot());
  const missing = manifest.media && typeof manifest.media.missing === "number" ? manifest.media.missing : 0;
  const warnings = previewWarnings(manifest.warnings, result.warnings);
  return {
    data,
    plan,
    mediaPaths,
    preview: {
      kind: "v2",
      createdAt: typeof manifest.createdAt === "string" ? manifest.createdAt : null,
      counts: countRows(data),
      merge: plan.summary,
      billNoClashes: plan.billNoClashes,
      missingMedia: missing,
      warnings,
    },
  };
};

const stageLegacy = async (contentDir: string, picked: PickedFile): Promise<Omit<StagedImport, "dir" | "contentDir">> => {
  const parsed: Record<string, unknown> = {};
  for (const name of LEGACY_FILES) {
    try {
      parsed[name] = JSON.parse((await readText(joinUri(contentDir, name))) ?? "");
    } catch {
      throw new BackupError(`Backup is damaged: ${name} could not be read`);
    }
  }
  const rows = LEGACY_FILES.reduce((n, f) => n + (Array.isArray(parsed[f]) ? (parsed[f] as unknown[]).length : 0), 0);
  const pool = await newUuids(rows + 16);
  const newUuid = (): string => {
    const next = pool.pop();
    if (!next) throw new BackupError("Could not make record ids for the old backup");
    return next;
  };
  const { data, warnings } = convertLegacy(
    { users: parsed["users.json"], rehan: parsed["rehan.json"], lenden: parsed["lenden.json"] },
    newUuid,
  );

  // Old exports kept the phone path of a photo they could not find; those photos are not in the zip.
  const mediaPaths = await listFiles(contentDir, "images");
  const inZip = new Set(mediaPaths);
  let missingMedia = 0;
  const keep = (media: string[]) => {
    const kept = media.filter((p) => inZip.has(p));
    missingMedia += media.length - kept.length;
    return kept;
  };
  data.rehan = data.rehan.map((r) => ({ ...r, media: keep(r.media) }));
  data.lenden = data.lenden.map((l) => ({ ...l, media: keep(l.media) }));

  const problems = validateData(data, inZip);
  if (problems.length > 0) throw new BackupError(firstProblem(problems));

  return {
    data,
    plan: null,
    mediaPaths,
    preview: {
      kind: "legacy",
      createdAt: legacyDate(picked),
      counts: countRows(data),
      merge: null,
      billNoClashes: [],
      missingMedia,
      warnings,
    },
  };
};

export type StagePhase = "reading" | "checking";

/**
 * Lets the owner pick a backup zip, then unzips, validates and plans it without touching the ledger.
 * Returns null when the owner cancels the picker. Throws BackupError with a message for the owner.
 * Any file type can be picked (a zip shared through WhatsApp or Drive may be labelled octet-stream); a file that is not
 * a backup fails with "Not an AJ backup".
 */
export const pickAndStageBackup = async (onPhase?: (phase: StagePhase) => void): Promise<StagedImport | null> => {
  let picked: PickedFile;
  try {
    const result = await File.pickFileAsync();
    const file = Array.isArray(result) ? result[0] : result;
    if (!file) return null;
    picked = file;
  } catch (error) {
    if (isCancel(error)) return null;
    console.error("Backup pick failed:", error);
    throw new BackupError("Could not open the chosen file");
  }
  return stageFrom(picked, onPhase);
};

/** Stages a backup zip that is already on the phone (for example an automatic backup), without the picker. */
export const stageBackupFrom = (uri: string, onPhase?: (phase: StagePhase) => void): Promise<StagedImport> =>
  stageFrom({ uri }, onPhase);

const stageFrom = async (picked: PickedFile, onPhase?: (phase: StagePhase) => void): Promise<StagedImport> => {
  onPhase?.("reading");
  // Staging folders left behind when the app was closed in the middle of an import or export.
  try {
    const cache = FileSystem.cacheDirectory as string;
    for (const name of await FileSystem.readDirectoryAsync(cache)) {
      if (/^(import|backup-stage)-\d+$/.test(name)) await FileSystem.deleteAsync(cache + name, { idempotent: true });
    }
  } catch {
    // Best effort.
  }
  const dir = `${FileSystem.cacheDirectory}import-${Date.now()}/`;
  const unzipped = `${dir}content/`;
  try {
    await FileSystem.makeDirectoryAsync(unzipped, { intermediates: true });
    const zipUri = `${dir}backup.zip`;
    try {
      await FileSystem.copyAsync({ from: picked.uri, to: zipUri });
    } catch (error) {
      console.error("Backup copy failed:", error);
      throw new BackupError("Could not read the chosen file");
    }
    try {
      await unzip(zipUri, unzipped);
    } catch (error) {
      console.error("Backup unzip failed:", error);
      throw new BackupError("Not an AJ backup (the file is not a readable zip)");
    }

    const root = await findContentRoot(unzipped);
    if (!root) throw new BackupError("Not an AJ backup");

    onPhase?.("checking");
    const staged = root.kind === "v2" ? await stageV2(root.dir) : await stageLegacy(root.dir, picked);
    return { ...staged, dir, contentDir: root.dir };
  } catch (error) {
    await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => undefined);
    if (error instanceof BackupError) throw error;
    console.error("Backup staging failed:", error);
    throw new BackupError("The backup could not be read");
  }
};

/** Deletes the staging folder. Safe to call more than once. */
export const discardStagedImport = async (staged: StagedImport): Promise<void> => {
  await FileSystem.deleteAsync(staged.dir, { idempotent: true }).catch(() => undefined);
};

// ---------- Apply ----------

/**
 * Copies one photo into the images folder as <recordUuid>-<n>-<name>. A file already there with the same content is
 * reused (so re-imports are idempotent); a different file with that name is never overwritten.
 */
const placePhoto = async (
  source: string,
  recordUuid: string,
  n: number,
  relativePath: string,
  copied: string[],
): Promise<string> => {
  const base = photoFileName(recordUuid, n, relativePath);
  const sourceMd5 = (await info(source, true)).md5;
  for (let attempt = 1; attempt <= 20; attempt++) {
    const name = attempt === 1 ? base : base.replace(`${recordUuid}-${n}-`, `${recordUuid}-${n}-${attempt}-`);
    const target = imagesDirectory() + name;
    const existing = await info(target, true);
    if (!existing.exists) {
      await FileSystem.copyAsync({ from: source, to: target });
      copied.push(target);
      return target;
    }
    if (!existing.isDirectory && sourceMd5 && existing.md5 === sourceMd5) return target;
  }
  throw new BackupError(`Photo ${relativePath} could not be saved`);
};

/**
 * Writes a staged backup into the ledger. Replace first saves an emergency backup of the phone and stops if that
 * fails. Photos are copied before the database is touched; if anything fails, the photos this import copied are
 * deleted and the database transaction rolls back. The staging folder is always deleted.
 */
export const applyImport = async (
  staged: StagedImport,
  mode: ImportMode,
  onProgress?: (step: string) => void,
): Promise<ImportResult> => {
  const copied: string[] = [];
  try {
    if (mode === "merge" && !staged.plan) {
      throw new BackupError("Safe merge is not available for an old backup. Use Replace & restore.");
    }
    if (mode === "replace") {
      onProgress?.("Saving an automatic backup…");
      try {
        await writeEmergencyBackup();
      } catch (error) {
        console.error("Emergency backup failed:", error);
        const reason = error instanceof BackupError ? ` ${error.message}` : "";
        throw new BackupError(`Could not save a backup of this phone first, so nothing was changed.${reason}`);
      }
    }

    onProgress?.("Importing…");
    const root: MediaRoot = staged.preview.kind === "v2" ? "media" : "images";
    const inZip = new Set(staged.mediaPaths);
    const records =
      mode === "replace" || !staged.plan
        ? [...staged.data.rehan, ...staged.data.lenden]
        : [...staged.plan.insert.rehan, ...staged.plan.insert.lenden];

    await FileSystem.makeDirectoryAsync(imagesDirectory(), { intermediates: true });
    const mediaMap = new Map<string, string>();
    for (const record of records) {
      for (let i = 0; i < record.media.length; i++) {
        const rel = record.media[i];
        if (!isSafeMediaPath(rel, root) || !inZip.has(rel)) {
          throw new BackupError(`Missing photos: ${rel} is not in the backup`);
        }
        const source = joinUri(staged.contentDir, rel);
        const found = await info(source);
        if (!found.exists || found.isDirectory) throw new BackupError(`Missing photos: ${rel} is not in the backup`);
        mediaMap.set(mediaKey(record.uuid, rel), await placePhoto(source, record.uuid, i + 1, rel, copied));
      }
    }

    if (mode === "replace" || !staged.plan) {
      const counts = await applyReplace(staged.data, mediaMap);
      return {
        mode,
        inserted: TABLE_KEYS.reduce((n, k) => n + counts[k], 0),
        skipped: 0,
        conflicts: 0,
        photos: mediaMap.size,
      };
    }
    const plan = staged.plan;
    const counts = await applyMerge(plan, mediaMap);
    return {
      mode,
      inserted: TABLE_KEYS.reduce((n, k) => n + counts[k], 0),
      skipped: TABLE_KEYS.reduce((n, k) => n + plan.summary[k].same, 0),
      conflicts: plan.conflicts.length,
      photos: mediaMap.size,
    };
  } catch (error) {
    for (const path of copied) await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    if (error instanceof BackupError) throw error;
    console.error("Backup import failed:", error);
    throw new BackupError("The backup could not be imported. Nothing was changed.");
  } finally {
    await discardStagedImport(staged);
  }
};
