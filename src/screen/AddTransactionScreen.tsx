import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, EntryType } from "../types/entry";
import {
  createRehan,
  createLenden,
  createJamaEntry,
} from "../database/entryDatabase";
import { saveImages } from "../storage/fileStorage";
import CustomDatePicker from "../components/CustomDatePicker";
import BillTable from "../components/BillTable";
import AddJamaModal from "../components/AddJamaModal";

type AddTransactionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "AddTransaction"
>;

type AddTransactionScreenRouteProp = RouteProp<
  RootStackParamList,
  "AddTransaction"
>;

interface Props {
  navigation: AddTransactionScreenNavigationProp;
  route: AddTransactionScreenRouteProp;
}

const AddTransactionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId, userName, userAddress, userMobileNumber } = route.params;

  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");

  // Lenden-specific fields
  const [discount, setDiscount] = useState("");
  // Removed individual remaining/jama/baki states in favor of calculation

  // Multiple Jama Entries
  interface LocalJamaEntry {
    amount: number;
    date: string;
  }
  const [jamaEntries, setJamaEntries] = useState<LocalJamaEntry[]>([]);
  const [showAddJamaModal, setShowAddJamaModal] = useState(false);

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
      Alert.alert(
        "Permission Required",
        "Camera and media library permissions are required."
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
      Alert.alert(
        "Validation Error",
        "Please select an entry type (Rehan or Len-Den)."
      );
      return;
    }

    if (!amount) {
      Alert.alert("Validation Error", "Please enter an amount.");
      return;
    }

    setIsLoading(true);

    try {
      const savedImagePaths = await saveImages(selectedImages);

      if (entryType === "rehan") {
        await createRehan({
          userId,
          media: savedImagePaths,
          openDate: selectedDate.toISOString(),
          productName: productName.trim() || undefined,
          amount: amount ? parseInt(amount, 10) : undefined,
        });
      } else {
        // Calculate fields
        const lendenAmountVal = amount ? parseInt(amount, 10) : 0;
        const discountVal = discount ? parseInt(discount, 10) : 0;
        const remainingVal = Math.max(0, lendenAmountVal - discountVal);
        const totalJama = jamaEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        );
        const bakiVal = Math.max(0, remainingVal - totalJama);

        const lendenId = await createLenden({
          userId,
          date: selectedDate.toISOString(),
          media: savedImagePaths,
          amount: lendenAmountVal,
          discount: discountVal,
          remaining: remainingVal,
          jama: totalJama, // Store total jama for backward compatibility
          baki: bakiVal,
          status: bakiVal === 0 ? 1 : 0, // Auto-close if baki is 0
        });

        // Create individual jama entries
        for (const entry of jamaEntries) {
          await createJamaEntry({
            lendenId,
            amount: entry.amount,
            date: entry.date,
          });
        }
      }

      Alert.alert("Success", "Transaction added successfully!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error("Error saving transaction:", error);
      Alert.alert("Error", "Failed to save transaction. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={styles.title}>New Transaction</Text>
      <Text style={styles.subtitle}>Add a new entry for {userName}</Text>

      {/* User Info Summary (Read-only) */}
      <View style={styles.userInfoCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {userName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userNameText}>{userName}</Text>
          {userAddress && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.infoText} numberOfLines={1}>
                {userAddress}
              </Text>
            </View>
          )}
          {userMobileNumber && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={14} color="#666" />
              <Text style={styles.infoText}>{userMobileNumber}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Entry Type Selection */}
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

      {/* Input Fields */}
      {entryType && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>

          {entryType === "rehan" && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Product Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter product name"
                value={productName}
                onChangeText={setProductName}
                placeholderTextColor="#999"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Amount <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.amountInputWrapper}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                value={amount}
                onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Lenden-specific fields */}
          {entryType === "lenden" && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  <Ionicons name="pricetag-outline" size={14} color="#666" />{" "}
                  Discount
                </Text>
                <View style={styles.amountInputWrapper}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    value={discount}
                    onChangeText={(text) =>
                      setDiscount(text.replace(/[^0-9]/g, ""))
                    }
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* Bill Table */}
              {(parseInt(amount, 10) > 0 || jamaEntries.length > 0) && (
                <View style={{ marginTop: 16 }}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { fontSize: 16, marginBottom: 12 },
                    ]}
                  >
                    Payment Summary
                  </Text>
                  <BillTable
                    amount={parseInt(amount, 10) || 0}
                    discount={parseInt(discount, 10) || 0}
                    jamaEntries={jamaEntries}
                    editable={true}
                    onAddJama={() => setShowAddJamaModal(true)}
                    onDeleteJama={(index) => {
                      setJamaEntries((prev) =>
                        prev.filter((_, i) => i !== index)
                      );
                    }}
                    onEditJama={(index) => {
                      // Simple delete and re-add flow for now or implement full edit if needed
                      // For quick fix, we can just delete.
                      // Ideally we should open modal with values, but simpler is okay for now.
                      // Let's just allow delete and add new for simplicity in this screen
                      // or passing edit callback if we want full fidelity.
                      // Since we don't have edit state here yet, let's skip onEditJama for this screen
                      // or implement a basic one that removes and opens modal.
                    }}
                  />
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Date Selection */}
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

      {/* Bill Section */}
      {entryType && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Bill (Optional){" "}
            <Text style={styles.mediaCount}>({selectedImages.length})</Text>
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
              <Ionicons name="camera" size={20} color="#007AFF" />
              <Text style={styles.mediaButtonText}>Camera</Text>
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
            <Text style={styles.saveButtonText}>Save Transaction</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Add Jama Modal */}
      <AddJamaModal
        visible={showAddJamaModal}
        onClose={() => setShowAddJamaModal(false)}
        onAdd={(amount, date) => {
          setJamaEntries((prev) => [
            ...prev,
            { amount, date: date.toISOString() },
          ]);
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
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
    marginBottom: 20,
  },
  userInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  userDetails: {
    flex: 1,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  infoText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
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
  required: {
    color: "#FF3B30",
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
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#D0E4FF",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1A1A1A",
  },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#D0E4FF",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
});

export default AddTransactionScreen;
