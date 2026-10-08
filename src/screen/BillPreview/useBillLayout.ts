import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BillData, buildBillHtml, buildBillMeasureHtml } from "../../services/BillHtmlService";
import { estimateBillMetrics } from "../../services/bill/estimate";
import { BillLayoutPlan, pageCount, planBillLayout } from "../../services/bill/layoutPlan";
import { billLayoutKey, parseBillMetrics } from "../../services/bill/measure";

/** After this long without a measurement the bill is laid out from an estimate, so Share and Print never wait. */
const MEASURE_TIMEOUT_MS = 2500;

export interface BillLayoutState {
  /** The bill to preview: the latest planned one, or the previous one while a toggle change is re-measured. */
  html: string;
  /** True once `html` is planned for the current inputs; Share and Print wait for it. */
  ready: boolean;
  /** How many pages the bill prints on, once ready; null while it is being planned. */
  pages: number | null;
  /** Fed to the hidden measuring WebView; changes only when something that moves heights changes. */
  measureHtml: string | null;
  onMeasureMessage: (raw: string) => void;
}

/**
 * Measure → plan → render (agent/2026-10-05-adaptive-bill-layout-plan.md §5): the hidden WebView reports real
 * heights, planBillLayout turns them into a layout, and buildBillHtml renders it as script-free HTML.
 */
export function useBillLayout(data: BillData | null): BillLayoutState {
  const key = data ? billLayoutKey(data) : null;
  const [layout, setLayout] = useState<{ key: string; plan: BillLayoutPlan } | null>(null);

  // The bill number does not move any height, so only a new key starts a new measurement.
  const dataRef = useRef(data);
  dataRef.current = data;
  const measureHtml = useMemo(
    () => (key && dataRef.current ? buildBillMeasureHtml(dataRef.current, key) : null),
    [key],
  );

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => {
      const current = dataRef.current;
      if (!current) return;
      setLayout((prev) =>
        prev?.key === key ? prev : { key, plan: planBillLayout(estimateBillMetrics(current), current.paper) },
      );
    }, MEASURE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [key]);

  const onMeasureMessage = useCallback(
    (raw: string) => {
      const current = dataRef.current;
      if (!key || !current) return;
      const metrics = parseBillMetrics(raw, key, current.items.length);
      // A real measurement always wins, even one that lands after the estimate.
      if (metrics) setLayout({ key, plan: planBillLayout(metrics, current.paper) });
    },
    [key],
  );

  const plan = data && layout && layout.key === key ? layout.plan : null;
  const fresh = useMemo(() => (data && plan ? buildBillHtml(data, plan) : null), [data, plan]);
  const lastHtml = useRef("");
  if (fresh) lastHtml.current = fresh;

  return {
    html: fresh ?? lastHtml.current,
    ready: fresh !== null,
    pages: plan ? pageCount(plan) : null,
    measureHtml,
    onMeasureMessage,
  };
}
