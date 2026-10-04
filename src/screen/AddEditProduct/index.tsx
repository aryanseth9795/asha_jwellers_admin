import React from "react";
import { View, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, Screen, KeyboardArea, FooterBar } from "../../ui";
import { Props } from "./types";
import { useAddEditProduct } from "./useAddEditProduct";
import BasicInfoSection from "./BasicInfoSection";
import ThumbnailSection from "./ThumbnailSection";
import VariantsSection from "./VariantsSection";
import CategorySheet from "./CategorySheet";
import VariantSheet from "./VariantSheet";
import { styles } from "./styles";

const AddEditProductScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    isEditMode,
    name,
    setName,
    description,
    setDescription,
    thumbnail,
    variants,
    categories,
    categoryId,
    setCategoryId,
    selectedCategory,
    isLoading,
    isFetching,
    errors,
    showVariantModal,
    setShowVariantModal,
    editingVariant,
    variantSize,
    setVariantSize,
    variantWeight,
    setVariantWeight,
    variantImages,
    showCategoryModal,
    setShowCategoryModal,
    pickImage,
    handleRemoveImage,
    handleAddVariant,
    handleEditVariant,
    handleSaveVariant,
    handleDeleteVariant,
    handleSubmit,
  } = useAddEditProduct({ navigation, route });

  if (isFetching) {
    return (
      <Screen style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <KeyboardArea>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info Section */}
          <BasicInfoSection
            name={name}
            onChangeName={setName}
            description={description}
            onChangeDescription={setDescription}
            errors={errors}
            selectedCategory={selectedCategory}
            onOpenCategory={() => setShowCategoryModal(true)}
          />

          {/* Thumbnail Section */}
          <ThumbnailSection
            thumbnail={thumbnail}
            onPick={() => pickImage("thumbnail")}
          />

          {/* Variants Section */}
          <VariantsSection
            variants={variants}
            errors={errors}
            handleAddVariant={handleAddVariant}
            handleEditVariant={handleEditVariant}
            handleDeleteVariant={handleDeleteVariant}
          />
        </ScrollView>

        {/* Submit Button */}
        <FooterBar>
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={isEditMode ? "checkmark-circle" : "add-circle"}
                  size={24}
                  color="#fff"
                />
                <Text style={styles.submitButtonText}>
                  {isEditMode ? "Update Product" : "Create Product"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </FooterBar>
      </KeyboardArea>

      {/* Category Selection Modal */}
      <CategorySheet
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        categoryId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setShowCategoryModal(false);
        }}
      />

      {/* Variant Modal */}
      <VariantSheet
        visible={showVariantModal}
        onClose={() => setShowVariantModal(false)}
        editingVariant={editingVariant}
        variantSize={variantSize}
        setVariantSize={setVariantSize}
        variantWeight={variantWeight}
        setVariantWeight={setVariantWeight}
        variantImages={variantImages}
        handleSaveVariant={handleSaveVariant}
        onPickImage={() => pickImage("variant")}
        handleRemoveImage={handleRemoveImage}
      />
    </Screen>
  );
};

export default AddEditProductScreen;
