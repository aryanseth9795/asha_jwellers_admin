import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import {
  getUsersWithCounts,
  searchUsersWithCounts,
  UserWithCounts,
  updateUser,
  deleteUser,
} from "../database/entryDatabase";

type ExistingCustomersScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ExistingCustomers"
>;

interface Props {
  navigation: ExistingCustomersScreenNavigationProp;
}

const ExistingCustomersScreen: React.FC<Props> = ({ navigation }) => {
  const [users, setUsers] = useState<UserWithCounts[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithCounts | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Pagination
  const [showAll, setShowAll] = useState(false);
  const DISPLAY_LIMIT = 20;

  const loadUsers = async (query?: string) => {
    try {
      const data = query
        ? await searchUsersWithCounts(query)
        : await getUsersWithCounts();
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUsers(searchQuery);
    }, [searchQuery])
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    loadUsers(text);
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadUsers(searchQuery);
  };

  const openEditModal = (user: UserWithCounts) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditAddress(user.address || "");
    setEditMobile(user.mobileNumber || "");
    setIsEditModalVisible(true);
  };

  const closeEditModal = () => {
    setIsEditModalVisible(false);
    setEditingUser(null);
    setEditName("");
    setEditAddress("");
    setEditMobile("");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    if (!editName.trim()) {
      Alert.alert("Validation Error", "Name is required");
      return;
    }

    setIsSaving(true);
    try {
      await updateUser(
        editingUser.id,
        editName.trim(),
        editAddress.trim() || undefined,
        editMobile.trim() || undefined
      );

      // Refresh list
      await loadUsers(searchQuery);
      closeEditModal();
      Alert.alert("Success", "Customer details updated successfully!");
    } catch (error) {
      console.error("Error updating user:", error);
      Alert.alert("Error", "Failed to update customer. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = (user: UserWithCounts) => {
    Alert.alert(
      "Delete Customer",
      `Are you sure you want to delete "${
        user.name
      }"? This will also delete all ${
        user.rehanCount + user.lendenCount
      } associated transactions. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUser(user.id);
              await loadUsers(searchQuery);
              Alert.alert("Success", "Customer and all transactions deleted.");
            } catch (error) {
              console.error("Error deleting user:", error);
              Alert.alert("Error", "Failed to delete customer.");
            }
          },
        },
      ]
    );
  };

  // Get displayed users based on pagination
  const displayedUsers = showAll ? users : users.slice(0, DISPLAY_LIMIT);
  const hasMoreUsers = users.length > DISPLAY_LIMIT;

  const renderUser = ({ item }: { item: UserWithCounts }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => {
        navigation.navigate("UserTransactions", {
          userId: item.id,
          userName: item.name,
        });
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.infoText} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          )}
          {item.mobileNumber && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={14} color="#666" />
              <Text style={styles.infoText}>{item.mobileNumber}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteUser(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </View>

      {/* Transaction counts */}
      <View style={styles.countsContainer}>
        <View style={styles.countItem}>
          <View style={[styles.countBadge, styles.rehanBadge]}>
            <Text style={styles.countNumber}>{item.rehanCount}</Text>
          </View>
          <Text style={styles.countLabel}>Rehan</Text>
        </View>
        <View style={styles.countItem}>
          <View style={[styles.countBadge, styles.lendenBadge]}>
            <Text style={styles.countNumber}>{item.lendenCount}</Text>
          </View>
          <Text style={styles.countLabel}>Len-Den</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>No Customers Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? "Try a different search term"
          : "Add your first customer to get started"}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, address, or mobile..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* User List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedUsers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            hasMoreUsers && !searchQuery ? (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => setShowAll(!showAll)}
              >
                <Text style={styles.viewAllButtonText}>
                  {showAll
                    ? "Show Less"
                    : `View All (${users.length} customers)`}
                </Text>
                <Ionicons
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#007AFF"
                />
              </TouchableOpacity>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#007AFF"]}
              tintColor="#007AFF"
            />
          }
        />
      )}

      {/* Edit Customer Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Customer</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Customer name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.modalInput, styles.textArea]}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholder="Customer address"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editMobile}
                  onChangeText={setEditMobile}
                  placeholder="Mobile number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeEditModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1A1A1A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
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
  editButton: {
    padding: 8,
    marginRight: 4,
  },
  deleteButton: {
    padding: 8,
    marginRight: 8,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F7FF",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#D0E4FF",
  },
  viewAllButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#007AFF",
  },
  countsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  countItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  rehanBadge: {
    backgroundColor: "#E8F5E9",
  },
  lendenBadge: {
    backgroundColor: "#FFF3E0",
  },
  countNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  countLabel: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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
    borderBottomColor: "#F0F2F5",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  required: {
    color: "#FF3B30",
  },
  modalInput: {
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1A1A1A",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveButtonDisabled: {
    backgroundColor: "#A0C4FF",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

export default ExistingCustomersScreen;
