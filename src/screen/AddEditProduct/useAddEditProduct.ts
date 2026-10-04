import { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { confirm, notify } from "../../ui";
import {
  getProductById,
  createProduct,
  updateProduct,
  getCategories,
  addVariant,
  updateVariant,
  deleteVariant,
  Category,
} from "../../services/ProductService";
import { Props, LocalVariant } from "./types";

export const useAddEditProduct = ({ navigation, route }: Props) => {
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
      notify.error("Could not load data", error.message || "Failed to load data");
      navigation.goBack();
    } finally {
      setIsFetching(false);
    }
  };

  const pickImage = async (target: "thumbnail" | "variant") => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      notify.error("Permission required", "Permission to access camera roll is required!");
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
      notify.error("Description too long", "Description must be 2000 characters or less");
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
    if (
      await confirm({
        title: "Delete variant",
        message: "Are you sure you want to delete this variant?",
        confirmLabel: "Delete",
        tone: "danger",
      })
    ) {
      if (
        isEditMode &&
        variant._id &&
        !variant.isNew &&
        !variant._id.startsWith("local-")
      ) {
        try {
          await deleteVariant(productId!, variant._id);
        } catch (error: any) {
          notify.error("Could not delete variant", error.message);
          return;
        }
      }
      setVariants(variants.filter((_, i) => i !== index));
    }
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

      notify.success(`Product ${isEditMode ? "updated" : "created"}`);
      navigation.goBack();
    } catch (error: any) {
      console.error("Save error:", error);
      notify.error("Could not save product", error.message || "Failed to save product");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCategory = categories.find((c) => c._id === categoryId);

  return {
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
  };
};
