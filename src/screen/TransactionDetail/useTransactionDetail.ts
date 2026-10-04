import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout, confirm, notify } from "../../ui";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  RootStackParamList,
  JamaEntry,
  NewLendenItem,
  NewOldJewelleryItem,
} from "../../types/entry";
import {
  getRehanById,
  getLendenById,
  getUserById,
  updateRehanDetails,
  updateLendenDetails,
  closeRehan,
  getJamaEntriesByLendenId,
  createJamaEntry,
  deleteJamaEntry,
  updateLendenBaki,
  editJamaEntry,
} from "../../database/entryDatabase";
import { User, Rehan, Lenden } from "../../types/entry";
import { saveImages } from "../../storage/fileStorage";
import { getCategoryOptions } from "../../database/itemCategories";
import { BASE_CATEGORIES, resolveCategory } from "../../utils/itemCategories";
import {
  getLendenItems,
  replaceLendenItems,
  setLendenAmountOverridden,
} from "../../database/lendenItems";
import {
  getLendenOldJewelleryItems,
  replaceLendenOldJewelleryItems,
} from "../../database/lendenOldJewelleryItems";
import { sumItemTotals } from "../../utils/lendenAmount";
import {
  calculateLendenSettlement,
  sumOldJewelleryValues,
} from "../../utils/lendenSettlement";
import { toDay, toLocalDate } from "../../utils/dates";
import {
  getRehanTransactionsByRehanId,
  createRehanTransaction,
  deleteRehanTransaction,
} from "../../database/entryDatabase";
import { RehanTransaction } from "../../types/entry";

type TransactionDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "TransactionDetail"
>;

type TransactionDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  "TransactionDetail"
>;

export interface Props {
  navigation: TransactionDetailScreenNavigationProp;
  route: TransactionDetailScreenRouteProp;
}

export const useTransactionDetail = ({ navigation, route }: Props) => {
  const { transactionId, transactionType } = route.params;
  const { mediaTile } = useLayout();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  // A failed read shows a retry state, never "Transaction not found" or a half-filled bill.
  const [loadError, setLoadError] = useState(false);
  // Set while a baki recalculation after a jama change has not finished, so Retry finishes it before reloading.
  const bakiRecomputePending = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rehan, setRehan] = useState<Rehan | null>(null);
  const [lenden, setLenden] = useState<Lenden | null>(null);
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [originalMediaPaths, setOriginalMediaPaths] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Editable fields state
  const [editProductName, setEditProductName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [originalProductName, setOriginalProductName] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [originalCategory, setOriginalCategory] = useState("");

  // Lenden-specific edit fields
  const [editDiscount, setEditDiscount] = useState("");
  const [editRemaining, setEditRemaining] = useState("");
  const [editJama, setEditJama] = useState("");
  const [editBaki, setEditBaki] = useState("");
  const [originalDiscount, setOriginalDiscount] = useState("");
  const [originalRemaining, setOriginalRemaining] = useState("");
  const [originalJama, setOriginalJama] = useState("");
  const [originalBaki, setOriginalBaki] = useState("");

  // Jama Entries for Lenden
  const [jamaEntries, setJamaEntries] = useState<JamaEntry[]>([]);
  const [showAddJamaModal, setShowAddJamaModal] = useState(false);
  const [editingJamaIndex, setEditingJamaIndex] = useState<number | null>(null);
  const isEditingJama = editingJamaIndex !== null;

  // Jewellery line items (Lenden only)
  const [lendenItems, setLendenItems] = useState<NewLendenItem[]>([]);
  const [originalLendenItems, setOriginalLendenItems] = useState<
    NewLendenItem[]
  >([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const [oldJewelleryItems, setOldJewelleryItems] = useState<
    NewOldJewelleryItem[]
  >([]);
  const [originalOldJewelleryItems, setOriginalOldJewelleryItems] = useState<
    NewOldJewelleryItem[]
  >([]);
  const [showOldJewelleryModal, setShowOldJewelleryModal] = useState(false);
  const [editingOldJewelleryIndex, setEditingOldJewelleryIndex] = useState<
    number | null
  >(null);

  const itemsTotal = sumItemTotals(lendenItems);
  const oldJewelleryCredit = sumOldJewelleryValues(oldJewelleryItems);

  // Rehan Transactions
  const [rehanTransactions, setRehanTransactions] = useState<
    RehanTransaction[]
  >([]);
  const [showAddRehanTransactionModal, setShowAddRehanTransactionModal] =
    useState(false);

  // A Len-Den total is always the sum of its jewellery items.
  useEffect(() => {
    if (transactionType !== "lenden" || !isEditMode) return;
    if (lendenItems.length === 0) return;
    setEditAmount(String(itemsTotal));
  }, [itemsTotal, lendenItems.length, transactionType, isEditMode]);

  // Auto-calculate Remaining = Amount - Discount (only for lenden in edit mode)
  useEffect(() => {
    if (transactionType === "lenden" && isEditMode) {
      const amount = parseInt(editAmount, 10) || 0;
      const disc = parseInt(editDiscount, 10) || 0;
      const calc = amount - disc - oldJewelleryCredit;
      setEditRemaining(calc > 0 ? calc.toString() : "0");
    }
  }, [
    editAmount,
    editDiscount,
    oldJewelleryCredit,
    transactionType,
    isEditMode,
  ]);

  // Auto-calculate Baki = Remaining - Jama (only for lenden in edit mode)
  useEffect(() => {
    if (transactionType === "lenden" && isEditMode) {
      const rem = parseInt(editRemaining, 10) || 0;
      const jam = parseInt(editJama, 10) || 0;
      const calc = rem - jam;
      setEditBaki(calc >= 0 ? calc.toString() : "0");
    }
  }, [editRemaining, editJama, transactionType, isEditMode]);

  useEffect(() => {
    loadData();
  }, [transactionId, transactionType]);

  useEffect(() => {
    // Check if media or details have changed
    const mediaChanged =
      JSON.stringify(mediaPaths) !== JSON.stringify(originalMediaPaths);
    const productNameChanged = editProductName !== originalProductName;
    const amountChanged = editAmount !== originalAmount;
    const categoryChanged = editCategory.trim() !== originalCategory.trim();
    const discountChanged = editDiscount !== originalDiscount;
    const remainingChanged = editRemaining !== originalRemaining;
    const jamaChanged = editJama !== originalJama;
    const bakiChanged = editBaki !== originalBaki;
    const lendenItemsChanged =
      JSON.stringify(lendenItems) !== JSON.stringify(originalLendenItems);
    const oldJewelleryItemsChanged =
      JSON.stringify(oldJewelleryItems) !==
      JSON.stringify(originalOldJewelleryItems);

    setHasChanges(
      mediaChanged ||
        productNameChanged ||
        categoryChanged ||
        amountChanged ||
        discountChanged ||
        remainingChanged ||
        jamaChanged ||
        bakiChanged ||
        lendenItemsChanged ||
        oldJewelleryItemsChanged,
    );
  }, [
    mediaPaths,
    originalMediaPaths,
    editProductName,
    originalProductName,
    editCategory,
    originalCategory,
    editAmount,
    originalAmount,
    editDiscount,
    originalDiscount,
    editRemaining,
    originalRemaining,
    editJama,
    originalJama,
    editBaki,
    originalBaki,
    lendenItems,
    originalLendenItems,
    oldJewelleryItems,
    originalOldJewelleryItems,
  ]);

  // Resolves true when everything loaded, false when a read failed (the retry state is then showing). afterSave: a write
  // has just succeeded, so a failed read is reported as "Saved, but couldn't refresh" rather than "Couldn't load".
  const loadData = async (afterSave = false): Promise<boolean> => {
    try {
      if (transactionType === "rehan") {
        const rehanData = await getRehanById(transactionId);
        if (rehanData) {
          setRehan(rehanData);
          // Fill the edit fields from the stored record (they used to start empty).
          const storedName = rehanData.productName ?? "";
          const storedAmount = rehanData.amount ? String(rehanData.amount) : "";
          const storedCategory = rehanData.category ?? "";
          setEditProductName(storedName);
          setOriginalProductName(storedName);
          setEditAmount(storedAmount);
          setOriginalAmount(storedAmount);
          setEditCategory(storedCategory);
          setOriginalCategory(storedCategory);
          const paths = JSON.parse(rehanData.media);
          setMediaPaths(paths);
          setOriginalMediaPaths(paths);
          const userData = await getUserById(rehanData.userId);
          setUser(userData);
          // Load transactions
          const transactions =
            await getRehanTransactionsByRehanId(transactionId);
          setRehanTransactions(transactions);
        }
      } else {
        const lendenData = await getLendenById(transactionId);
        if (lendenData) {
          setLenden(lendenData);
          const paths = JSON.parse(lendenData.media);
          setMediaPaths(paths);
          setOriginalMediaPaths(paths);
          const userData = await getUserById(lendenData.userId);
          setUser(userData);

          // Initialize Lenden edit fields
          setEditAmount(lendenData.amount ? lendenData.amount.toString() : "");
          setOriginalAmount(
            lendenData.amount ? lendenData.amount.toString() : "",
          );
          setEditDiscount(
            lendenData.discount ? lendenData.discount.toString() : "",
          );
          setOriginalDiscount(
            lendenData.discount ? lendenData.discount.toString() : "",
          );
          setEditRemaining(
            lendenData.remaining ? lendenData.remaining.toString() : "",
          );
          setOriginalRemaining(
            lendenData.remaining ? lendenData.remaining.toString() : "",
          );
          setEditJama(lendenData.jama ? lendenData.jama.toString() : "");
          setOriginalJama(lendenData.jama ? lendenData.jama.toString() : "");
          setEditBaki(lendenData.baki ? lendenData.baki.toString() : "");
          setOriginalBaki(lendenData.baki ? lendenData.baki.toString() : "");

          // Load jama entries
          const entries = await getJamaEntriesByLendenId(transactionId);
          setJamaEntries(entries);

          const storedItems = await getLendenItems(transactionId);
          const mappedItems = storedItems.map((i) => ({
            uuid: i.uuid,
            name: i.name,
            category: i.category ?? null,
            metal: i.metal,
            purity: i.purity,
            weight: i.weight,
            qty: i.qty,
            rate: i.rate,
            total: i.total,
          }));
          setLendenItems(mappedItems);
          setOriginalLendenItems(mappedItems);

          const storedOldJewelleryItems =
            await getLendenOldJewelleryItems(transactionId);
          const mappedOldJewelleryItems = storedOldJewelleryItems.map((item) => ({
            uuid: item.uuid,
            description: item.description,
            metal: item.metal,
            purity: item.purity,
            weight: item.weight,
            value: item.value,
          }));
          setOldJewelleryItems(mappedOldJewelleryItems);
          setOriginalOldJewelleryItems(mappedOldJewelleryItems);
        }
      }
      setLoadError(false);
      return true;
    } catch (error) {
      if (afterSave) {
        showRefreshFailed(error);
      } else {
        console.error("Error loading transaction data:", error);
        setLoadError(true);
        notify.error("Couldn't load this transaction", "Tap Retry to try again.");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // A write that succeeded must not be reported as failed because the read after it failed, and the screen must not
  // keep showing numbers that no longer match what was saved. Show the retry state instead.
  // verb: "Saved" after a save, "Done" after a delete.
  const showRefreshFailed = (error: unknown, verb: "Saved" | "Done" = "Saved") => {
    console.error("Error refreshing after save:", error);
    notify.error(`${verb}, but couldn't refresh`, "Tap Retry to see the latest numbers.");
    setLoadError(true);
  };

  // Recalculates the bill's baki after a jama change. The flag stays set until a recalculation succeeds. A failed one sets
  // it again, because an overlapping recalculation that succeeded may have cleared it while this one was still running.
  const recomputeBaki = async () => {
    bakiRecomputePending.current = true;
    try {
      await updateLendenBaki(transactionId);
      bakiRecomputePending.current = false;
    } catch (error) {
      bakiRecomputePending.current = true;
      throw error;
    }
  };

  const retryLoad = async () => {
    setIsLoading(true);
    if (bakiRecomputePending.current) {
      try {
        await recomputeBaki();
      } catch (error) {
        console.error("Error recalculating baki:", error);
        notify.error("Couldn't update the balance", "Tap Retry to try again.");
        setIsLoading(false);
        return;
      }
    }
    await loadData();
  };

  const formatDate = (dateString: string) => {
    const date = toLocalDate(dateString);
    if (!date) return "—";
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaPermission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    return (
      cameraPermission.status === "granted" &&
      mediaPermission.status === "granted"
    );
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      notify.error(
        "Permission required",
        "Camera and media library permissions are required.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaPaths([...mediaPaths, result.assets[0].uri]);
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      notify.error(
        "Permission required",
        "Media library permission is required.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: false,
      allowsEditing: true,
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaPaths([...mediaPaths, result.assets[0].uri]);
    }
  };

  const removeImage = async (index: number) => {
    if (
      await confirm({
        title: "Remove image",
        message: "Are you sure you want to remove this image?",
        confirmLabel: "Remove",
        tone: "danger",
      })
    ) {
      const updated = mediaPaths.filter((_, i) => i !== index);
      setMediaPaths(updated);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Find new images (ones that are temp URIs, not saved paths)
      const newImages = mediaPaths.filter(
        (path) => !originalMediaPaths.includes(path),
      );

      // Save new images to storage
      let finalPaths = [...mediaPaths];
      if (newImages.length > 0) {
        const savedNewPaths = await saveImages(newImages);
        // Replace temp URIs with saved paths
        finalPaths = mediaPaths.map((path) => {
          const newIndex = newImages.indexOf(path);
          if (newIndex !== -1) {
            return savedNewPaths[newIndex];
          }
          return path;
        });
      }

      const lendenAmount =
        transactionType === "lenden" && lendenItems.length > 0
          ? itemsTotal
          : parseInt(editAmount, 10) || 0;
      const discountValue = parseInt(editDiscount, 10) || 0;
      const jamaValue = parseInt(editJama, 10) || 0;
      const lendenSettlement = calculateLendenSettlement({
        grossTotal: lendenAmount,
        oldJewelleryCredit,
        discount: discountValue,
        jamaTotal: jamaValue,
      });

      if (transactionType === "lenden" && lendenSettlement.netPayable < 0) {
        notify.error(
          "Check the amounts",
          "Old jewellery credit and discount cannot be greater than the new jewellery total.",
        );
        return;
      }
      if (transactionType === "lenden" && lendenSettlement.baki < 0) {
        notify.error(
          "Jama too high",
          "Jama payment cannot be greater than the net payable amount.",
        );
        return;
      }

      // Update database
      let savedCategory: string | undefined;
      if (transactionType === "rehan") {
        // Keep the stored category (even none) unless the admin changed the field.
        // Save does not blur the field, so resolve it here against the stored categories.
        if (editCategory.trim() !== originalCategory.trim()) {
          const options = await getCategoryOptions().catch(() => BASE_CATEGORIES);
          savedCategory = resolveCategory(editCategory, options);
        }
        await updateRehanDetails(
          transactionId,
          finalPaths,
          editProductName.trim() || undefined,
          editAmount ? parseInt(editAmount, 10) : undefined,
          savedCategory,
        );
      } else {
        await updateLendenDetails(
          transactionId,
          finalPaths,
          lendenAmount || undefined,
          discountValue || undefined,
          lendenSettlement.netPayable,
          jamaValue || undefined,
          lendenSettlement.baki,
        );
      }

      if (transactionType === "lenden") {
        await replaceLendenItems(transactionId, lendenItems);
        if (lendenItems.length > 0) {
          await setLendenAmountOverridden(transactionId, 0);
        }
        await replaceLendenOldJewelleryItems(
          transactionId,
          oldJewelleryItems,
        );
      }

      setMediaPaths(finalPaths);
      setOriginalMediaPaths(finalPaths);
      setOriginalProductName(editProductName);
      setOriginalAmount(editAmount);
      if (transactionType === "rehan" && savedCategory !== undefined) {
        setEditCategory(savedCategory);
        setOriginalCategory(savedCategory);
      }
      if (transactionType === "lenden") {
        setOriginalLendenItems(lendenItems);
        setOriginalOldJewelleryItems(oldJewelleryItems);
      }

      // Refresh local data to show updated values in UI immediately
      if (transactionType === "rehan" && rehan) {
        setRehan({
          ...rehan,
          media: JSON.stringify(finalPaths),
          productName: editProductName.trim() || undefined,
          category: savedCategory !== undefined ? savedCategory : rehan.category,
          amount: editAmount ? parseInt(editAmount, 10) : undefined,
        });
      } else if (lenden) {
        setLenden({
          ...lenden,
          media: JSON.stringify(finalPaths),
          amount: lendenAmount || undefined,
          discount: discountValue || undefined,
          remaining: lendenSettlement.netPayable,
          jama: jamaValue || undefined,
          baki: lendenSettlement.baki,
        });
        // Update original values after save
        setOriginalDiscount(editDiscount);
        setOriginalRemaining(editRemaining);
        setOriginalJama(editJama);
        setOriginalBaki(editBaki);
        setEditAmount(lendenAmount ? String(lendenAmount) : "");
        setOriginalAmount(lendenAmount ? String(lendenAmount) : "");
        setEditRemaining(String(lendenSettlement.netPayable));
        setOriginalRemaining(String(lendenSettlement.netPayable));
        setEditBaki(String(lendenSettlement.baki));
        setOriginalBaki(String(lendenSettlement.baki));
      }

      setIsEditMode(false);
      notify.success("Changes saved", "Changes saved successfully!");
    } catch (error) {
      console.error("Error saving changes:", error);
      notify.error("Couldn't save", "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseRehan = async () => {
    if (
      await confirm({
        title: "Close Rehan entry",
        message:
          "Are you sure you want to mark this entry as closed? This action cannot be undone.",
        confirmLabel: "Close entry",
        tone: "warning",
      })
    ) {
      try {
        await closeRehan(transactionId);
        // Reload data to reflect changes. The entry is closed either way, so a failed reload says "Saved, but couldn't
        // refresh" (loadData shows it) instead of announcing success on a screen that still shows the old state.
        setIsLoading(true);
        if (await loadData(true)) {
          notify.success("Entry closed", "Rehan entry has been closed.");
        }
      } catch (error) {
        console.error("Error closing Rehan:", error);
        notify.error("Couldn't close entry", "Failed to close entry. Please try again.");
      }
    }
  };

  const cancelEdit = () => {
    setMediaPaths(originalMediaPaths);
    setEditProductName(originalProductName);
    setEditCategory(originalCategory);
    setEditAmount(originalAmount);
    setEditDiscount(originalDiscount);
    setEditRemaining(originalRemaining);
    setEditJama(originalJama);
    setEditBaki(originalBaki);
    setLendenItems(originalLendenItems);
    setOldJewelleryItems(originalOldJewelleryItems);
    setIsEditMode(false);
  };

  // ---- Handlers moved out of the JSX (bodies unchanged) ----

  const openGenerateBill = () =>
    navigation.navigate("BillPreview", { lendenId: transactionId });

  const addLendenItem = () => {
    setEditingItemIndex(null);
    setShowItemModal(true);
  };
  const editLendenItem = (index: number) => {
    setEditingItemIndex(index);
    setShowItemModal(true);
  };
  const deleteLendenItem = (index: number) => {
    setLendenItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addOldJewelleryItem = () => {
    setEditingOldJewelleryIndex(null);
    setShowOldJewelleryModal(true);
  };
  const editOldJewelleryItem = (index: number) => {
    setEditingOldJewelleryIndex(index);
    setShowOldJewelleryModal(true);
  };
  const deleteOldJewelleryItem = (index: number) => {
    setOldJewelleryItems((items) =>
      items.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const openAddJama = () => setShowAddJamaModal(true);
  const openEditJama = (index: number) => {
    setEditingJamaIndex(index);
    setShowAddJamaModal(true);
  };
  const deleteJama = async (index: number) => {
    const entry = jamaEntries[index];
    if (entry?.id) {
      try {
        await deleteJamaEntry(entry.id);
      } catch (error) {
        notify.error("Couldn't delete jama", "Failed to delete jama entry");
        return;
      }
      try {
        await recomputeBaki();
        const entries =
          await getJamaEntriesByLendenId(transactionId);
        setJamaEntries(entries);
        const lendenData = await getLendenById(transactionId);
        if (lendenData) setLenden(lendenData);
      } catch (error) {
        showRefreshFailed(error, "Done");
      }
    }
  };

  const openAddRehanTransaction = () => setShowAddRehanTransactionModal(true);
  const deleteRehanTransactionById = async (id: number) => {
    if (
      await confirm({
        title: "Delete transaction",
        message: "Are you sure you want to delete this transaction?",
        confirmLabel: "Delete",
        tone: "danger",
      })
    ) {
      try {
        await deleteRehanTransaction(id);
      } catch (error) {
        notify.error("Couldn't delete transaction", "Failed to delete transaction");
        return;
      }
      try {
        // Refresh data
        const updated =
          await getRehanTransactionsByRehanId(transactionId);
        setRehanTransactions(updated);
        // Refresh balance
        const rehanData = await getRehanById(transactionId);
        if (rehanData) setRehan(rehanData);
      } catch (error) {
        showRefreshFailed(error, "Done");
      }
    }
  };

  const closeAddRehanTransactionModal = () =>
    setShowAddRehanTransactionModal(false);
  const addRehanTransaction = async (
    amount: number,
    type: RehanTransaction["type"],
    date: Date,
  ) => {
    try {
      await createRehanTransaction({
        rehanId: transactionId,
        amount,
        type,
        date: toDay(date),
      });
    } catch (error) {
      notify.error("Couldn't add transaction", "Failed to add transaction");
      return;
    }
    try {
      // Refresh data
      const updated =
        await getRehanTransactionsByRehanId(transactionId);
      setRehanTransactions(updated);
      // Refresh balance
      const rehanData = await getRehanById(transactionId);
      if (rehanData) setRehan(rehanData);
    } catch (error) {
      showRefreshFailed(error);
    }
  };

  const closeJamaModal = () => {
    setShowAddJamaModal(false);
    setEditingJamaIndex(null);
  };
  const submitJama = async (amount: number, date: Date) => {
    try {
      if (isEditingJama) {
        // Edit existing entry
        const entry = jamaEntries[editingJamaIndex!];
        if (entry?.id) {
          await editJamaEntry(entry.id, amount, toDay(date));
        }
      } else {
        // Add new entry
        await createJamaEntry({
          lendenId: transactionId,
          amount,
          date: toDay(date),
        });
      }
    } catch (error) {
      notify.error(
        isEditingJama ? "Couldn't update jama" : "Couldn't add jama",
        isEditingJama
          ? "Failed to update jama entry"
          : "Failed to add jama entry",
      );
      return;
    }
    try {
      await recomputeBaki();
      // Reload data
      const entries = await getJamaEntriesByLendenId(transactionId);
      setJamaEntries(entries);
      const lendenData = await getLendenById(transactionId);
      if (lendenData) setLenden(lendenData);
      setEditingJamaIndex(null);
    } catch (error) {
      setEditingJamaIndex(null);
      showRefreshFailed(error);
    }
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setEditingItemIndex(null);
  };
  const saveLendenItem = (item: NewLendenItem) => {
    setLendenItems((prev) => {
      if (editingItemIndex === null) return [...prev, item];
      return prev.map((existing, i) =>
        i === editingItemIndex ? item : existing,
      );
    });
  };

  const closeOldJewelleryModal = () => {
    setShowOldJewelleryModal(false);
    setEditingOldJewelleryIndex(null);
  };
  const saveOldJewelleryItem = (item: NewOldJewelleryItem) => {
    setOldJewelleryItems((items) => {
      if (editingOldJewelleryIndex === null) return [...items, item];
      return items.map((existing, index) =>
        index === editingOldJewelleryIndex ? item : existing,
      );
    });
  };

  const startEdit = () => setIsEditMode(true);
  const closeImageViewer = () => setSelectedImageIndex(null);

  // New-jewellery total shown beside the old jewellery table.
  const newJewelleryTotal =
    lendenItems.length > 0
      ? itemsTotal
      : isEditMode
        ? parseInt(editAmount, 10) || 0
        : lenden?.amount ?? 0;

  return {
    transactionId,
    transactionType,
    mediaTile,
    insets,
    isLoading,
    loadError,
    isSaving,
    user,
    rehan,
    lenden,
    mediaPaths,
    selectedImageIndex,
    setSelectedImageIndex,
    isEditMode,
    hasChanges,
    editProductName,
    setEditProductName,
    editAmount,
    setEditAmount,
    editCategory,
    setEditCategory,
    editDiscount,
    setEditDiscount,
    editRemaining,
    editJama,
    setEditJama,
    editBaki,
    jamaEntries,
    showAddJamaModal,
    editingJamaIndex,
    isEditingJama,
    lendenItems,
    showItemModal,
    editingItemIndex,
    oldJewelleryItems,
    showOldJewelleryModal,
    editingOldJewelleryIndex,
    oldJewelleryCredit,
    newJewelleryTotal,
    rehanTransactions,
    showAddRehanTransactionModal,
    retryLoad,
    formatDate,
    takePhoto,
    pickImage,
    removeImage,
    handleSaveChanges,
    handleCloseRehan,
    cancelEdit,
    openGenerateBill,
    addLendenItem,
    editLendenItem,
    deleteLendenItem,
    addOldJewelleryItem,
    editOldJewelleryItem,
    deleteOldJewelleryItem,
    openAddJama,
    openEditJama,
    deleteJama,
    openAddRehanTransaction,
    deleteRehanTransactionById,
    closeAddRehanTransactionModal,
    addRehanTransaction,
    closeJamaModal,
    submitJama,
    closeItemModal,
    saveLendenItem,
    closeOldJewelleryModal,
    saveOldJewelleryItem,
    startEdit,
    closeImageViewer,
  };
};
