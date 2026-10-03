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
});
