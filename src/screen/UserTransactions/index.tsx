import React from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text, Screen, LoadError } from "../../ui";
import { Transaction } from "../../database/entryDatabase";
import { useUserTransactions } from "./useUserTransactions";
import SummaryHeader from "./SummaryHeader";
import FilterBar from "./FilterBar";
import TransactionCard from "./TransactionCard";
import EmptyTransactions from "./EmptyTransactions";
import { styles } from "./styles";
import { Props } from "./types";

const UserTransactionsScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const {
    userName,
    transactions,
    user,
    isLoading,
    isRefreshing,
    loadError,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    onRefresh,
    onRetry,
    formatDate,
    filteredTransactions,
    handleDeleteTransaction,
    totalBaki,
    totalOpenRehanAmount,
    openTransaction,
    addTransaction,
  } = useUserTransactions(navigation, route);

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TransactionCard
      item={item}
      formatDate={formatDate}
      onOpen={openTransaction}
      onDelete={handleDeleteTransaction}
    />
  );

  const renderEmpty = () => <EmptyTransactions />;

  if (isLoading) {
    return (
      <Screen style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen style={styles.container}>
        <LoadError
          title="Couldn't load transactions"
          onRetry={onRetry}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      {/* Summary Header */}
      <SummaryHeader
        user={user}
        userName={userName}
        transactions={transactions}
        totalOpenRehanAmount={totalOpenRehanAmount}
        totalBaki={totalBaki}
      />

      {/* Filter Section */}
      <FilterBar
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

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
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={addTransaction}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </Screen>
  );
};

export default UserTransactionsScreen;
