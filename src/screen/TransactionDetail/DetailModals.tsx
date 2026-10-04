import React from "react";
import AddJamaModal from "../../components/AddJamaModal";
import AddRehanTransactionModal from "../../components/AddRehanTransactionModal";
import AddLendenItemModal from "../../components/AddLendenItemModal";
import AddOldJewelleryItemModal from "../../components/AddOldJewelleryItemModal";
import {
  JamaEntry,
  NewLendenItem,
  NewOldJewelleryItem,
} from "../../types/entry";

interface Props {
  showAddRehanTransactionModal: boolean;
  closeAddRehanTransactionModal: () => void;
  addRehanTransaction: (
    amount: number,
    type: "jama" | "diya",
    date: Date,
  ) => void | Promise<void>;
  showAddJamaModal: boolean;
  closeJamaModal: () => void;
  isEditingJama: boolean;
  editingJamaIndex: number | null;
  jamaEntries: JamaEntry[];
  submitJama: (amount: number, date: Date) => void | Promise<void>;
  showItemModal: boolean;
  editingItemIndex: number | null;
  lendenItems: NewLendenItem[];
  closeItemModal: () => void;
  saveLendenItem: (item: NewLendenItem) => void;
  showOldJewelleryModal: boolean;
  editingOldJewelleryIndex: number | null;
  oldJewelleryItems: NewOldJewelleryItem[];
  closeOldJewelleryModal: () => void;
  saveOldJewelleryItem: (item: NewOldJewelleryItem) => void;
}

const DetailModals: React.FC<Props> = ({
  showAddRehanTransactionModal,
  closeAddRehanTransactionModal,
  addRehanTransaction,
  showAddJamaModal,
  closeJamaModal,
  isEditingJama,
  editingJamaIndex,
  jamaEntries,
  submitJama,
  showItemModal,
  editingItemIndex,
  lendenItems,
  closeItemModal,
  saveLendenItem,
  showOldJewelleryModal,
  editingOldJewelleryIndex,
  oldJewelleryItems,
  closeOldJewelleryModal,
  saveOldJewelleryItem,
}) => {
  return (
    <>
      {/* Add Rehan Transaction Modal */}
      <AddRehanTransactionModal
        visible={showAddRehanTransactionModal}
        onClose={closeAddRehanTransactionModal}
        onAdd={addRehanTransaction}
      />

      {/* Add/Edit Jama Modal */}
      <AddJamaModal
        visible={showAddJamaModal}
        onClose={closeJamaModal}
        editMode={isEditingJama}
        initialAmount={
          isEditingJama ? jamaEntries[editingJamaIndex!]?.amount : undefined
        }
        initialDate={
          isEditingJama ? jamaEntries[editingJamaIndex!]?.date : undefined
        }
        onAdd={submitJama}
      />

      <AddLendenItemModal
        visible={showItemModal}
        editMode={editingItemIndex !== null}
        initialItem={
          editingItemIndex !== null ? lendenItems[editingItemIndex] : undefined
        }
        onClose={closeItemModal}
        onSave={saveLendenItem}
      />

      <AddOldJewelleryItemModal
        visible={showOldJewelleryModal}
        editMode={editingOldJewelleryIndex !== null}
        initialItem={
          editingOldJewelleryIndex !== null
            ? oldJewelleryItems[editingOldJewelleryIndex]
            : undefined
        }
        onClose={closeOldJewelleryModal}
        onSave={saveOldJewelleryItem}
      />
    </>
  );
};

export default DetailModals;
