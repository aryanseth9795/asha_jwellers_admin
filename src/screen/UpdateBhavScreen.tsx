import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getBhavRates,
  updateBhavRates,
  BhavData,
  UpdateBhavPayload,
} from "../services/BhavService";

interface BhavField {
  key: keyof BhavData;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

const BHAV_FIELDS: BhavField[] = [
  {
    key: "gold_999_bhav",
    label: "Gold 999",
    icon: "diamond",
    color: "#D4AF37",
    bgColor: "#FEF9E7",
  },
  {
    key: "gold_995_bhav",
    label: "Gold 995",
    icon: "diamond-outline",
    color: "#C9A227",
    bgColor: "#FDF5E6",
  },
  {
    key: "rtgs_bhav",
    label: "RTGS Gold",
    icon: "cash",
    color: "#B8860B",
    bgColor: "#FFF8DC",
  },
  {
    key: "silver_bhav",
    label: "Silver",
    icon: "ellipse",
    color: "#A0A0A0",
    bgColor: "#F5F5F5",
  },
];

const UpdateBhavScreen: React.FC = () => {
  const [bhavData, setBhavData] = useState<BhavData | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await getBhavRates();
      setBhavData(response.data);

      // Initialize edited values with current values
      const initialValues: Record<string, string> = {};
      BHAV_FIELDS.forEach((field) => {
        initialValues[field.key] =
          response.data[field.key]?.value?.toString() || "";
      });
      setEditedValues(initialValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleValueChange = (key: string, value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, "");
    setEditedValues((prev) => ({
      ...prev,
      [key]: numericValue,
    }));
  };

  const handleUpdate = async () => {
    if (!bhavData) return;

    // Build payload with only changed values
    const payload: UpdateBhavPayload = {};
    let hasChanges = false;

    BHAV_FIELDS.forEach((field) => {
      const originalValue = bhavData[field.key]?.value;
      const editedValue = parseInt(editedValues[field.key], 10);

      if (!isNaN(editedValue) && editedValue !== originalValue) {
        (payload as any)[field.key] = editedValue;
        hasChanges = true;
      }
    });

    if (!hasChanges) {
      Alert.alert("No Changes", "No values have been modified.");
      return;
    }

    try {
      setIsUpdating(true);
      const response = await updateBhavRates(payload);
      setBhavData(response.data);

      // Update edited values with new values
      const newValues: Record<string, string> = {};
      BHAV_FIELDS.forEach((field) => {
        newValues[field.key] =
          response.data[field.key]?.value?.toString() || "";
      });
      setEditedValues(newValues);

      Alert.alert("Success", response.message);
    } catch (err) {
      Alert.alert(
        "Update Failed",
        err instanceof Error ? err.message : "Failed to update rates"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  const hasChanges = () => {
    if (!bhavData) return false;
    return BHAV_FIELDS.some((field) => {
      const originalValue = bhavData[field.key]?.value;
      const editedValue = parseInt(editedValues[field.key], 10);
      return !isNaN(editedValue) && editedValue !== originalValue;
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading rates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={60} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchData()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchData(true)}
              tintColor="#007AFF"
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.headerTitle}>Update Bhav Rates</Text>
          <Text style={styles.headerSubtitle}>
            Enter new values and tap Update to save changes
          </Text>

          <View style={styles.cardsContainer}>
            {BHAV_FIELDS.map((field) => (
              <View
                key={field.key}
                style={[styles.card, { backgroundColor: field.bgColor }]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: field.color },
                    ]}
                  >
                    <Ionicons name={field.icon} size={24} color="#fff" />
                  </View>
                  <Text style={styles.cardLabel}>{field.label}</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.input}
                    value={editedValues[field.key] || ""}
                    onChangeText={(value) =>
                      handleValueChange(field.key, value)
                    }
                    keyboardType="numeric"
                    placeholder="Enter value"
                    placeholderTextColor="#999"
                  />
                </View>

                {bhavData?.[field.key]?.updated_at && (
                  <View style={styles.timestampContainer}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.timestampText}>
                      Updated: {formatDateTime(bhavData[field.key].updated_at)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.updateButton,
              (!hasChanges() || isUpdating) && styles.updateButtonDisabled,
            ]}
            onPress={handleUpdate}
            disabled={!hasChanges() || isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={22} color="#fff" />
                <Text style={styles.updateButtonText}>Update Rates</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 24,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: "600",
    color: "#1A1A1A",
    paddingVertical: 14,
  },
  timestampContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  timestampText: {
    fontSize: 13,
    color: "#666",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#F8F9FA",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D4AF37",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  updateButtonDisabled: {
    backgroundColor: "#ccc",
    shadowOpacity: 0,
  },
  updateButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});

export default UpdateBhavScreen;
