import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ReactNativeZoomableView } from "@dudigital/react-native-zoomable-view";
import { RootStackParamList } from "../types/entry";
import {
  getRehanById,
  getLendenById,
  getUserById,
  updateRehanDetails,
  updateLendenDetails,
  closeRehan,
} from "../database/entryDatabase";
import { User, Rehan, Lenden } from "../types/entry";
import { saveImages } from "../storage/fileStorage";

type TransactionDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "TransactionDetail"
>;

type TransactionDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  "TransactionDetail"
>;

interface Props {
  navigation: TransactionDetailScreenNavigationProp;
  route: TransactionDetailScreenRouteProp;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TransactionDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { transactionId, transactionType } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rehan, setRehan] = useState<Rehan | null>(null);
  const [lenden, setLenden] = useState<Lenden | null>(null);
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [originalMediaPaths, setOriginalMediaPaths] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Editable fields state
  const [editProductName, setEditProductName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [originalProductName, setOriginalProductName] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");

  useEffect(() => {
    loadData();
  }, [transactionId, transactionType]);

  useEffect(() => {
    // Check if media has changed
    const changed =
      JSON.stringify(mediaPaths) !== JSON.stringify(originalMediaPaths);
    setHasChanges(changed);
    // Check if media or details have changed
    const mediaChanged =
      JSON.stringify(mediaPaths) !== JSON.stringify(originalMediaPaths);
    const productNameChanged = editProductName !== originalProductName;
    const amountChanged = editAmount !== originalAmount;

    setHasChanges(mediaChanged || productNameChanged || amountChanged);
  }, [
    mediaPaths,
    originalMediaPaths,
    editProductName,
    originalProductName,
    editAmount,
    originalAmount,
  ]);

  const loadData = async () => {
    try {
      if (transactionType === "rehan") {
        const rehanData = await getRehanById(transactionId);
        if (rehanData) {
          setRehan(rehanData);
          const paths = JSON.parse(rehanData.media);
          setMediaPaths(paths);
          setOriginalMediaPaths(paths);
          const userData = await getUserById(rehanData.userId);
          setUser(userData);
        }
      } else {
        const lendenData = await getLendenById(transactionId);
        if (lendenData) {
          setLenden(lendenData);
          const paths = JSON.parse(lendenData.media);
          setMediaPaths(paths);
          setOriginalMediaPaths(paths);
          const userData = await getUserById(lendenData.userId);
          setUser(userData);
        }
      }
    } catch (error) {
      console.error("Error loading transaction data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

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
      setMediaPaths([...mediaPaths, result.assets[0].uri]);
    }
  };

  const pickImage = async () => {
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
      setMediaPaths([...mediaPaths, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    Alert.alert("Remove Image", "Are you sure you want to remove this image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const updated = mediaPaths.filter((_, i) => i !== index);
          setMediaPaths(updated);
        },
      },
    ]);
  };

  const handleSaveChanges = async () => {
    if (mediaPaths.length === 0) {
      Alert.alert(
        "Error",
        "You must have at least one image. Cannot save with no images."
      );
      return;
    }

    setIsSaving(true);
    try {
      // Find new images (ones that are temp URIs, not saved paths)
      const newImages = mediaPaths.filter(
        (path) => !originalMediaPaths.includes(path)
      );

      // Save new images to storage
      let finalPaths = [...mediaPaths];
      if (newImages.length > 0) {
        const savedNewPaths = await saveImages(newImages);
        // Replace temp URIs with saved paths
        finalPaths = mediaPaths.map((path) => {
          const newIndex = newImages.indexOf(path);
          if (newIndex !== -1) {
            return savedNewPaths[newIndex];
          }
          return path;
        });
      }

      // Update database
      // Update database
      if (transactionType === "rehan") {
        await updateRehanDetails(
          transactionId,
          finalPaths,
          editProductName.trim() || undefined,
          editAmount ? parseInt(editAmount, 10) : undefined
        );
      } else {
        await updateLendenDetails(
          transactionId,
          finalPaths,
          editAmount ? parseInt(editAmount, 10) : undefined
        );
      }

      setMediaPaths(finalPaths);
      setOriginalMediaPaths(finalPaths);
      setOriginalProductName(editProductName);
      setOriginalAmount(editAmount);

      // Refresh local data to show updated values in UI immediately
      if (transactionType === "rehan" && rehan) {
        setRehan({
          ...rehan,
          media: JSON.stringify(finalPaths),
          productName: editProductName.trim() || undefined,
          amount: editAmount ? parseInt(editAmount, 10) : undefined,
        });
      } else if (lenden) {
        setLenden({
          ...lenden,
          media: JSON.stringify(finalPaths),
          amount: editAmount ? parseInt(editAmount, 10) : undefined,
        });
      }

      setIsEditMode(false);
      Alert.alert("Success", "Changes saved successfully!");
    } catch (error) {
      console.error("Error saving changes:", error);
      Alert.alert("Error", "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseRehan = () => {
    Alert.alert(
      "Close Rehan Entry",
      "Are you sure you want to mark this entry as closed? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Entry",
          style: "destructive",
          onPress: async () => {
            try {
              await closeRehan(transactionId);
              // Reload data to reflect changes
              setIsLoading(true);
              await loadData();
              Alert.alert("Success", "Rehan entry has been closed.");
            } catch (error) {
              console.error("Error closing Rehan:", error);
              Alert.alert("Error", "Failed to close entry. Please try again.");
            }
          },
        },
      ]
    );
  };

  const cancelEdit = () => {
    setMediaPaths(originalMediaPaths);
    setEditProductName(originalProductName);
    setEditAmount(originalAmount);
    setIsEditMode(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>Transaction not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Type Badge */}
        <View style={styles.typeContainer}>
          <View
            style={[
              styles.typeBadge,
              transactionType === "rehan"
                ? styles.rehanBadge
                : styles.lendenBadge,
            ]}
          >
            <Ionicons
              name={
                transactionType === "rehan"
                  ? "document-text"
                  : "swap-horizontal"
              }
              size={16}
              color={transactionType === "rehan" ? "#2E7D32" : "#E65100"}
            />
            <Text
              style={[
                styles.typeBadgeText,
                transactionType === "rehan"
                  ? styles.rehanBadgeText
                  : styles.lendenBadgeText,
              ]}
            >
              {transactionType === "rehan" ? "Rehan" : "Len-Den"}
            </Text>
          </View>

          {transactionType === "rehan" && rehan && (
            <View
              style={[
                styles.statusBadge,
                rehan.status === 0 ? styles.statusOpen : styles.statusClosed,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  rehan.status === 0
                    ? styles.statusDotOpen
                    : styles.statusDotClosed,
                ]}
              />
              <Text style={styles.statusText}>
                {rehan.status === 0 ? "Open" : "Closed"}
              </Text>
            </View>
          )}
        </View>

        {/* Transaction Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Details</Text>
          <View style={styles.infoCard}>
            {/* Product Name Input or Display */}
            {isEditMode && transactionType === "rehan" ? (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter product name"
                  value={editProductName}
                  onChangeText={setEditProductName}
                />
              </View>
            ) : transactionType === "rehan" && rehan?.productName ? (
              <View style={styles.infoRow}>
                <View
                  style={[styles.iconContainer, { backgroundColor: "#FFF3E0" }]}
                >
                  <Ionicons name="cube" size={20} color="#E65100" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Product Name</Text>
                  <Text style={styles.infoValue}>{rehan.productName}</Text>
                </View>
              </View>
            ) : null}

            {/* Amount Input or Display */}
            {isEditMode ? (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={editAmount}
                  onChangeText={(text) =>
                    setEditAmount(text.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="numeric"
                />
              </View>
            ) : (
                transactionType === "rehan" ? rehan?.amount : lenden?.amount
              ) ? (
              <View style={styles.infoRow}>
                <View
                  style={[styles.iconContainer, { backgroundColor: "#E8F5E9" }]}
                >
                  <Ionicons name="cash" size={20} color="#2E7D32" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Amount</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: "#2E7D32", fontWeight: "700" },
                    ]}
                  >
                    ₹
                    {(transactionType === "rehan"
                      ? rehan?.amount
                      : lenden?.amount
                    )?.toLocaleString()}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Fallback if no details and not in edit mode */}
            {!isEditMode &&
              !(transactionType === "rehan" && rehan?.productName) &&
              !(transactionType === "rehan"
                ? rehan?.amount
                : lenden?.amount) && (
                <Text style={styles.noDetailsText}>
                  No additional details provided
                </Text>
              )}
          </View>
        </View>

        {/* Customer Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="person" size={20} color="#007AFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{user.name}</Text>
              </View>
            </View>

            {user.address && (
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="location" size={20} color="#007AFF" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{user.address}</Text>
                </View>
              </View>
            )}

            {user.mobileNumber && (
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="call" size={20} color="#007AFF" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Mobile Number</Text>
                  <Text style={styles.infoValue}>{user.mobileNumber}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Date Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="calendar" size={20} color="#007AFF" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {transactionType === "rehan" ? "Open Date" : "Entry Date"}
                </Text>
                <Text style={styles.infoValue}>
                  {formatDate(
                    transactionType === "rehan"
                      ? rehan?.openDate || ""
                      : lenden?.date || ""
                  )}
                </Text>
              </View>
            </View>

            {transactionType === "rehan" && rehan?.closedDate && (
              <View style={styles.infoRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Closed Date</Text>
                  <Text style={styles.infoValue}>
                    {formatDate(rehan.closedDate)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Bill Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Bill ({mediaPaths.length} images)
            </Text>
            {!isEditMode ? (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditMode(true)}
              >
                <Ionicons name="pencil" size={16} color="#007AFF" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Add media buttons - only in edit mode */}
          {isEditMode && (
            <View style={styles.addMediaRow}>
              <TouchableOpacity style={styles.addButton} onPress={takePhoto}>
                <Ionicons name="camera" size={20} color="#007AFF" />
                <Text style={styles.addButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={pickImage}>
                <Ionicons name="images" size={20} color="#007AFF" />
                <Text style={styles.addButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.mediaGrid}>
            {mediaPaths.map((path, index) => (
              <TouchableOpacity
                key={index}
                style={styles.mediaItem}
                onPress={() =>
                  isEditMode ? removeImage(index) : setSelectedImageIndex(index)
                }
                activeOpacity={0.8}
              >
                <Image source={{ uri: path }} style={styles.mediaImage} />
                {isEditMode ? (
                  <View style={styles.removeOverlay}>
                    <Ionicons name="trash" size={24} color="#fff" />
                  </View>
                ) : (
                  <View style={styles.mediaOverlay}>
                    <Ionicons name="expand" size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Close Rehan Button - only for open Rehan entries */}
        {transactionType === "rehan" && rehan?.status === 0 && !isEditMode && (
          <TouchableOpacity
            style={styles.closeRehanButton}
            onPress={handleCloseRehan}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.closeRehanButtonText}>Mark as Closed</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {/* Save Changes Button - only in edit mode with changes */}
      {isEditMode && hasChanges && (
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      {/* Full Screen Image Viewer */}
      {/* Full Screen Image Viewer with Zoom */}
      <Modal
        visible={selectedImageIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImageIndex(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setSelectedImageIndex(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selectedImageIndex !== null && (
            <View style={styles.zoomWrapper}>
              <ReactNativeZoomableView
                maxZoom={5}
                minZoom={1}
                zoomStep={0.5}
                initialZoom={1}
                bindToBorders={false}
                captureEvent={true}
                doubleTapZoomToCenter={true}
                style={styles.zoomView}
              >
                <Image
                  source={{ uri: mediaPaths[selectedImageIndex] }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </ReactNativeZoomableView>

              <View style={styles.footerContainer}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedImageIndex === 0 && styles.navButtonDisabled,
                  ]}
                  onPress={() =>
                    selectedImageIndex > 0 &&
                    setSelectedImageIndex(selectedImageIndex - 1)
                  }
                  disabled={selectedImageIndex === 0}
                >
                  <Ionicons
                    name="chevron-back"
                    size={28}
                    color={selectedImageIndex === 0 ? "#666" : "#fff"}
                  />
                </TouchableOpacity>

                <Text style={styles.footerText}>
                  {selectedImageIndex + 1} / {mediaPaths.length}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedImageIndex === mediaPaths.length - 1 &&
                      styles.navButtonDisabled,
                  ]}
                  onPress={() =>
                    selectedImageIndex < mediaPaths.length - 1 &&
                    setSelectedImageIndex(selectedImageIndex + 1)
                  }
                  disabled={selectedImageIndex === mediaPaths.length - 1}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={28}
                    color={
                      selectedImageIndex === mediaPaths.length - 1
                        ? "#666"
                        : "#fff"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  errorText: {
    marginTop: 12,
    fontSize: 17,
    color: "#666",
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rehanBadge: {
    backgroundColor: "#E8F5E9",
  },
  lendenBadge: {
    backgroundColor: "#FFF3E0",
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  rehanBadgeText: {
    color: "#2E7D32",
  },
  lendenBadgeText: {
    color: "#E65100",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusOpen: {
    backgroundColor: "#E8F5E9",
  },
  statusClosed: {
    backgroundColor: "#FFEBEE",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOpen: {
    backgroundColor: "#4CAF50",
  },
  statusDotClosed: {
    backgroundColor: "#F44336",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F0F7FF",
    borderRadius: 16,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#007AFF",
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF3B30",
  },
  addMediaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F7FF",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0E4FF",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0F7FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  mediaItem: {
    width: (SCREEN_WIDTH - 44) / 3,
    height: (SCREEN_WIDTH - 44) / 3,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 6,
    borderTopLeftRadius: 8,
  },
  removeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeRehanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F44336",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  closeRehanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  saveContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: "#A0C4FF",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  zoomWrapper: {
    flex: 1,
    width: "100%",
  },
  zoomView: {
    padding: 0,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  footerContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  footerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  navButton: {
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  noDetailsText: {
    textAlign: "center",
    color: "#999",
    fontStyle: "italic",
    padding: 10,
  },
  inputContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  inputLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 16,
    color: "#1A1A1A",
    fontWeight: "500",
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#007AFF",
    paddingBottom: 4,
  },
});

export default TransactionDetailScreen;
