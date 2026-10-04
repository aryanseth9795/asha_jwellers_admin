import * as fs from "fs";
import * as path from "path";

/** Static checks that pin the UI revamp's layout rules (spec §6) on the whole source tree. */
const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
/** Every file under a directory with one of the extensions (e.g. [".ts", ".tsx"]); test files are left out unless asked for. */
const sourceUnder = (dir: string, exts: string[], withTests = false): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return sourceUnder(rel, exts, withTests);
    if (!exts.some((x) => rel.endsWith(x))) return [];
    return !withTests && /\.test\.tsx?$/.test(rel) ? [] : [rel];
  });
/** App code: App.tsx and every .ts / .tsx under src (hooks, services and utils included) except the UI layer itself and tests. */
const appFiles = ["App.tsx", ...sourceUnder("src", [".ts", ".tsx"]).filter((f) => !f.startsWith("src/ui/"))];
/** A split screen leaves `src/screen/<Name>Screen.tsx` as a one-line re-export of its folder; returns that folder name. */
const shimFolder = (src: string): string | null => {
  const m = src.trim().match(/^export\s*\{\s*default\s*\}\s*from\s*["']\.\/(\w+)["'];?$/);
  return m ? m[1] : null;
};
/** The sources that really hold a screen's code: the file itself, or, for a re-export shim, every .tsx in its folder. */
const screenSources = (rel: string): string[] => {
  const folder = shimFolder(read(rel));
  return folder ? sourceUnder(`src/screen/${folder}`, [".tsx"], true).map(read) : [read(rel)];
};
/** Names imported with `import { … } from "react-native"`. */
const rnImports = (src: string): string[] =>
  [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']react-native["']/g)].flatMap((m) =>
    m[1].split(",").map((s) => s.trim()).filter(Boolean),
  );

describe("source audit (UI revamp spec §6)", () => {
  it("imports Text and TextInput from src/ui, never straight from react-native", () => {
    const offenders = appFiles.filter((f) => rnImports(read(f)).some((s) => s === "Text" || s === "TextInput"));
    expect(offenders).toEqual([]);
  });

  it("builds every input pop-up on BottomSheet, never a bare Modal (spec §6)", () => {
    const sheets = [
      "src/components/AddJamaModal.tsx",
      "src/components/AddLendenItemModal.tsx",
      "src/components/AddOldJewelleryItemModal.tsx",
      "src/components/AddRehanTransactionModal.tsx",
      "src/components/CustomDatePicker.tsx",
    ];
    const state = sheets.map((f) => ({ f, sheet: read(f).includes("<BottomSheet"), modal: /<Modal\b/.test(read(f)) }));
    expect(state).toEqual(sheets.map((f) => ({ f, sheet: true, modal: false })));
  });

  it("keeps form inputs above the keyboard with KeyboardArea (spec §6 rule 9)", () => {
    const forms = [
      "src/screen/NewCustomerScreen.tsx",
      "src/screen/AddTransactionScreen.tsx",
      "src/screen/UpdateBhavScreen.tsx",
      "src/screen/AddEditCategoryScreen.tsx",
      "src/screen/AddEditProductScreen.tsx",
    ];
    // A split form's shim is checked through its folder: some part of it must hold the KeyboardArea.
    expect(forms.filter((f) => !screenSources(f).some((src) => src.includes("<KeyboardArea")))).toEqual([]);
  });

  it("roots every screen in Screen (spec §6 rule 1)", () => {
    const entries = fs.readdirSync(path.join(ROOT, "src/screen"), { withFileTypes: true });
    // Top-level screen files: a re-export shim defers to its folder's index.tsx, anything else must root itself.
    const roots = entries
      .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
      .map((e) => {
        const rel = `src/screen/${e.name}`;
        const folder = shimFolder(read(rel));
        return folder ? `src/screen/${folder}/index.tsx` : rel;
      });
    // Every screen folder is rooted through its index.tsx only; its other parts are exempt.
    const folders = entries.filter((e) => e.isDirectory()).map((e) => `src/screen/${e.name}/index.tsx`);
    const rooted = [...new Set([...roots, ...folders])];
    expect(rooted.filter((f) => !fs.existsSync(path.join(ROOT, f)) || !read(f).includes("<Screen"))).toEqual([]);
  });

  it("never uses SafeAreaView or KeyboardAvoidingView directly outside the UI layer", () => {
    expect(appFiles.filter((f) => /\bSafeAreaView\b/.test(read(f)))).toEqual([]);
    expect(appFiles.filter((f) => rnImports(read(f)).includes("KeyboardAvoidingView"))).toEqual([]);
  });

  it("reads the window size through useLayout, never Dimensions (spec §6 rule 3)", () => {
    expect(appFiles.filter((f) => rnImports(read(f)).includes("Dimensions"))).toEqual([]);
  });

  it("opens pop-ups only through BottomSheet; the photo viewer is the one full-screen Modal", () => {
    // Matched by screen, so the Modal may sit in TransactionDetailScreen.tsx or in any part of its split folder.
    const screenOf = (f: string) => f.replace(/^src\/screen\/(\w+?)(Screen\.tsx|\/.*)$/, "$1");
    const withModal = appFiles.filter((f) => /<Modal\b/.test(read(f)));
    expect([...new Set(withModal.map(screenOf))]).toEqual(["TransactionDetail"]);
  });

  it("exports through BackupExportService; the old ExportService is gone (backup spec §8)", () => {
    const importsOld = /from\s*["'][^"']*services\/ExportService["']|require\(\s*["'][^"']*services\/ExportService["']\s*\)/;
    expect(["App.tsx", ...sourceUnder("src", [".ts", ".tsx"], true)].filter((f) => importsOld.test(read(f)))).toEqual([]);
    expect(fs.existsSync(path.join(ROOT, "src/services/ExportService.ts"))).toBe(false);
  });

  it("shows messages through notify / confirm, never the system alert box (notifications spec §4)", () => {
    const systemAlert = /\bAlert\.alert\(|(^|[^.\w])alert\(/m;
    expect(appFiles.filter((f) => systemAlert.test(read(f)))).toEqual([]);
  });
});

describe("source audit (calendar days, hardening item 8)", () => {
  /** A calendar day is stored as plain `YYYY-MM-DD` (written with toDay), so no code outside the database and backup layers should cut one out of a UTC instant. */
  const cutFromUtc = /\.toISOString\(|\.toJSON\(|\.split\(\s*[`"']T[`"']|\.(slice|substring|substr)\(\s*0\s*,\s*10\s*\)/;
  /**
   * The few legitimate hits, each a narrow snippet in one named file, removed from the text before the check.
   * Everything else in these folders is still scanned, so a new violation in the same file would still fail.
   */
  const allowed: { file: string; snippet: string; why: string }[] = [
    {
      file: "src/services/BackupExportService.ts",
      snippet: "createdAt: new Date().toISOString(),",
      why: "the manifest's createdAt is a real instant (when the backup was made), not a calendar day",
    },
    {
      file: "src/services/BackupImportService.ts",
      snippet: "new Date(Number(m[1])).toISOString()",
      why: "an old export_<ms>.zip name carries only an instant, kept as the backup's timestamp",
    },
    {
      file: "src/utils/analytics/report/findings.ts",
      snippet: "ranked.slice(0, 10)",
      why: "the ten largest customers: an array slice, not a date",
    },
    {
      file: "src/utils/analytics/report/fixture.ts",
      snippet: "new Date(y, m - 1, d, 12).toISOString()",
      why: "shared test ledger (not a *.test.ts file) deliberately building legacy timestamp fixtures",
    },
    {
      file: "src/utils/analytics/report/fixture.ts",
      snippet: "new Date(y, m - 1, d).toISOString()",
      why: "shared test ledger: the old picker's local-midnight timestamp, built on purpose",
    },
    {
      file: "src/utils/analytics/report/fixture.ts",
      snippet: "parseDay(normalizeDay(stored)).toISOString()",
      why: "shared test ledger: the same legacy local-midnight timestamp, built from a stored day",
    },
  ];
  const scanned = (f: string): string => allowed.filter((a) => a.file === f).reduce((src, a) => src.split(a.snippet).join(""), read(f));

  it("never cuts a calendar day out of a UTC timestamp", () => {
    // src/database and src/backup are left out: they legitimately write createdAt / updatedAt instants.
    const files = ["src/screen", "src/components", "src/services", "src/utils"].flatMap((d) => sourceUnder(d, [".ts", ".tsx"]));
    expect(files.filter((f) => cutFromUtc.test(scanned(f)))).toEqual([]);
  });

  it("keeps every allowed exception live, so the list cannot go stale", () => {
    expect(allowed.filter((a) => !read(a.file).includes(a.snippet))).toEqual([]);
  });
});
