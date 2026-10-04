import * as fs from "fs";
import * as path from "path";

/** Static checks that pin the UI revamp's layout rules (spec §6) on the whole source tree. */
const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const tsxUnder = (dir: string): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return tsxUnder(rel);
    return rel.endsWith(".tsx") ? [rel] : [];
  });
/** App code: App.tsx and every .tsx under src except the UI layer itself. */
const appFiles = ["App.tsx", ...tsxUnder("src").filter((f) => !f.startsWith("src/ui/"))];
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
    expect(forms.filter((f) => !read(f).includes("<KeyboardArea"))).toEqual([]);
  });

  const screens = tsxUnder("src/screen");

  it("roots every screen in Screen (spec §6 rule 1)", () => {
    expect(screens.filter((f) => !read(f).includes("<Screen"))).toEqual([]);
  });

  it("never uses SafeAreaView or KeyboardAvoidingView directly outside the UI layer", () => {
    expect(appFiles.filter((f) => /\bSafeAreaView\b/.test(read(f)))).toEqual([]);
    expect(appFiles.filter((f) => rnImports(read(f)).includes("KeyboardAvoidingView"))).toEqual([]);
  });

  it("reads the window size through useLayout, never Dimensions (spec §6 rule 3)", () => {
    expect(appFiles.filter((f) => rnImports(read(f)).includes("Dimensions"))).toEqual([]);
  });

  it("opens pop-ups only through BottomSheet; the photo viewer is the one full-screen Modal", () => {
    expect(appFiles.filter((f) => /<Modal\b/.test(read(f)))).toEqual(["src/screen/TransactionDetailScreen.tsx"]);
  });

  it("exports through BackupExportService; the old ExportService is gone (backup spec §8)", () => {
    const codeUnder = (dir: string): string[] =>
      fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) return codeUnder(rel);
        return /\.tsx?$/.test(rel) ? [rel] : [];
      });
    const importsOld = /from\s*["'][^"']*services\/ExportService["']|require\(\s*["'][^"']*services\/ExportService["']\s*\)/;
    expect(["App.tsx", ...codeUnder("src")].filter((f) => importsOld.test(read(f)))).toEqual([]);
    expect(fs.existsSync(path.join(ROOT, "src/services/ExportService.ts"))).toBe(false);
  });

  it("shows messages through notify / confirm, never the system alert box (notifications spec §4)", () => {
    const systemAlert = /\bAlert\.alert\(|(^|[^.\w])alert\(/m;
    expect(appFiles.filter((f) => systemAlert.test(read(f)))).toEqual([]);
  });
});

describe("source audit (calendar days, hardening item 8)", () => {
  /** Every .ts / .tsx file under a directory, tests excluded (hooks and style files of a split screen included). */
  const sourceUnder = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) return sourceUnder(rel);
      return /\.tsx?$/.test(rel) && !/\.test\.tsx?$/.test(rel) ? [rel] : [];
    });

  it("writes a picked date with toDay, never as a UTC timestamp", () => {
    // Screens and components never write createdAt / updatedAt (the database layer does), so a toISOString() or a
    // split("T") there cuts a calendar day out of a UTC instant: 15 Sept picked in IST would be stored as ...-14T18:30Z.
    const cutFromUtc = /\.toISOString\(\)|\.split\(\s*["']T["']\s*\)/;
    const files = [...sourceUnder("src/screen"), ...sourceUnder("src/components")];
    expect(files.filter((f) => cutFromUtc.test(read(f)))).toEqual([]);
  });
});
