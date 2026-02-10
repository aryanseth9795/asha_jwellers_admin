import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { RootStackParamList } from "../types/entry";
import {
  getProductById,
  createProduct,
  updateProduct,
  getCategories,
  addVariant,
  updateVariant,
  deleteVariant,
  Category,
  Variant,
} from "../services/ProductService";

type AddEditProductNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "AddEditProduct"
>;

type AddEditProductRouteProp = RouteProp<RootStackParamList, "AddEditProduct">;

interface Props {
  navigation: AddEditProductNavigationProp;
  route: AddEditProductRouteProp;
}

interface LocalVariant {
  _id?: string;
  size: string;
  weight: string;
  images: any[]; // mixed strings (urls) and objects (files)
  isNew?: boolean;
}

const AddEditProductScreen: React.FC<Props> = ({ navigation, route }) => {
  const { productId } = route.params || {};
  const isEditMode = !!productId;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<any>(null); // string (url) or object (file)
  const [categoryId, setCategoryId] = useState("");
  const [variants, setVariants] = useState<LocalVariant[]>([]);

  // UI state
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errors, setErrors] = useState<{
    name?: string;
    category?: string;
    variant?: string;
  }>({});

  // Variant modal state
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<LocalVariant | null>(
    null,
  );
  const [variantSize, setVariantSize] = useState("");
  const [variantWeight, setVariantWeight] = useState("");
  const [variantImages, setVariantImages] = useState<any[]>([]);

  // Category selection modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? "Edit Product" : "Add Product",
    });
    fetchInitialData();
  }, [productId, isEditMode, navigation]);

  const fetchInitialData = async () => {
    try {
      const categoriesResponse = await getCategories();
      setCategories(categoriesResponse.data);

      if (isEditMode && productId) {
        const productResponse = await getProductById(productId);
        const product = productResponse.data;
        setName(product.name);
        setDescription(product.description || "");
        setThumbnail(product.thumbnail || null);
        setCategoryId(product.category?._id || "");
        setVariants(
          product.variants?.map((v) => ({
            _id: v._id,
            size: v.size || "",
            weight: v.weight || "",
            images: v.images || [],
          })) || [],
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load data");
      navigation.goBack();
    } finally {
      setIsFetching(false);
    }
  };

  const pickImage = async (target: "thumbnail" | "variant") => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        name: asset.fileName || "photo.jpg",
        type: asset.mimeType || "image/jpeg",
      };

      if (target === "thumbnail") {
        setThumbnail(file);
      } else if (target === "variant") {
        setVariantImages([...variantImages, file]);
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setVariantImages(variantImages.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: { name?: string; category?: string; variant?: string } =
      {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.trim().length > 200) {
      newErrors.name = "Name must be 200 characters or less";
    }

    if (!categoryId) {
      newErrors.category = "Category is required";
    }

    if (description.length > 2000) {
      Alert.alert("Error", "Description must be 2000 characters or less");
      return false;
    }

    // On create, require at least first variant weight
    if (!isEditMode && variants.length === 0) {
      newErrors.variant = "At least one variant is required";
    } else if (
      !isEditMode &&
      variants.length > 0 &&
      !variants[0].weight.trim()
    ) {
      newErrors.variant = "First variant weight is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddVariant = () => {
    setEditingVariant(null);
    setVariantSize("");
    setVariantWeight("");
    setVariantImages([]);
    setShowVariantModal(true);
  };

  const handleEditVariant = (variant: LocalVariant, index: number) => {
    setEditingVariant({ ...variant, _id: variant._id || `local-${index}` });
    setVariantSize(variant.size);
    setVariantWeight(variant.weight);
    setVariantImages(variant.images || []);
    setShowVariantModal(true);
  };

  const handleSaveVariant = () => {
    const newVariant: LocalVariant = {
      _id: editingVariant?._id,
      size: variantSize.trim(),
      weight: variantWeight.trim(),
      images: variantImages,
      isNew: !editingVariant?._id || editingVariant._id.startsWith("local-"),
    };

    if (editingVariant && !editingVariant._id?.startsWith("local-")) {
      setVariants(
        variants.map((v) => (v._id === editingVariant._id ? newVariant : v)),
      );
    } else if (editingVariant?._id?.startsWith("local-")) {
      const index = parseInt(editingVariant._id.split("-")[1], 10);
      const newVariants = [...variants];
      newVariants[index] = { ...newVariant, isNew: true };
      setVariants(newVariants);
    } else {
      setVariants([...variants, { ...newVariant, isNew: true }]);
    }

    setShowVariantModal(false);
  };

  const handleDeleteVariant = async (variant: LocalVariant, index: number) => {
    Alert.alert(
      "Delete Variant",
      "Are you sure you want to delete this variant?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (
              isEditMode &&
              variant._id &&
              !variant.isNew &&
              !variant._id.startsWith("local-")
            ) {
              try {
                await deleteVariant(productId!, variant._id);
              } catch (error: any) {
                Alert.alert("Error", error.message);
                return;
              }
            }
            setVariants(variants.filter((_, i) => i !== index));
          },
        },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      let savedProductId = productId;

      if (isEditMode && productId) {
        // Update product-level details only (no variants)
        const payload: any = {
          name: name.trim(),
          description: description.trim() || undefined,
          category: categoryId,
        };
        if (thumbnail && typeof thumbnail === "object" && thumbnail.uri) {
          payload.thumbnail = thumbnail;
        }
        await updateProduct(productId, payload);
      } else {
        // Create product with the first variant inline
        const firstVariant = variants[0];
        const payload: any = {
          name: name.trim(),
          description: description.trim() || undefined,
          category: categoryId,
          variantWeight: firstVariant.weight.trim(),
          variantSize: firstVariant.size?.trim() || undefined,
        };
        if (thumbnail) payload.thumbnail = thumbnail;

        // Attach first variant's new image files
        const firstVariantNewImages = firstVariant.images?.filter(
          (img: any) => typeof img === "object" && img.uri,
        );
        if (firstVariantNewImages && firstVariantNewImages.length > 0) {
          payload.variantImages = firstVariantNewImages;
        }

        const response = await createProduct(payload);
        savedProductId = response.data._id;
      }

      // Handle additional variants sequentially
      if (savedProductId) {
        // In create mode, skip the first variant (already sent inline)
        const variantsToAdd = isEditMode
          ? variants.filter((v) => v.isNew || v._id?.startsWith("local-"))
          : variants
              .slice(1)
              .filter((v) => v.isNew || v._id?.startsWith("local-"));

        for (const variant of variantsToAdd) {
          const newImages = variant.images?.filter(
            (img: any) => typeof img === "object" && img.uri,
          );
          await addVariant(savedProductId, {
            weight: variant.weight || "",
            size: variant.size || undefined,
            images: newImages && newImages.length > 0 ? newImages : undefined,
          });
        }

        // Update existing variants (edit mode only)
        if (isEditMode) {
          const existingVariants = variants.filter(
            (v) => v._id && !v._id.startsWith("local-") && !v.isNew,
          );
          for (const variant of existingVariants) {
            // Separate existing URLs from new file objects
            const existingImageUrls = variant.images?.filter(
              (img: any) => typeof img === "string",
            ) as string[] | undefined;
            const newImageFiles = variant.images?.filter(
              (img: any) => typeof img === "object" && img.uri,
            );

            await updateVariant(savedProductId, variant._id!, {
              weight: variant.weight || "",
              size: variant.size || undefined,
              existingImages:
                existingImageUrls && existingImageUrls.length > 0
                  ? existingImageUrls
                  : undefined,
              images:
                newImageFiles && newImageFiles.length > 0
                  ? newImageFiles
                  : undefined,
            });
          }
        }
      }

      Alert.alert(
        "Success",
        `Product ${isEditMode ? "updated" : "created"} successfully`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      console.error("Save error:", error);
      Alert.alert("Error", error.message || "Failed to save product");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c._id === categoryId);

  // Helper to render image (url or file object)
  const renderImageSource = (img: any): any => {
    if (typeof img === "string") return { uri: img };
    if (typeof img === "object" && img.uri) return { uri: img.uri };
    return { uri: "" };
  };

  if (isFetching) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={name}
                onChangeText={setName}
                placeholder="Enter product name"
                placeholderTextColor="#999"
                maxLength={200}
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter product description (optional)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={2000}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Category <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.categorySelector,
                  errors.category && styles.inputError,
                ]}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text
                  style={
                    selectedCategory
                      ? styles.categoryText
                      : styles.categoryPlaceholder
                  }
                >
                  {selectedCategory?.name || "Select a category"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              {errors.category && (
                <Text style={styles.errorText}>{errors.category}</Text>
              )}
            </View>
          </View>

          {/* Thumbnail Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thumbnail</Text>

            <View style={styles.inputGroup}>
              <TouchableOpacity
                onPress={() => pickImage("thumbnail")}
                style={styles.imagePickerButton}
              >
                {thumbnail ? (
                  <View style={styles.thumbnailPreview}>
                    <Image
                      source={renderImageSource(thumbnail)}
                      style={styles.fullImage}
                    />
                    <View style={styles.editOverlay}>
                      <Ionicons name="pencil" color="#fff" size={20} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <Ionicons name="image" size={32} color="#ccc" />
                    <Text style={styles.placeholderText}>Pick Thumbnail</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Variants Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Variants</Text>
              <TouchableOpacity
                style={styles.addVariantButton}
                onPress={handleAddVariant}
              >
                <Ionicons name="add-circle" size={24} color="#007AFF" />
                <Text style={styles.addVariantText}>Add Variant</Text>
              </TouchableOpacity>
            </View>

            {variants.length === 0 ? (
              <View>
                <Text style={styles.noVariantsText}>
                  No variants added yet. At least one variant is required.
                </Text>
                {errors.variant && (
                  <Text style={styles.errorText}>{errors.variant}</Text>
                )}
              </View>
            ) : (
              variants.map((variant, index) => (
                <View key={variant._id || index} style={styles.variantCard}>
                  <View style={styles.variantInfo}>
                    {variant.size && (
                      <Text style={styles.variantDetail}>
                        Size: {variant.size}
                      </Text>
                    )}
                    {variant.weight && (
                      <Text style={styles.variantDetail}>
                        Weight: {variant.weight}
                      </Text>
                    )}
                    {!variant.size && !variant.weight && (
                      <Text style={styles.variantDetail}>
                        Variant {index + 1}
                      </Text>
                    )}
                    {variant.isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.variantActions}>
                    <TouchableOpacity
                      onPress={() => handleEditVariant(variant, index)}
                      style={styles.variantActionButton}
                    >
                      <Ionicons name="pencil" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteVariant(variant, index)}
                      style={styles.variantActionButton}
                    >
                      <Ionicons name="trash" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
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
        </View>
      </KeyboardAvoidingView>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat._id}
                  style={[
                    styles.modalItem,
                    categoryId === cat._id && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setCategoryId(cat._id);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      categoryId === cat._id && styles.modalItemTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                  {categoryId === cat._id && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Variant Modal */}
      <Modal
        visible={showVariantModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVariantModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingVariant ? "Edit Variant" : "Add Variant"}
              </Text>
              <TouchableOpacity onPress={() => setShowVariantModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Size</Text>
                <TextInput
                  style={styles.input}
                  value={variantSize}
                  onChangeText={setVariantSize}
                  placeholder="e.g., 7, 8, 9"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Weight</Text>
                <TextInput
                  style={styles.input}
                  value={variantWeight}
                  onChangeText={setVariantWeight}
                  placeholder="e.g., 5g, 10g"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Variant Images</Text>
                <View style={styles.addImageRow}>
                  <TouchableOpacity
                    style={styles.addImageButton}
                    onPress={() => pickImage("variant")}
                  >
                    <Ionicons name="add" size={24} color="#fff" />
                    <Text style={styles.addImageText}>Add Image</Text>
                  </TouchableOpacity>
                </View>

                {variantImages.length > 0 && (
                  <View style={styles.imageList}>
                    {variantImages.map((img, index) => (
                      <View key={index} style={styles.imageItem}>
                        <Image
                          source={renderImageSource(img)}
                          style={styles.imageThumbnail}
                        />
                        <Text style={styles.imageUrl} numberOfLines={1}>
                          {typeof img === "string" ? "Remote Image" : img.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveImage(index)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveVariant}
              >
                <Text style={styles.modalSaveText}>
                  {editingVariant ? "Update Variant" : "Add Variant"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#FF3B30",
  },
  input: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputError: {
    borderColor: "#FF3B30",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  categorySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryText: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  categoryPlaceholder: {
    fontSize: 16,
    color: "#999",
  },
  addImageRow: {
    flexDirection: "row",
    gap: 8,
  },
  addImageButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  addImageText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  imagePickerButton: {
    height: 150,
    backgroundColor: "#E6F2FF",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  placeholderContainer: {
    alignItems: "center",
    gap: 8,
  },
  placeholderText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  thumbnailPreview: {
    width: "100%",
    height: "100%",
  },
  fullImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  editOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
    borderRadius: 20,
  },
  imageList: {
    marginTop: 12,
    gap: 8,
  },
  imageItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 8,
    gap: 8,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  imageThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
  },
  imageUrl: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  addVariantButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addVariantText: {
    color: "#007AFF",
    fontWeight: "600",
    fontSize: 14,
  },
  noVariantsText: {
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
  variantCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  variantInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  variantDetail: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  newBadge: {
    backgroundColor: "#E6F2FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    color: "#007AFF",
    fontWeight: "700",
  },
  variantActions: {
    flexDirection: "row",
    gap: 12,
  },
  variantActionButton: {
    padding: 4,
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  modalList: {
    padding: 8,
  },
  modalBody: {
    padding: 24,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalItemSelected: {
    backgroundColor: "#E6F2FF",
  },
  modalItemText: {
    fontSize: 16,
    color: "#333",
  },
  modalItemTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  modalSaveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  modalSaveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default AddEditProductScreen;
