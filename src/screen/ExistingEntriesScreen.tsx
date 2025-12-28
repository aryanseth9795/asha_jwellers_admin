import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Entry } from "../types/entry";
import { getEntriesFiltered } from "../database/entryDatabase";

type ExistingEntriesScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ExistingEntries"
>;

interface Props {
  navigation: ExistingEntriesScreenNavigationProp;
}

const ITEMS_PER_PAGE = 20;

const ExistingEntriesScreen: React.FC<Props> = ({ navigation }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Date filter states
  const [showDateModal, setShowDateModal] = useState(false);
  const [filterDays, setFilterDays] = useState<number | null>(null);

  const loadEntries = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (pageNum === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const offset = pageNum * ITEMS_PER_PAGE;

        let startDate: string | undefined;
        let endDate: string | undefined;

        if (filterDays !== null) {
          const now = new Date();
          const past = new Date();
          past.setDate(now.getDate() - filterDays);
          startDate = past.toISOString();
          endDate = now.toISOString();
        }

        const results = await getEntriesFiltered(
          searchQuery || undefined,
          startDate,
          endDate,
          ITEMS_PER_PAGE,
          offset
        );

        if (isRefresh || pageNum === 0) {
          setEntries(results);
        } else {
          setEntries((prev) => [...prev, ...results]);
        }

        setHasMore(results.length === ITEMS_PER_PAGE);
        setPage(pageNum);
      } catch (error) {
        console.error("Error loading entries:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setRefreshing(false);
      }
    },
    [searchQuery, filterDays]
  );

  useEffect(() => {
    loadEntries(0);
  }, [searchQuery, filterDays]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEntries(0, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadEntries(page + 1);
    }
  };

  const applyFilter = (days: number | null) => {
    setFilterDays(days);
    setShowDateModal(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFilterLabel = () => {
    if (filterDays === null) return null;
    if (filterDays === 1) return "Today";
    if (filterDays === 7) return "Last 7 days";
    if (filterDays === 30) return "Last 30 days";
    if (filterDays === 90) return "Last 3 months";
    return `Last ${filterDays} days`;
  };

  const renderEntry = ({ item }: { item: Entry }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("EntryDetail", { entryId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.cardAddress} numberOfLines={2}>
        {item.address}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>No Entries Found</Text>
        <Text style={styles.emptyText}>
          {searchQuery || filterDays !== null
            ? "Try adjusting your filters"
            : "Start by creating your first entry"}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  const dateFilterOptions = [
    { label: "All Time", value: null },
    { label: "Today", value: 1 },
    { label: "Last 7 days", value: 7 },
    { label: "Last 30 days", value: 30 },
    { label: "Last 3 months", value: 90 },
  ];

  return (
    <View style={styles.container}>
      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or address..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filter Button */}
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterDays !== null && styles.filterButtonActive,
          ]}
          onPress={() => setShowDateModal(true)}
        >
          <Text style={styles.filterButtonIcon}>📅</Text>
        </TouchableOpacity>
      </View>

      {/* Active Filter Display */}
      {filterDays !== null && (
        <View style={styles.activeFilters}>
          <Text style={styles.activeFilterText}>{getFilterLabel()}</Text>
          <TouchableOpacity onPress={() => applyFilter(null)}>
            <Text style={styles.clearFilterText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results Count */}
      {!isLoading && entries.length > 0 && (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"} found
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

      {/* Date Filter Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Time Period</Text>

            <ScrollView style={styles.optionsList}>
              {dateFilterOptions.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.optionItem,
                    filterDays === option.value && styles.optionItemSelected,
                  ]}
                  onPress={() => applyFilter(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      filterDays === option.value && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {filterDays === option.value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowDateModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  searchContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: "#999",
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
  },
  filterButtonIcon: {
    fontSize: 20,
  },
  activeFilters: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeFilterText: {
    fontSize: 14,
    color: "#1976D2",
    fontWeight: "500",
  },
  clearFilterText: {
    fontSize: 14,
    color: "#1976D2",
    fontWeight: "600",
  },
  resultsBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginRight: 12,
  },
  cardDate: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  cardAddress: {
    fontSize: 15,
    color: "#666",
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    marginBottom: 8,
  },
  optionItemSelected: {
    backgroundColor: "#E3F2FD",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  checkmark: {
    fontSize: 20,
    color: "#007AFF",
    fontWeight: "600",
  },
  closeModalButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  closeModalButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});

export default ExistingEntriesScreen;
