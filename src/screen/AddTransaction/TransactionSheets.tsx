import React from "react";
import { NewLendenItem, NewOldJewelleryItem } from "../../types/entry";
import CustomDatePicker from "../../components/CustomDatePicker";
import AddJamaModal from "../../components/AddJamaModal";
import AddLendenItemModal from "../../components/AddLendenItemModal";
import AddOldJewelleryItemModal from "../../components/AddOldJewelleryItemModal";
import { toDay } from "../../utils/dates";
import { LocalJamaEntry } from "./useAddTransaction";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface TransactionSheetsProps {
  showAddJamaModal: boolean;
  setShowAddJamaModal: SetState<boolean>;
  setJamaEntries: SetState<LocalJamaEntry[]>;
  showItemModal: boolean;
  setShowItemModal: SetState<boolean>;
  editingItemIndex: number | null;
  setEditingItemIndex: SetState<number | null>;
  lendenItems: NewLendenItem[];
  setLendenItems: SetState<NewLendenItem[]>;
  showOldJewelleryModal: boolean;
  setShowOldJewelleryModal: SetState<boolean>;
  editingOldJewelleryIndex: number | null;
  setEditingOldJewelleryIndex: SetState<number | null>;
  oldJewelleryItems: NewOldJewelleryItem[];
  setOldJewelleryItems: SetState<NewOldJewelleryItem[]>;
  showDatePicker: boolean;
  setShowDatePicker: SetState<boolean>;
  selectedDate: Date;
  setSelectedDate: SetState<Date>;
  minDate: Date;
}

const TransactionSheets: React.FC<TransactionSheetsProps> = ({
  showAddJamaModal,
  setShowAddJamaModal,
  setJamaEntries,
  showItemModal,
  setShowItemModal,
  editingItemIndex,
  setEditingItemIndex,
  lendenItems,
  setLendenItems,
  showOldJewelleryModal,
  setShowOldJewelleryModal,
  editingOldJewelleryIndex,
  setEditingOldJewelleryIndex,
  oldJewelleryItems,
  setOldJewelleryItems,
  showDatePicker,
  setShowDatePicker,
  selectedDate,
  setSelectedDate,
  minDate,
}) => (
  <>
    {/* Add Jama Modal */}
    <AddJamaModal
      visible={showAddJamaModal}
      onClose={() => setShowAddJamaModal(false)}
      onAdd={(amount, date) => {
        setJamaEntries((prev) => [
          ...prev,
          { amount, date: toDay(date) },
        ]);
      }}
    />

    <AddLendenItemModal
      visible={showItemModal}
      editMode={editingItemIndex !== null}
      initialItem={
        editingItemIndex !== null ? lendenItems[editingItemIndex] : undefined
      }
      onClose={() => {
        setShowItemModal(false);
        setEditingItemIndex(null);
      }}
      onSave={(item) => {
        setLendenItems((prev) => {
          if (editingItemIndex === null) return [...prev, item];
          return prev.map((existing, i) =>
            i === editingItemIndex ? item : existing,
          );
        });
      }}
    />

    <AddOldJewelleryItemModal
      visible={showOldJewelleryModal}
      editMode={editingOldJewelleryIndex !== null}
      initialItem={
        editingOldJewelleryIndex !== null
          ? oldJewelleryItems[editingOldJewelleryIndex]
          : undefined
      }
      onClose={() => {
        setShowOldJewelleryModal(false);
        setEditingOldJewelleryIndex(null);
      }}
      onSave={(item) => {
        setOldJewelleryItems((items) => {
          if (editingOldJewelleryIndex === null) return [...items, item];
          return items.map((existing, index) =>
            index === editingOldJewelleryIndex ? item : existing,
          );
        });
      }}
    />

    {/* Custom Date Picker */}
    <CustomDatePicker
      visible={showDatePicker}
      selectedDate={selectedDate}
      onClose={() => setShowDatePicker(false)}
      onDateSelect={(date) => {
        setSelectedDate(date);
        setShowDatePicker(false);
      }}
      maximumDate={new Date()}
      minimumDate={minDate}
    />
  </>
);

export default TransactionSheets;
