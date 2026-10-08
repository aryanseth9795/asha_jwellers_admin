import { useCallback, useEffect, useMemo, useState } from "react";
import { notify } from "../../ui";
import { Lenden, User, JamaEntry } from "../../types/entry";
import {
  getLendenById,
  getUserById,
  getJamaEntriesByLendenId,
  getLendenByUserId,
} from "../../database/entryDatabase";
import { getLendenItems, getNextBillNo, setLendenBillNo } from "../../database/lendenItems";
import { getLendenOldJewelleryItems } from "../../database/lendenOldJewelleryItems";
import { BillData } from "../../services/BillHtmlService";
import { loadTemplateDataUri, sharePdf, printBill } from "../../services/BillService";
import { resolveEffectiveAmount } from "../../utils/lendenAmount";
import { useBillLayout } from "./useBillLayout";

/** Everything the bill preview screen shows and does, apart from its layout. */
export function useBillPreview(lendenId: number) {
  const [isLoading, setIsLoading] = useState(true);
  // A failed read must not leave the spinner running or print a bill with guessed numbers.
  const [loadError, setLoadError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [billNo, setBillNo] = useState(0);
  const [billNoText, setBillNoText] = useState("");
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showTotalBaki, setShowTotalBaki] = useState(false);
  const [data, setData] = useState<BillData | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(false);

      const lenden: Lenden | null = await getLendenById(lendenId);
      if (!lenden) throw new Error("Entry not found");

      const user: User | null = await getUserById(lenden.userId);
      const items = await getLendenItems(lendenId);
      const jama: JamaEntry[] = await getJamaEntriesByLendenId(lendenId);
      const oldJewelleryItems = await getLendenOldJewelleryItems(lendenId);

      // Allocate a bill number the first time this entry is billed, so a
      // reprint always shows the same number.
      let resolvedBillNo = lenden.billNo ?? null;
      if (!resolvedBillNo) {
        resolvedBillNo = await getNextBillNo();
        await setLendenBillNo(lendenId, resolvedBillNo);
      }

      const templateDataUri = await loadTemplateDataUri();
      const amount = resolveEffectiveAmount(lenden, items);

      // Sum baki across other lenden entries for this customer (except current)
      const allLenden = await getLendenByUserId(lenden.userId);
      const otherLenden = allLenden.filter((l) => l.id !== lendenId);
      const pichlaBaki = otherLenden.reduce((sum, l) => sum + (l.baki ?? 0), 0);
      const totalBaki = pichlaBaki + (lenden.baki ?? 0);

      setBillNo(resolvedBillNo);
      setBillNoText(String(resolvedBillNo));
      setData({
        billNo: resolvedBillNo,
        date: lenden.date,
        customer: {
          name: user?.name ?? "",
          address: user?.address ?? null,
          mobile: user?.mobileNumber ?? null,
        },
        items,
        oldJewelleryItems,
        amount,
        discount: lenden.discount ?? 0,
        jamaEntries: jama.map((j) => ({ amount: j.amount, date: j.date })),
        baki: lenden.baki ?? 0,
        pichlaBaki,
        totalBaki,
        showPaymentDetails: false,
        showTotalBaki: false,
        templateDataUri,
      });
    } catch (error) {
      console.error("Error loading bill:", error);
      setLoadError(true);
      notify.error("Couldn't load this bill", "Tap Retry to try again.");
    } finally {
      setIsLoading(false);
    }
  }, [lendenId]);

  useEffect(() => {
    load();
  }, [load]);

  // The bill as printed: the loaded data with the current toggles and bill number.
  const bill = useMemo(
    () => (data ? { ...data, showPaymentDetails, showTotalBaki, billNo } : null),
    [data, showPaymentDetails, showTotalBaki, billNo],
  );
  const layout = useBillLayout(bill);

  const commitBillNo = async () => {
    const parsed = parseInt(billNoText, 10);
    if (!parsed || parsed === billNo) {
      setBillNoText(String(billNo));
      return;
    }
    await setLendenBillNo(lendenId, parsed);
    setBillNo(parsed);
  };

  const togglePaymentDetails = (value: boolean) => {
    setShowPaymentDetails(value);
    if (!value) setShowTotalBaki(false);
  };

  const handleShare = async () => {
    try {
      setIsBusy(true);
      await sharePdf(layout.html, billNo);
    } catch (error) {
      console.error("Share failed:", error);
      notify.error("PDF failed", "Could not create the PDF.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsBusy(true);
      await printBill(layout.html);
    } catch (error) {
      console.error("Print failed:", error);
      notify.error("Print failed", "Could not open the print dialog.");
    } finally {
      setIsBusy(false);
    }
  };

  return {
    isLoading,
    loadError,
    load,
    isBusy,
    billNoText,
    setBillNoText,
    commitBillNo,
    showPaymentDetails,
    togglePaymentDetails,
    showTotalBaki,
    setShowTotalBaki,
    layout,
    handleShare,
    handlePrint,
  };
}
