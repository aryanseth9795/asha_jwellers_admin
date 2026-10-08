import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { PAPER, PaperSize } from "./bill/geometry";

// ~151 KB of base64 that never changes — read it once per app session.
let cachedTemplate: string | null = null;

export async function loadTemplateDataUri(): Promise<string> {
  if (cachedTemplate) return cachedTemplate;

  const asset = Asset.fromModule(require("../../assets/bill-template.jpg"));
  await asset.downloadAsync();

  const uri = asset.localUri ?? asset.uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });

  cachedTemplate = `data:image/jpeg;base64,${base64}`;
  return cachedTemplate;
}

/** Renders the bill HTML to a PDF of the given paper in the cache and returns its file URI. */
async function renderPdf(html: string, paper: PaperSize): Promise<string> {
  const { uri } = await Print.printToFileAsync({
    html,
    width: PAPER[paper].widthPt,
    height: PAPER[paper].heightPt,
    base64: false,
  });
  return uri;
}

/** Renders the bill to a PDF of its paper, named bill_<billNo>.pdf, and opens the share sheet. */
export async function sharePdf(html: string, billNo: number, paper: PaperSize): Promise<void> {
  const uri = await renderPdf(html, paper);

  // printToFileAsync emits a random filename; rename so the customer receives
  // a file called bill_9267.pdf rather than a UUID.
  const target = `${FileSystem.cacheDirectory}bill_${billNo}.pdf`;
  await FileSystem.deleteAsync(target, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: target });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(target, {
    mimeType: "application/pdf",
    dialogTitle: `बिल नं. ${billNo}`,
    UTI: "com.adobe.pdf",
  });
}

/**
 * Opens the native print dialog on the same PDF that sharing makes. Printing raw HTML would let Android lay it out
 * on Letter paper first and then again on whatever the dialog picks, so pages could break differently. The dialog
 * still picks the paper itself, so an A4 bill needs A4 chosen there.
 */
export async function printBill(html: string, paper: PaperSize): Promise<void> {
  const uri = await renderPdf(html, paper);
  await Print.printAsync({ uri });
}
