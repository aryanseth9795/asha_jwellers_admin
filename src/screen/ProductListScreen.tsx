import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList } from "../types/entry";
import {
  getProducts,
  getCategories,
  deleteProduct,
  Product,
  Category,
} from "../services/ProductService";

type ProductListNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ProductList"
>;

type ProductListRouteProp = RouteProp<RootStackParamList, "ProductList">;

interface Props {
  navigation: ProductListNavigationProp;
  route: ProductListRouteProp;
}

const ProductListScreen: React.FC<Props> = ({ navigation, route }) => {
  const initialCategoryId = route.params?.categoryId;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategoryId || "",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const fetchData = async () => {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        getProducts(selectedCategory || undefined),
        getCategories(),
      ]);
      setProducts(productsResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      Alert.alert("Error", "Failed to load products. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [selectedCategory]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleAddProduct = () => {
    navigation.navigate("AddEditProduct", {});
  };

  const handleEditProduct = (productId: string) => {
    navigation.navigate("AddEditProduct", { productId });
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      "Delete Product",
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(product._id);
              setProducts((prev) => prev.filter((p) => p._id !== product._id));
              Alert.alert("Success", "Product deleted successfully");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete product");
            }
          },
        },
      ],
    );
  };

  const selectedCategoryName = categories.find(
    (c) => c._id === selectedCategory,
  )?.name;

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => handleEditProduct(item._id)}
      onLongPress={() => handleDeleteProduct(item)}
      activeOpacity={0.9}
    >
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.productImage} />
      ) : (
        <View style={[styles.productImage, styles.placeholderImage]}>
          <Ionicons name="cube-outline" size={32} color="#ccc" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.productCategory}>{item.category?.name}</Text>
        <View style={styles.productMeta}>
          {item.variants?.[0]?.weight && (
            <View style={styles.metaTag}>
              <Text style={styles.metaText}>{item.variants[0].weight}</Text>
            </View>
          )}
          {item.variants?.length > 0 && (
            <View style={[styles.metaTag, styles.variantTag]}>
              <Text style={styles.variantText}>
                {item.variants.length} variant
                {item.variants.length > 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteProduct(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Category Filter */}
      <TouchableOpacity
        style={styles.filterContainer}
        onPress={() => setShowFilterModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.filterButton}>
          <Ionicons name="filter-outline" size={20} color="#666" />
          <Text style={styles.filterText}>
            {selectedCategoryName || "All Categories"}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#007AFF" />
        </View>
      </TouchableOpacity>

      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={renderProductItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#007AFF"]}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No products yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add one</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddProduct}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  selectedCategory === "" && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setSelectedCategory("");
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    selectedCategory === "" && styles.modalItemTextSelected,
                  ]}
                >
                  All Categories
                </Text>
                {selectedCategory === "" && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat._id}
                  style={[
                    styles.modalItem,
                    selectedCategory === cat._id && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat._id);
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedCategory === cat._id &&
                        styles.modalItemTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                  {selectedCategory === cat._id && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  filterText: {
    flex: 1,
    fontSize: 16,
    color: "#1A1A1A",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: "#F0F2F5",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
    marginBottom: 6,
  },
  productMeta: {
    flexDirection: "row",
    gap: 8,
  },
  metaTag: {
    backgroundColor: "#F0F2F5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  variantTag: {
    backgroundColor: "#E6F2FF",
  },
  variantText: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  modalList: {
    padding: 8,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalItemSelected: {
    backgroundColor: "#E6F2FF",
  },
  modalItemText: {
    fontSize: 16,
    color: "#333",
  },
  modalItemTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
});

export default ProductListScreen;
