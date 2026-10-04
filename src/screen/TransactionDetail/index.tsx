import React from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, Screen, KeyboardArea, LoadError } from "../../ui";
import { useTransactionDetail, Props } from "./useTransactionDetail";
import TypeBadgeRow from "./TypeBadgeRow";
import TransactionDetailsSection from "./TransactionDetailsSection";
import JewelleryItemsSection from "./JewelleryItemsSection";
import OldJewellerySection from "./OldJewellerySection";
import PaymentSummarySection from "./PaymentSummarySection";
import RehanHistorySection from "./RehanHistorySection";
import DetailModals from "./DetailModals";
import CustomerInfoSection from "./CustomerInfoSection";
import DateInfoSection from "./DateInfoSection";
import BillSection from "./BillSection";
import ActionButtons from "./ActionButtons";
import SaveFooter from "./SaveFooter";
import ImageViewerModal from "./ImageViewerModal";
import { styles } from "./styles";

const TransactionDetailScreen: React.FC<Props> = (props) => {
  const t = useTransactionDetail(props);
  const { transactionType, rehan, lenden, user, isEditMode } = t;

  if (t.isLoading) {
    return (
      <Screen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </Screen>
    );
  }

  if (t.loadError) {
    return (
      <Screen style={styles.container}>
        <LoadError title="Couldn't load this transaction" onRetry={t.retryLoad} />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>Transaction not found</Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <KeyboardArea>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type Badge */}
        <TypeBadgeRow transactionType={transactionType} rehan={rehan} />

        {/* Transaction Details Section */}
        <TransactionDetailsSection
          transactionType={transactionType}
          isEditMode={isEditMode}
          rehan={rehan}
          lenden={lenden}
          editProductName={t.editProductName}
          setEditProductName={t.setEditProductName}
          editCategory={t.editCategory}
          setEditCategory={t.setEditCategory}
          editAmount={t.editAmount}
          setEditAmount={t.setEditAmount}
          editDiscount={t.editDiscount}
          setEditDiscount={t.setEditDiscount}
          editRemaining={t.editRemaining}
          editJama={t.editJama}
          setEditJama={t.setEditJama}
          editBaki={t.editBaki}
        />

        {transactionType === "lenden" && (
          <JewelleryItemsSection
            lendenItems={t.lendenItems}
            isEditMode={isEditMode}
            onAdd={t.addLendenItem}
            onEdit={t.editLendenItem}
            onDelete={t.deleteLendenItem}
          />
        )}

        {transactionType === "lenden" && (
          <OldJewellerySection
            oldJewelleryItems={t.oldJewelleryItems}
            newJewelleryTotal={t.newJewelleryTotal}
            isEditMode={isEditMode}
            onAdd={t.addOldJewelleryItem}
            onEdit={t.editOldJewelleryItem}
            onDelete={t.deleteOldJewelleryItem}
          />
        )}

        {/* Jama Entries BillTable for Lenden */}
        {transactionType === "lenden" && lenden && (lenden.amount || 0) > 0 && (
          <PaymentSummarySection
            lenden={lenden}
            oldJewelleryCredit={t.oldJewelleryCredit}
            jamaEntries={t.jamaEntries}
            isEditMode={isEditMode}
            onAddJama={t.openAddJama}
            onEditJama={t.openEditJama}
            onDeleteJama={t.deleteJama}
          />
        )}

        {/* Rehan Transactions Table */}
        {transactionType === "rehan" && rehan && (
          <RehanHistorySection
            rehan={rehan}
            rehanTransactions={t.rehanTransactions}
            onAddTransaction={t.openAddRehanTransaction}
            onDeleteTransaction={t.deleteRehanTransactionById}
          />
        )}

        <DetailModals
          showAddRehanTransactionModal={t.showAddRehanTransactionModal}
          closeAddRehanTransactionModal={t.closeAddRehanTransactionModal}
          addRehanTransaction={t.addRehanTransaction}
          showAddJamaModal={t.showAddJamaModal}
          closeJamaModal={t.closeJamaModal}
          isEditingJama={t.isEditingJama}
          editingJamaIndex={t.editingJamaIndex}
          jamaEntries={t.jamaEntries}
          submitJama={t.submitJama}
          showItemModal={t.showItemModal}
          editingItemIndex={t.editingItemIndex}
          lendenItems={t.lendenItems}
          closeItemModal={t.closeItemModal}
          saveLendenItem={t.saveLendenItem}
          showOldJewelleryModal={t.showOldJewelleryModal}
          editingOldJewelleryIndex={t.editingOldJewelleryIndex}
          oldJewelleryItems={t.oldJewelleryItems}
          closeOldJewelleryModal={t.closeOldJewelleryModal}
          saveOldJewelleryItem={t.saveOldJewelleryItem}
        />

        {/* Customer Info Section */}
        <CustomerInfoSection user={user} />

        {/* Date Section */}
        <DateInfoSection
          transactionType={transactionType}
          rehan={rehan}
          lenden={lenden}
          formatDate={t.formatDate}
        />

        {/* Bill Section */}
        <BillSection
          mediaPaths={t.mediaPaths}
          isEditMode={isEditMode}
          mediaTile={t.mediaTile}
          onStartEdit={t.startEdit}
          onCancelEdit={t.cancelEdit}
          takePhoto={t.takePhoto}
          pickImage={t.pickImage}
          removeImage={t.removeImage}
          setSelectedImageIndex={t.setSelectedImageIndex}
        />

        <ActionButtons
          transactionType={transactionType}
          rehan={rehan}
          isEditMode={isEditMode}
          lendenItemCount={t.lendenItems.length}
          handleCloseRehan={t.handleCloseRehan}
          openGenerateBill={t.openGenerateBill}
        />
      </ScrollView>
      <SaveFooter
        isEditMode={isEditMode}
        hasChanges={t.hasChanges}
        isSaving={t.isSaving}
        handleSaveChanges={t.handleSaveChanges}
      />
      </KeyboardArea>
      <ImageViewerModal
        selectedImageIndex={t.selectedImageIndex}
        setSelectedImageIndex={t.setSelectedImageIndex}
        mediaPaths={t.mediaPaths}
        onClose={t.closeImageViewer}
        insets={t.insets}
      />
    </Screen>
  );
};

export default TransactionDetailScreen;
