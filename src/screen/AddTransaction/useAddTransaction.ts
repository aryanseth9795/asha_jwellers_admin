import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { notify } from "../../ui";
import {
  RootStackParamList,
  EntryType,
  NewLendenItem,
  NewOldJewelleryItem,
} from "../../types/entry";
import {
  createRehan,
  createLenden,
  createJamaEntry,
} from "../../database/entryDatabase";
import { saveImages } from "../../storage/fileStorage";
import { getCategoryOptions } from "../../database/itemCategories";
import { BASE_CATEGORIES, resolveCategory } from "../../utils/itemCategories";
import { replaceLendenItems } from "../../database/lendenItems";
import { replaceLendenOldJewelleryItems } from "../../database/lendenOldJewelleryItems";
import { sumItemTotals } from "../../utils/lendenAmount";
import {
  calculateLendenSettlement,
  sumOldJewelleryValues,
} from "../../utils/lendenSettlement";
import { toDay } from "../../utils/dates";

export type AddTransactionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "AddTransaction"
>;

export type AddTransactionScreenRouteProp = RouteProp<
  RootStackParamList,
  "AddTransaction"
>;

export interface Props {
  navigation: AddTransactionScreenNavigationProp;
  route: AddTransactionScreenRouteProp;
}

// Multiple Jama Entries
export interface LocalJamaEntry {
  amount: number;
  date: string;
}

export const useAddTransaction = ({ navigation, route }: Props) => {
  const { userId, userName, userAddress, userMobileNumber } = route.params;

  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  // Lenden-specific fields
  const [discount, setDiscount] = useState("");
  // Removed individual remaining/jama/baki states in favor of calculation

  const [jamaEntries, setJamaEntries] = useState<LocalJamaEntry[]>([]);
  const [showAddJamaModal, setShowAddJamaModal] = useState(false);

  // Jewellery line items (Lenden only)
  const [lendenItems, setLendenItems] = useState<NewLendenItem[]>([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Optional old jewellery received as credit against the new sale.
  const [oldJewelleryItems, setOldJewelleryItems] = useState<
    NewOldJewelleryItem[]
  >([]);
  const [showOldJewelleryModal, setShowOldJewelleryModal] = useState(false);
  const [editingOldJewelleryIndex, setEditingOldJewelleryIndex] = useState<
    number | null
  >(null);

  const itemsTotal = sumItemTotals(lendenItems);
  const oldJewelleryCredit = sumOldJewelleryValues(oldJewelleryItems);
  const totalJama = jamaEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const settlement = calculateLendenSettlement({
    grossTotal: itemsTotal,
    oldJewelleryCredit,
    discount: parseInt(discount, 10) || 0,
    jamaTotal: totalJama,
  });

  // Minimum date - 5 years ago
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 15);

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
        "Camera and media library permissions are required."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImages([...selectedImages, result.assets[0].uri]);
    }
  };

  const pickImages = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      notify.error(
        "Permission required",
        "Media library permission is required."
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
      setSelectedImages([...selectedImages, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(updatedImages);
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleSave = async () => {
    if (!entryType) {
      notify.error(
        "Entry type required",
        "Please select an entry type (Rehan or Len-Den)."
      );
      return;
    }

    if (entryType === "rehan" && (!amount || parseInt(amount, 10) <= 0)) {
      notify.error("Amount required", "Please enter an amount greater than zero.");
      return;
    }

    if (entryType === "lenden" && lendenItems.length === 0) {
      notify.error("Item required", "Please add at least one jewellery item.");
      return;
    }

    if (entryType === "lenden" && settlement.netPayable < 0) {
      notify.error(
        "Check the amounts",
        "Old jewellery credit and discount cannot be greater than the new jewellery total.",
      );
      return;
    }

    if (entryType === "lenden" && settlement.baki < 0) {
      notify.error(
        "Jama too high",
        "Jama payment cannot be greater than the net payable amount.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const savedImagePaths = await saveImages(selectedImages);

      if (entryType === "rehan") {
        // Save does not blur the category field, so resolve it here. Nothing chosen saves as "Other".
        const categoryOptions = await getCategoryOptions().catch(() => BASE_CATEGORIES);
        await createRehan({
          userId,
          media: savedImagePaths,
          openDate: toDay(selectedDate),
          productName: productName.trim() || undefined,
          category: resolveCategory(category, categoryOptions),
          amount: amount ? parseInt(amount, 10) : undefined,
        });
      } else {
        // Keep amount as the gross sold-jewellery total. Remaining and baki
        // are calculated after old-jewellery credit, discount, and jama.
        const lendenAmountVal = settlement.grossTotal;
        const discountVal = discount ? parseInt(discount, 10) : 0;
        const remainingVal = settlement.netPayable;
        const bakiVal = settlement.baki;

        const lendenId = await createLenden({
          userId,
          date: toDay(selectedDate),
          media: savedImagePaths,
          amount: lendenAmountVal,
          discount: discountVal,
          remaining: remainingVal,
          jama: totalJama, // Store total jama for backward compatibility
          baki: bakiVal,
          status: bakiVal === 0 ? 1 : 0, // Auto-close if baki is 0
          amountOverridden: 0,
        });

        // Create individual jama entries
        for (const entry of jamaEntries) {
          await createJamaEntry({
            lendenId,
            amount: entry.amount,
            date: entry.date,
          });
        }

        if (lendenItems.length > 0) {
          await replaceLendenItems(lendenId, lendenItems);
        }

        await replaceLendenOldJewelleryItems(
          lendenId,
          oldJewelleryItems,
        );
      }

      notify.success("Transaction saved", "Transaction added successfully!");
      navigation.goBack();
    } catch (error) {
      console.error("Error saving transaction:", error);
      notify.error("Couldn't save", "Failed to save transaction. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    userName,
    userAddress,
    userMobileNumber,
    entryType,
    setEntryType,
    selectedImages,
    isLoading,
    selectedDate,
    setSelectedDate,
    showDatePicker,
    setShowDatePicker,
    productName,
    setProductName,
    category,
    setCategory,
    amount,
    setAmount,
    discount,
    setDiscount,
    jamaEntries,
    setJamaEntries,
    showAddJamaModal,
    setShowAddJamaModal,
    lendenItems,
    setLendenItems,
    showItemModal,
    setShowItemModal,
    editingItemIndex,
    setEditingItemIndex,
    oldJewelleryItems,
    setOldJewelleryItems,
    showOldJewelleryModal,
    setShowOldJewelleryModal,
    editingOldJewelleryIndex,
    setEditingOldJewelleryIndex,
    itemsTotal,
    oldJewelleryCredit,
    minDate,
    takePhoto,
    pickImages,
    removeImage,
    formatDisplayDate,
    handleSave,
  };
};
