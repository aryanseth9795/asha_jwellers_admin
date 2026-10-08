// Measuring a bill in the preview's WebView, so the layout plan uses real heights instead of an estimate.
//
// The bill HTML itself can hold no script: the Android PDF renderer runs none (plan §3, C1). So the preview loads
// buildBillMeasureHtml in a hidden WebView, injects BILL_PROBE_JS there, and reads the heights back from its message.

import { BillMetrics, DensityMetrics } from "./layoutPlan";
import { BillData } from "./types";

/** Heights above this are not a real bill block; the message is treated as broken. */
const MAX_MM = 300;

/**
 * Identifies the inputs a measurement belongs to, so a late message from an earlier toggle state is ignored.
 * The bill number and the embedded artwork do not change any height, so they are left out.
 */
export function billLayoutKey(data: BillData): string {
  const text = JSON.stringify({ ...data, billNo: 0, templateDataUri: "" });
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${(hash >>> 0).toString(36)}-${text.length.toString(36)}`;
}

/** Injected into the measuring WebView: waits for fonts, measures both densities and posts them back as mm. */
export const BILL_PROBE_JS = `(function () {
  function mm(px) { return (px * 25.4) / 96; }
  function height(el) { return el ? mm(el.getBoundingClientRect().height) : 0; }
  function measure(density) {
    var root = document.querySelector('.measure[data-density="' + density + '"]');
    var frame = root.querySelector(".inv-frame");
    var table = root.querySelector("table.items");
    var rows = Array.prototype.slice.call(table.tBodies[0].rows).map(height);
    var thead = height(table.tHead);
    var total = height(table.tFoot);
    var rowSum = rows.reduce(function (a, b) { return a + b; }, 0);
    return {
      frameMm: mm(table.getBoundingClientRect().top - frame.getBoundingClientRect().top),
      theadMm: thead,
      rowMm: rows,
      totalRowMm: total,
      tableChromeMm: Math.max(0, height(table) - thead - rowSum - total),
      footMm: height(root.querySelector(".foot"))
    };
  }
  function report() {
    var key = document.body.getAttribute("data-key");
    var message;
    try {
      message = { v: 1, key: key, normal: measure("normal"), compact: measure("compact") };
    } catch (e) {
      message = { v: 1, key: key, error: String(e) };
    }
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(report, report);
  else report();
})();
true;`;

const isMm = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= MAX_MM;

function densityFrom(raw: unknown, itemCount: number): DensityMetrics | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { frameMm, theadMm, rowMm, totalRowMm, tableChromeMm, footMm } = r;
  if (!Array.isArray(rowMm) || rowMm.length !== itemCount || !rowMm.every(isMm)) return null;
  if (!isMm(frameMm) || !isMm(theadMm) || !isMm(totalRowMm) || !isMm(tableChromeMm) || !isMm(footMm)) return null;
  return { frameMm, theadMm, rowMm, totalRowMm, tableChromeMm, footMm };
}

/** The probe's message as metrics, or null when it is broken, stale (another key) or for a different item count. */
export function parseBillMetrics(raw: string, expectedKey: string, itemCount: number): BillMetrics | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof message !== "object" || message === null) return null;
  const m = message as Record<string, unknown>;
  if (m.v !== 1 || m.key !== expectedKey) return null;
  const normal = densityFrom(m.normal, itemCount);
  const compact = densityFrom(m.compact, itemCount);
  return normal && compact ? { v: 1, key: expectedKey, normal, compact } : null;
}
