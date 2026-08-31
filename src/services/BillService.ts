import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

// A5 in PostScript points: 148mm x 210mm.
const A5_WIDTH_PT = 420;
const A5_HEIGHT_PT = 595;

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

/** Renders the bill to an A5 PDF named bill_<billNo>.pdf and opens the share sheet. */
export async function sharePdf(html: string, billNo: number): Promise<void> {
  const { uri } = await Print.printToFileAsync({
    html,
    width: A5_WIDTH_PT,
    height: A5_HEIGHT_PT,
    base64: false,
  });

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

/** Opens the native print dialog. */
export async function printBill(html: string): Promise<void> {
  await Print.printAsync({ html });
}
