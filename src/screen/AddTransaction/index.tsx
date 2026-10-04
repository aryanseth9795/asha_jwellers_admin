import React from "react";
import { View, ScrollView } from "react-native";
import { Text, Screen, KeyboardArea } from "../../ui";
import { styles } from "./styles";
import { useAddTransaction, Props } from "./useAddTransaction";
import UserInfoCard from "./UserInfoCard";
import EntryTypeSection from "./EntryTypeSection";
import RehanFields from "./RehanFields";
import LendenFields from "./LendenFields";
import DateSection from "./DateSection";
import BillSection from "./BillSection";
import SaveButton from "./SaveButton";
import TransactionSheets from "./TransactionSheets";

const AddTransactionScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
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
  } = useAddTransaction({ navigation, route });

  return (
    <Screen style={styles.container}>
      <KeyboardArea>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text style={styles.title}>New Transaction</Text>
          <Text style={styles.subtitle}>Add a new entry for {userName}</Text>

          {/* User Info Summary (Read-only) */}
          <UserInfoCard
            userName={userName}
            userAddress={userAddress}
            userMobileNumber={userMobileNumber}
          />

          {/* Entry Type Selection */}
          <EntryTypeSection entryType={entryType} setEntryType={setEntryType} />

          {/* Input Fields */}
          {entryType && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>

              {entryType === "rehan" && (
                <RehanFields
                  productName={productName}
                  setProductName={setProductName}
                  category={category}
                  setCategory={setCategory}
                  amount={amount}
                  setAmount={setAmount}
                />
              )}

              {/* Lenden-specific fields */}
              {entryType === "lenden" && (
                <LendenFields
                  lendenItems={lendenItems}
                  setLendenItems={setLendenItems}
                  setEditingItemIndex={setEditingItemIndex}
                  setShowItemModal={setShowItemModal}
                  oldJewelleryItems={oldJewelleryItems}
                  setOldJewelleryItems={setOldJewelleryItems}
                  setEditingOldJewelleryIndex={setEditingOldJewelleryIndex}
                  setShowOldJewelleryModal={setShowOldJewelleryModal}
                  itemsTotal={itemsTotal}
                  oldJewelleryCredit={oldJewelleryCredit}
                  discount={discount}
                  setDiscount={setDiscount}
                  jamaEntries={jamaEntries}
                  setJamaEntries={setJamaEntries}
                  setShowAddJamaModal={setShowAddJamaModal}
                />
              )}
            </View>
          )}

          {/* Date Selection */}
          {entryType && (
            <DateSection
              selectedDate={selectedDate}
              formatDisplayDate={formatDisplayDate}
              onOpenPicker={() => setShowDatePicker(true)}
            />
          )}

          {/* Bill Section */}
          {entryType && (
            <BillSection
              selectedImages={selectedImages}
              takePhoto={takePhoto}
              pickImages={pickImages}
              removeImage={removeImage}
            />
          )}

          {/* Save Button */}
          <SaveButton isLoading={isLoading} onSave={handleSave} />

          <TransactionSheets
            showAddJamaModal={showAddJamaModal}
            setShowAddJamaModal={setShowAddJamaModal}
            setJamaEntries={setJamaEntries}
            showItemModal={showItemModal}
            setShowItemModal={setShowItemModal}
            editingItemIndex={editingItemIndex}
            setEditingItemIndex={setEditingItemIndex}
            lendenItems={lendenItems}
            setLendenItems={setLendenItems}
            showOldJewelleryModal={showOldJewelleryModal}
            setShowOldJewelleryModal={setShowOldJewelleryModal}
            editingOldJewelleryIndex={editingOldJewelleryIndex}
            setEditingOldJewelleryIndex={setEditingOldJewelleryIndex}
            oldJewelleryItems={oldJewelleryItems}
            setOldJewelleryItems={setOldJewelleryItems}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            minDate={minDate}
          />
        </ScrollView>
      </KeyboardArea>
    </Screen>
  );
};

export default AddTransactionScreen;
