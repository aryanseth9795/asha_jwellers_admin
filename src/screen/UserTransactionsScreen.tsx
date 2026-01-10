import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import {
  getTransactionsByUserId,
  getUserById,
  deleteRehan,
  deleteLenden,
  Transaction,
} from "../database/entryDatabase";
import { User } from "../types/entry";

type UserTransactionsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "UserTransactions"
>;

type UserTransactionsScreenRouteProp = RouteProp<
  RootStackParamList,
  "UserTransactions"
>;

interface Props {
  navigation: UserTransactionsScreenNavigationProp;
  route: UserTransactionsScreenRouteProp;
}

const UserTransactionsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId, userName } = route.params;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<"all" | "rehan" | "lenden">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">(
    "all"
  );

  const loadTransactions = async () => {
    try {
      const userData = await getUserById(userId);
      setUser(userData);
      const data = await getTransactionsByUserId(userId);
      setTransactions(data);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [userId])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadTransactions();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Filter transactions
  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    // Type filter
    if (typeFilter !== "all" && t.type !== typeFilter) return false;

    // Status filter (for both Rehan and Lenden)
    if (statusFilter !== "all") {
      // Both Rehan and Lenden use status 0 for open and 1 for closed
      if (t.status === undefined) return false; // Should not happen for valid data
      if (statusFilter === "open" && t.status !== 0) return false;
      if (statusFilter === "closed" && t.status !== 1) return false;
    }
    return true;
  });

  const handleDeleteTransaction = (transaction: Transaction) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              if (transaction.type === "rehan") {
                await deleteRehan(transaction.id);
              } else {
                await deleteLenden(transaction.id);
              }
              await loadTransactions();
            } catch (error) {
              Alert.alert("Error", "Failed to delete transaction");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => {
        navigation.navigate("TransactionDetail", {
          transactionId: item.id,
          transactionType: item.type,
        });
      }}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.typeBadge,
            item.type === "rehan" ? styles.rehanBadge : styles.lendenBadge,
          ]}
        >
          <Ionicons
            name={item.type === "rehan" ? "document-text" : "swap-horizontal"}
            size={16}
            color={item.type === "rehan" ? "#2E7D32" : "#E65100"}
          />
          <Text
            style={[
              styles.typeBadgeText,
              item.type === "rehan"
                ? styles.rehanBadgeText
                : styles.lendenBadgeText,
            ]}
          >
            {item.type === "rehan" ? "Rehan" : "Len-Den"}
          </Text>
        </View>

        {/* Status for Rehan or Date for Lenden + Delete Button */}
        <View style={styles.headerRight}>
          {item.type === "rehan" ? (
            <View
              style={[
                styles.statusBadge,
                item.status === 0 ? styles.statusOpen : styles.statusClosed,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  item.status === 0 ? styles.dotOpen : styles.dotClosed,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  item.status === 0 ? styles.textOpen : styles.textClosed,
                ]}
              >
                {item.status === 0 ? "Open" : "Closed"}
              </Text>
            </View>
          ) : (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {item.type === "lenden" && item.status === 1 && (
                <View
                  style={[
                    styles.statusBadge,
                    styles.statusClosed,
                    { paddingVertical: 4, paddingHorizontal: 8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      styles.textClosed,
                      { fontSize: 11 },
                    ]}
                  >
                    CLOSED
                  </Text>
                </View>
              )}
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={14} color="#666" />
                <Text style={styles.dateText}>{formatDate(item.date)}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteTransaction(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Amount and Date Display */}
      {item.amount && (
        <View style={styles.amountDateRow}>
          <View style={styles.amountHighlight}>
            <Ionicons name="cash" size={20} color="#2E7D32" />
            <Text style={styles.highlightedAmount}>
              ₹{item.amount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.dateHighlightBadge}>
            <Ionicons name="calendar" size={14} color="#007AFF" />
            <Text style={styles.dateHighlightText}>
              {formatDate(item.date)}
            </Text>
          </View>
        </View>
      )}

      {/* Lenden Financial Summary */}
      {item.type === "lenden" &&
        (item.discount || item.remaining || item.jama || item.baki) && (
          <View style={styles.lendenSummary}>
            {item.discount ? (
              <View style={styles.summaryChip}>
                <Ionicons name="pricetag" size={12} color="#666" />
                <Text style={styles.summaryChipText}>
                  -₹{item.discount.toLocaleString()}
                </Text>
              </View>
            ) : null}
            {item.remaining ? (
              <View style={styles.summaryChip}>
                <Ionicons name="wallet" size={12} color="#666" />
                <Text style={styles.summaryChipText}>
                  ₹{item.remaining.toLocaleString()}
                </Text>
              </View>
            ) : null}
            {item.jama ? (
              <View
                style={[styles.summaryChip, { backgroundColor: "#E8F5E9" }]}
              >
                <Ionicons name="arrow-down-circle" size={12} color="#2E7D32" />
                <Text style={[styles.summaryChipText, { color: "#2E7D32" }]}>
                  ₹{item.jama.toLocaleString()}
                </Text>
              </View>
            ) : null}
            {item.baki ? (
              <View
                style={[styles.summaryChip, { backgroundColor: "#FFEBEE" }]}
              >
                <Ionicons name="arrow-up-circle" size={12} color="#C62828" />
                <Text style={[styles.summaryChipText, { color: "#C62828" }]}>
                  ₹{item.baki.toLocaleString()}
                </Text>
              </View>
            ) : null}
          </View>
        )}

      {/* Main content - show date for Rehan */}
      <View style={styles.cardBody}>
        {item.type === "rehan" && item.productName && (
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={16} color="#666" />
            <Text style={styles.infoText}>{item.productName}</Text>
          </View>
        )}

        {item.type === "rehan" && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.infoText}>Opened: {formatDate(item.date)}</Text>
          </View>
        )}
      </View>

      {/* Bill count indicator */}
      <View style={styles.mediaIndicator}>
        <Ionicons name="images-outline" size={16} color="#999" />
        <Text style={styles.mediaCount}>
          {JSON.parse(item.media).length} images
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#CCC" />
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>No Transactions</Text>
      <Text style={styles.emptySubtitle}>
        This customer has no transactions yet
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  // Calculate stats
  const totalBaki = transactions
    .filter((t) => t.type === "lenden" && t.baki)
    .reduce((sum, t) => sum + (t.baki || 0), 0);

  const totalOpenRehanAmount = transactions
    .filter((t) => t.type === "rehan" && t.status === 0 && t.amount)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Summary Header */}
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>{userName}'s Transactions</Text>
        {user?.address && (
          <View style={styles.addressRow}>
            <Ionicons name="location" size={14} color="#666" />
            <Text style={styles.addressText} numberOfLines={1}>
              {user.address}
            </Text>
          </View>
        )}

        {/* Transaction Counts Row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>
              {transactions.filter((t) => t.type === "rehan").length}
            </Text>
            <Text style={styles.summaryLabel}>Rehan</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryCount}>
              {transactions.filter((t) => t.type === "lenden").length}
            </Text>
            <Text style={styles.summaryLabel}>Len-Den</Text>
          </View>
        </View>

        {/* Financial Stats Row */}
        <View style={[styles.summaryRow, styles.statsRow]}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, styles.openRehanIcon]}>
              <Ionicons name="document-text" size={16} color="#2E7D32" />
            </View>
            <View>
              <Text style={[styles.statAmount, styles.openRehanAmount]}>
                ₹{totalOpenRehanAmount.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Open Rehan</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, styles.bakiIcon]}>
              <Ionicons name="arrow-up-circle" size={16} color="#C62828" />
            </View>
            <View>
              <Text style={[styles.statAmount, styles.bakiAmount]}>
                ₹{totalBaki.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Total Baki</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {/* Type Filters */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              typeFilter === "all" && styles.filterChipActive,
            ]}
            onPress={() => {
              setTypeFilter("all");
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                typeFilter === "all" && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              typeFilter === "rehan" && styles.filterChipActive,
            ]}
            onPress={() => setTypeFilter("rehan")}
          >
            <Text
              style={[
                styles.filterChipText,
                typeFilter === "rehan" && styles.filterChipTextActive,
              ]}
            >
              Rehan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              typeFilter === "lenden" && styles.filterChipActive,
            ]}
            onPress={() => {
              setTypeFilter("lenden");
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                typeFilter === "lenden" && styles.filterChipTextActive,
              ]}
            >
              Len-Den
            </Text>
          </TouchableOpacity>

          {/* Status Filters - Always show */}
          <View style={styles.filterDivider} />
          <TouchableOpacity
            style={[
              styles.filterChip,
              styles.openChip,
              statusFilter === "open" && styles.openChipActive,
            ]}
            onPress={() =>
              setStatusFilter(statusFilter === "open" ? "all" : "open")
            }
          >
            <View style={[styles.statusDotSmall, styles.dotOpenSmall]} />
            <Text
              style={[
                styles.filterChipText,
                statusFilter === "open" && styles.openChipTextActive,
              ]}
            >
              Open
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              styles.closedChip,
              statusFilter === "closed" && styles.closedChipActive,
            ]}
            onPress={() =>
              setStatusFilter(statusFilter === "closed" ? "all" : "closed")
            }
          >
            <View style={[styles.statusDotSmall, styles.dotClosedSmall]} />
            <Text
              style={[
                styles.filterChipText,
                statusFilter === "closed" && styles.closedChipTextActive,
              ]}
            >
              Closed
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#007AFF"]}
            tintColor="#007AFF"
          />
        }
      />

      {/* FAB Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          navigation.navigate("AddTransaction", {
            userId,
            userName,
            userAddress: user?.address || undefined,
            userMobileNumber: user?.mobileNumber || undefined,
          });
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
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
  summaryHeader: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  amountDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 4,
  },
  amountHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  highlightedAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  dateHighlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F7FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  dateHighlightText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#007AFF",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#007AFF",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#E5E5E5",
  },
  statsRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
    justifyContent: "space-around",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  openRehanIcon: {
    backgroundColor: "#E8F5E9",
  },
  bakiIcon: {
    backgroundColor: "#FFEBEE",
  },
  statAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  openRehanAmount: {
    color: "#2E7D32",
  },
  bakiAmount: {
    color: "#C62828",
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rehanBadge: {
    backgroundColor: "#E8F5E9",
  },
  lendenBadge: {
    backgroundColor: "#FFF3E0",
  },
  typeBadgeText: {
    fontSize: 13,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
  dotOpen: {
    backgroundColor: "#4CAF50",
  },
  dotClosed: {
    backgroundColor: "#F44336",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  textOpen: {
    color: "#2E7D32",
  },
  textClosed: {
    color: "#C62828",
  },
  amountText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 8,
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  cardBody: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
  },
  mediaIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  mediaCount: {
    flex: 1,
    fontSize: 13,
    color: "#999",
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
  },
  fab: {
    position: "absolute",
    bottom: 100,
    right: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  filterSection: {
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 4,
  },
  openChip: {
    borderColor: "#A5D6A7",
    backgroundColor: "#E8F5E9",
  },
  openChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  openChipTextActive: {
    color: "#fff",
  },
  closedChip: {
    borderColor: "#EF9A9A",
    backgroundColor: "#FFEBEE",
  },
  closedChipActive: {
    backgroundColor: "#C62828",
    borderColor: "#C62828",
  },
  closedChipTextActive: {
    color: "#fff",
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOpenSmall: {
    backgroundColor: "#4CAF50",
  },
  dotClosedSmall: {
    backgroundColor: "#F44336",
  },
  lendenSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
});

export default UserTransactionsScreen;
