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
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { RootStackParamList } from "../types/entry";
import {
  getCategoryById,
  createCategory,
  updateCategory,
  Category,
} from "../services/ProductService";

type AddEditCategoryNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "AddEditCategory"
>;

type AddEditCategoryRouteProp = RouteProp<
  RootStackParamList,
  "AddEditCategory"
>;

interface Props {
  navigation: AddEditCategoryNavigationProp;
  route: AddEditCategoryRouteProp;
}

const AddEditCategoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { categoryId } = route.params || {};
  const isEditMode = !!categoryId;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? "Edit Category" : "Add Category",
    });

    if (isEditMode && categoryId) {
      fetchCategory();
    }
  }, [categoryId, isEditMode, navigation]);

  const fetchCategory = async () => {
    try {
      const response = await getCategoryById(categoryId!);
      const category = response.data;
      setName(category.name);
      setDescription(category.description || "");
      setCurrentImageUrl(category.image || "");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to load category");
      navigation.goBack();
    } finally {
      setIsFetching(false);
    }
  };

  const pickImage = async () => {
    // Request permission
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for entries/categories often looks better
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      // Create a file object compatible with our service
      const file = {
        uri: asset.uri,
        name: asset.fileName || "photo.jpg",
        type: asset.mimeType || "image/jpeg",
      };
      setSelectedImage(file);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.trim().length > 100) {
      newErrors.name = "Name must be 100 characters or less";
    }

    if (description.length > 500) {
      Alert.alert("Error", "Description must be 500 characters or less");
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
      };

      if (selectedImage) {
        payload.image = selectedImage;
      }

      if (isEditMode && categoryId) {
        await updateCategory(categoryId, payload);
        Alert.alert("Success", "Category updated successfully", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        await createCategory(payload);
        Alert.alert("Success", "Category created successfully", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save category");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading category...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Display image logic: Selected URI > Current URL > Placeholder
  const displayImageUri = selectedImage ? selectedImage.uri : currentImageUrl;

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
          {/* Image Picker */}
          <TouchableOpacity
            style={styles.imagePickerTouchable}
            onPress={pickImage}
            activeOpacity={0.9}
          >
            {displayImageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: displayImageUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
                <View style={styles.editBadge}>
                  <Ionicons name="pencil" size={16} color="#fff" />
                </View>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={48}
                  color="#007AFF"
                />
                <Text style={styles.imagePlaceholderText}>
                  Tap to upload Category Image
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={name}
                onChangeText={setName}
                placeholder="Enter category name"
                placeholderTextColor="#999"
                maxLength={100}
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
              <Text style={styles.charCount}>{name.length}/100</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter category description (optional)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>
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
                  {isEditMode ? "Update Category" : "Create Category"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  imagePickerTouchable: {
    marginBottom: 24,
  },
  imagePreviewContainer: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    backgroundColor: "#f0f0f0",
  },
  editBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 20,
  },
  imagePlaceholder: {
    height: 160,
    backgroundColor: "#E6F2FF",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
  formSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
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
    padding: 16,
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
  charCount: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 4,
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
});

export default AddEditCategoryScreen;
