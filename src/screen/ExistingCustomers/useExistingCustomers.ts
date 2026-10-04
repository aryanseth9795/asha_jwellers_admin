import { useState, useCallback } from "react";
import { notify, confirm } from "../../ui";
import { useFocusEffect } from "@react-navigation/native";
import {
  getUsersWithCounts,
  UserWithCounts,
  updateUser,
  deleteUser,
  filterUsersWithCounts,
  UserFilterOptions,
} from "../../database/entryDatabase";
import { getVillages } from "../../database/villages";
import { normaliseVillageForSave } from "../../utils/villageNames";
import { toDay } from "../../utils/dates";

export type FilterTransactionType = "both" | "rehan" | "lenden";

export const useExistingCustomers = () => {
  const [users, setUsers] = useState<UserWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // A failed read shows a retry state, never "No Customers Found" or a zero count.
  const [loadError, setLoadError] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterAddress, setFilterAddress] = useState("");
  const [filterMobile, setFilterMobile] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);
  const [filterTransactionType, setFilterTransactionType] =
    useState<FilterTransactionType>("both");

  // Date picker states
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);

  // Edit modal state
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithCounts | null>(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Pagination
  const [showAll, setShowAll] = useState(false);
  const DISPLAY_LIMIT = 20;

  // Check if any filter is active
  const hasActiveFilters =
    filterName.trim() !== "" ||
    filterAddress.trim() !== "" ||
    filterMobile.trim() !== "" ||
    filterDateFrom !== null ||
    filterDateTo !== null ||
    filterTransactionType !== "both";

  // Resolves true when the list loaded, false when the read failed (the retry state is then showing). afterSave: a write
  // has just succeeded, so a failed read is reported as "Saved, but couldn't refresh" rather than "Couldn't load".
  const loadUsers = async (afterSave = false): Promise<boolean> => {
    try {
      let data: UserWithCounts[];

      if (hasActiveFilters) {
        const filters: UserFilterOptions = {
          name: filterName.trim() || undefined,
          address: filterAddress.trim() || undefined,
          mobileNumber: filterMobile.trim() || undefined,
          // Plain local days, like the stored dates they are compared with; the UTC day of a picked date is off by one.
          dateFrom: filterDateFrom ? toDay(filterDateFrom) : undefined,
          dateTo: filterDateTo ? toDay(filterDateTo) : undefined,
          transactionType: filterTransactionType,
        };
        data = await filterUsersWithCounts(filters);
      } else {
        data = await getUsersWithCounts();
      }

      setUsers(data);
      setLoadError(false);
      return true;
    } catch (error) {
      console.error("Error loading users:", error);
      setLoadError(true);
      if (afterSave) {
        notify.error("Saved, but couldn't refresh", "Pull down to see the latest list.");
      } else {
        notify.error("Couldn't load customers", "Pull down to try again.");
      }
      return false;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [
      filterName,
      filterAddress,
      filterMobile,
      filterDateFrom,
      filterDateTo,
      filterTransactionType,
    ]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadUsers();
  };

  const onRetry = () => {
    setIsLoading(true);
    loadUsers();
  };

  const clearAllFilters = () => {
    setFilterName("");
    setFilterAddress("");
    setFilterMobile("");
    setFilterDateFrom(null);
    setFilterDateTo(null);
    setFilterTransactionType("both");
  };

  const openEditModal = (user: UserWithCounts) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditNickname(user.nickname || "");
    setEditAddress(user.address || "");
    setEditMobile(user.mobileNumber || "");
    setIsEditModalVisible(true);
  };

  const closeEditModal = () => {
    setIsEditModalVisible(false);
    setEditingUser(null);
    setEditName("");
    setEditNickname("");
    setEditAddress("");
    setEditMobile("");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    if (!editName.trim()) {
      notify.error("Name required", "Name is required");
      return;
    }

    setIsSaving(true);
    try {
      // Save does not blur the focused village field, so normalise here against the current village list, but only
      // when the owner changed it; an untouched village is saved as it is stored.
      const addressChanged = editAddress !== (editingUser.address || "");
      const village = addressChanged
        ? normaliseVillageForSave(editAddress, await getVillages().catch(() => []))
        : editingUser.address || null;
      await updateUser(
        editingUser.id,
        editName.trim(),
        village || undefined,
        editMobile.trim() || undefined,
        editNickname.trim() || undefined,
      );

      // Refresh list. The customer is saved either way, so the sheet closes; success is announced only if the refresh
      // worked (otherwise loadUsers has already said "Saved, but couldn't refresh").
      const refreshed = await loadUsers(true);
      closeEditModal();
      if (refreshed) {
        notify.success("Customer updated", "Customer details updated successfully!");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      notify.error("Update failed", "Failed to update customer. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user: UserWithCounts) => {
    if (
      await confirm({
        title: "Delete customer",
        message: `Are you sure you want to delete "${user.name}"${
          user.nickname ? ` (${user.nickname})` : ""
        }? This will also delete all ${
          user.rehanCount + user.lendenCount
        } associated transactions. This action cannot be undone.`,
        confirmLabel: "Delete",
        tone: "danger",
      })
    ) {
      try {
        await deleteUser(user.id);
        // The customer is deleted either way; announce it only if the refresh worked.
        if (await loadUsers(true)) {
          notify.success("Customer deleted", "Customer and all transactions deleted.");
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        notify.error("Delete failed", "Failed to delete customer.");
      }
    }
  };

  // Get displayed users based on pagination
  const displayedUsers = showAll ? users : users.slice(0, DISPLAY_LIMIT);
  const hasMoreUsers = users.length > DISPLAY_LIMIT;

  return {
    users,
    isLoading,
    isRefreshing,
    loadError,
    showFilters,
    setShowFilters,
    filterName,
    setFilterName,
    filterAddress,
    setFilterAddress,
    filterMobile,
    setFilterMobile,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    filterTransactionType,
    setFilterTransactionType,
    showDateFromPicker,
    setShowDateFromPicker,
    showDateToPicker,
    setShowDateToPicker,
    isEditModalVisible,
    editName,
    setEditName,
    editNickname,
    setEditNickname,
    editAddress,
    setEditAddress,
    editMobile,
    setEditMobile,
    isSaving,
    showAll,
    setShowAll,
    hasActiveFilters,
    onRefresh,
    onRetry,
    clearAllFilters,
    openEditModal,
    closeEditModal,
    handleSaveEdit,
    handleDeleteUser,
    displayedUsers,
    hasMoreUsers,
  };
};
