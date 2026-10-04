import React from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Text, Screen, LoadError } from "../../ui";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../../types/entry";
import { UserWithCounts } from "../../database/entryDatabase";
import { useExistingCustomers } from "./useExistingCustomers";
import { SearchBar } from "./SearchBar";
import { FilterHeader } from "./FilterHeader";
import { FilterPanel } from "./FilterPanel";
import { DateFilterPickers } from "./DateFilterPickers";
import { CustomerCard } from "./CustomerCard";
import { EmptyCustomers } from "./EmptyCustomers";
import { EditCustomerSheet } from "./EditCustomerSheet";
import { styles } from "./styles";

type ExistingCustomersScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ExistingCustomers"
>;

interface Props {
  navigation: ExistingCustomersScreenNavigationProp;
}

const ExistingCustomersScreen: React.FC<Props> = ({ navigation }) => {
  const {
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
  } = useExistingCustomers();

  const renderUser = ({ item }: { item: UserWithCounts }) => (
    <CustomerCard
      item={item}
      onOpen={(user) => {
        navigation.navigate("UserTransactions", {
          userId: user.id,
          userName: user.name,
        });
      }}
      onEdit={openEditModal}
      onDelete={handleDeleteUser}
    />
  );

  const renderEmpty = () => (
    <EmptyCustomers hasActiveFilters={hasActiveFilters} onClearFilters={clearAllFilters} />
  );

  return (
    <Screen style={styles.container}>
      <SearchBar filterName={filterName} setFilterName={setFilterName} />

      <FilterHeader
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        hasActiveFilters={hasActiveFilters}
        clearAllFilters={clearAllFilters}
        filterAddress={filterAddress}
        filterMobile={filterMobile}
        filterDateFrom={filterDateFrom}
        filterDateTo={filterDateTo}
        filterTransactionType={filterTransactionType}
        loadError={loadError}
        userCount={users.length}
      />

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <FilterPanel
          filterAddress={filterAddress}
          setFilterAddress={setFilterAddress}
          filterMobile={filterMobile}
          setFilterMobile={setFilterMobile}
          filterDateFrom={filterDateFrom}
          setFilterDateFrom={setFilterDateFrom}
          filterDateTo={filterDateTo}
          setFilterDateTo={setFilterDateTo}
          setShowDateFromPicker={setShowDateFromPicker}
          setShowDateToPicker={setShowDateToPicker}
          filterTransactionType={filterTransactionType}
          setFilterTransactionType={setFilterTransactionType}
        />
      )}

      <DateFilterPickers
        showDateFromPicker={showDateFromPicker}
        setShowDateFromPicker={setShowDateFromPicker}
        showDateToPicker={showDateToPicker}
        setShowDateToPicker={setShowDateToPicker}
        filterDateFrom={filterDateFrom}
        setFilterDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo}
        setFilterDateTo={setFilterDateTo}
      />

      {/* User List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : loadError ? (
        <LoadError
          title="Couldn't load customers"
          onRetry={onRetry}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      ) : (
        <FlatList
          data={displayedUsers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            hasMoreUsers && !hasActiveFilters ? (
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

      <EditCustomerSheet
        visible={isEditModalVisible}
        isSaving={isSaving}
        editName={editName}
        setEditName={setEditName}
        editNickname={editNickname}
        setEditNickname={setEditNickname}
        editAddress={editAddress}
        setEditAddress={setEditAddress}
        editMobile={editMobile}
        setEditMobile={setEditMobile}
        closeEditModal={closeEditModal}
        handleSaveEdit={handleSaveEdit}
      />
    </Screen>
  );
};

export default ExistingCustomersScreen;
