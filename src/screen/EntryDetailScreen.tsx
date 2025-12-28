import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
  Modal,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, Entry } from "../types/entry";
import { getEntryById, deleteEntry } from "../database/entryDatabase";
import { deleteImages } from "../storage/fileStorage";

type EntryDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EntryDetail"
>;

type EntryDetailScreenRouteProp = RouteProp<RootStackParamList, "EntryDetail">;

interface Props {
  navigation: EntryDetailScreenNavigationProp;
  route: EntryDetailScreenRouteProp;
}

const { width, height } = Dimensions.get("window");

const EntryDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { entryId } = route.params;
  const [entry, setEntry] = useState<Entry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  const loadEntry = async () => {
    try {
      const result = await getEntryById(entryId);
      setEntry(result);
    } catch (error) {
      console.error("Error loading entry:", error);
      Alert.alert("Error", "Failed to load entry details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this entry? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (entry) {
                const imagePaths = JSON.parse(entry.imagePaths);
                await deleteImages(imagePaths);
                await deleteEntry(entryId);

                Alert.alert("Success", "Entry deleted successfully", [
                  {
                    text: "OK",
                    onPress: () => navigation.goBack(),
                  },
                ]);
              }
            } catch (error) {
              console.error("Error deleting entry:", error);
              Alert.alert("Error", "Failed to delete entry");
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openImage = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeImageViewer = () => {
    setSelectedImageIndex(null);
  };

  const showNextImage = (imagePaths: string[]) => {
    if (selectedImageIndex !== null) {
      const nextIndex = (selectedImageIndex + 1) % imagePaths.length;
      setSelectedImageIndex(nextIndex);
    }
  };

  const showPreviousImage = (imagePaths: string[]) => {
    if (selectedImageIndex !== null) {
      const prevIndex =
        selectedImageIndex === 0
          ? imagePaths.length - 1
          : selectedImageIndex - 1;
      setSelectedImageIndex(prevIndex);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Entry not found</Text>
      </View>
    );
  }

  const imagePaths = JSON.parse(entry.imagePaths);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Details Card */}
      <View style={styles.detailsCard}>
        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{entry.name}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{entry.address}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.label}>Created</Text>
          <Text style={styles.dateValue}>{formatDate(entry.createdAt)}</Text>
        </View>

        {/* Image Chips */}
        {imagePaths.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.label}>Photos ({imagePaths.length})</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsContainer}
              >
                {imagePaths.map((path: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => openImage(index)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: path }}
                      style={styles.imageChip}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </View>

      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteButtonText}>🗑️ Delete Entry</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacing} />

      {/* Full-Screen Image Viewer Modal */}
      <Modal
        visible={selectedImageIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.modalContainer}>
          <StatusBar hidden />

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeImageViewer}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Image Counter */}
          {selectedImageIndex !== null && (
            <View style={styles.imageCounterModal}>
              <Text style={styles.imageCounterText}>
                {selectedImageIndex + 1} / {imagePaths.length}
              </Text>
            </View>
          )}

          {/* Full-Screen Image */}
          {selectedImageIndex !== null && (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: selectedImageIndex * width, y: 0 }}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                if (index !== selectedImageIndex) {
                  setSelectedImageIndex(index);
                }
              }}
              scrollEventThrottle={16}
            >
              {imagePaths.map((path: string, index: number) => (
                <Image
                  key={index}
                  source={{ uri: path }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          )}

          {/* Navigation Arrows (if multiple images) */}
          {imagePaths.length > 1 && selectedImageIndex !== null && (
            <>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={() => showPreviousImage(imagePaths)}
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonRight]}
                onPress={() => showNextImage(imagePaths)}
              >
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
  detailsCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  section: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "500",
  },
  value: {
    fontSize: 17,
    color: "#333",
    lineHeight: 24,
  },
  dateValue: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 12,
  },
  chipsContainer: {
    marginTop: 4,
  },
  imageChip: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#e0e0e0",
  },
  deleteButton: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ff3b30",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  deleteButtonText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomSpacing: {
    height: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
  },
  imageCounterModal: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  fullScreenImage: {
    width: width,
    height: height,
  },
  navButton: {
    position: "absolute",
    top: "50%",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  navButtonText: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "300",
  },
});

export default EntryDetailScreen;
