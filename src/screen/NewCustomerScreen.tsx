import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList, EntryType } from "../types/entry";
import {
  checkDuplicateUser,
  createUser,
  createRehan,
  createLenden,
} from "../database/entryDatabase";
import { saveImages } from "../storage/fileStorage";
import CustomDatePicker from "../components/CustomDatePicker";

type NewCustomerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "NewCustomer"
>;

interface Props {
  navigation: NewCustomerScreenNavigationProp;
}

const NewCustomerScreen: React.FC<Props> = ({ navigation }) => {
  // User info
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Entry type selection
  const [entryType, setEntryType] = useState<EntryType | null>(null);

  // Media
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Date selection
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Minimum date - 5 years ago
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 5);

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
      Alert.alert(
        "Permission Required",
        "Camera and media library permissions are required to take photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImages([...selectedImages, result.assets[0].uri]);
    }
  };

  const pickImages = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Permission Required",
        "Media library permission is required."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: false,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map((asset) => asset.uri);
      setSelectedImages([...selectedImages, ...newImages]);
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
    // Validation
    if (!name.trim()) {
      Alert.alert("Validation Error", "Please enter a name.");
      return;
    }

    if (!entryType) {
      Alert.alert(
        "Validation Error",
        "Please select an entry type (Rehan or Len-Den)."
      );
      return;
    }

    if (selectedImages.length === 0) {
      Alert.alert("Validation Error", "Please add at least one image.");
      return;
    }

    setIsLoading(true);

    try {
      // Check for duplicate user
      const isDuplicate = await checkDuplicateUser(
        name.trim(),
        address.trim() || undefined,
        mobileNumber.trim() || undefined
      );

      if (isDuplicate) {
        Alert.alert(
          "Duplicate Entry",
          "A customer with the same name, address, and phone number already exists."
        );
        setIsLoading(false);
        return;
      }

      // Save images to file system
      const savedImagePaths = await saveImages(selectedImages);

      // Create user
      const userId = await createUser({
        name: name.trim(),
        address: address.trim() || undefined,
        mobileNumber: mobileNumber.trim() || undefined,
      });

      // Create entry based on type
      if (entryType === "rehan") {
        await createRehan({
          userId,
          media: savedImagePaths,
          openDate: selectedDate.toISOString(),
        });
      } else {
        await createLenden({
          userId,
          date: selectedDate.toISOString(),
          media: savedImagePaths,
        });
      }

      Alert.alert("Success", "Customer entry saved successfully!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error("Error saving entry:", error);
      Alert.alert("Error", "Failed to save the entry. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.title}>New Customer</Text>
        <Text style={styles.subtitle}>Create a new customer entry</Text>

        {/* Customer Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter customer name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter address (optional)"
              placeholderTextColor="#999"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter mobile number (optional)"
              placeholderTextColor="#999"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Entry Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Entry Type <Text style={styles.required}>*</Text>
          </Text>

          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                entryType === "rehan" && styles.typeButtonActive,
              ]}
              onPress={() => setEntryType("rehan")}
            >
              <Ionicons
                name="document-text"
                size={24}
                color={entryType === "rehan" ? "#fff" : "#007AFF"}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  entryType === "rehan" && styles.typeButtonTextActive,
                ]}
              >
                Rehan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                entryType === "lenden" && styles.typeButtonActive,
              ]}
              onPress={() => setEntryType("lenden")}
            >
              <Ionicons
                name="swap-horizontal"
                size={24}
                color={entryType === "lenden" ? "#fff" : "#007AFF"}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  entryType === "lenden" && styles.typeButtonTextActive,
                ]}
              >
                Len-Den
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Selection - Only show if entry type is selected */}
        {entryType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Date <Text style={styles.required}>*</Text>
            </Text>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color="#007AFF" />
              <Text style={styles.dateButtonText}>
                {formatDisplayDate(selectedDate)}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* Bill Section - Only show if entry type is selected */}
        {entryType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Bill <Text style={styles.required}>*</Text>{" "}
              <Text style={styles.mediaCount}>({selectedImages.length})</Text>
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
                <Ionicons name="camera" size={20} color="#007AFF" />
                <Text style={styles.mediaButtonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.mediaButton} onPress={pickImages}>
                <Ionicons name="images" size={20} color="#007AFF" />
                <Text style={styles.mediaButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {selectedImages.length > 0 && (
              <View style={styles.imageGrid}>
                {selectedImages.map((uri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.saveButtonText}>Save Entry</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Date Picker */}
      <CustomDatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onClose={() => setShowDatePicker(false)}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
        minimumDate={minDate}
        maximumDate={new Date()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 24,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17,
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
    marginBottom: 8,
    color: "#444",
  },
  required: {
    color: "#FF3B30",
  },
  input: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    color: "#1A1A1A",
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  typeSelector: {
    flexDirection: "row",
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#007AFF",
    backgroundColor: "#fff",
  },
  typeButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#007AFF",
  },
  typeButtonTextActive: {
    color: "#fff",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0F7FF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0E4FF",
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  mediaCount: {
    fontWeight: "400",
    color: "#666",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  mediaButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F7FF",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0E4FF",
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageWrapper: {
    position: "relative",
    width: 90,
    height: 90,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#FF3B30",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: "#A0C4FF",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});

export default NewCustomerScreen;
