import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  ScrollView,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList } from "../types/entry";
import { exportData } from "../services/ExportService";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExistingPress = () => {
    navigation.navigate("ExistingCustomers");
  };

  const handleNewPress = () => {
    navigation.navigate("NewCustomer");
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportData();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Get current date and day
  const today = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const formattedDate = today.toLocaleDateString("en-IN", options);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>Ayush</Text>
          </View>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Ionicons name="cloud-upload" size={24} color="#999" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.contentSection}>
          <Text style={styles.helpText}>What would you like to do?</Text>

          <View style={styles.cardsContainer}>
            <TouchableOpacity
              style={[styles.card, styles.cardExisting]}
              onPress={handleExistingPress}
              activeOpacity={0.9}
            >
              <View style={styles.cardIconContainer}>
                <Ionicons name="folder-open" size={32} color="#fff" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Existing Customer</Text>
                <Text style={styles.cardSubtitle}>View and manage entries</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardNew]}
              onPress={handleNewPress}
              activeOpacity={0.9}
            >
              <View style={[styles.cardIconContainer, styles.iconContainerNew]}>
                <Ionicons name="person-add" size={32} color="#007AFF" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, styles.textDark]}>
                  New Customer
                </Text>
                <Text style={[styles.cardSubtitle, styles.textDarkDim]}>
                  Create a new entry
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#007AFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardBhav]}
              onPress={() => navigation.navigate("UpdateBhav")}
              activeOpacity={0.9}
            >
              <View
                style={[styles.cardIconContainer, styles.iconContainerBhav]}
              >
                <Ionicons name="trending-up" size={32} color="#D4AF37" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, styles.textDark]}>
                  Update Bhav
                </Text>
                <Text style={[styles.cardSubtitle, styles.textDarkDim]}>
                  Update commodity rates
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#D4AF37" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardCategory]}
              onPress={() => navigation.navigate("CategoryList")}
              activeOpacity={0.9}
            >
              <View
                style={[styles.cardIconContainer, styles.iconContainerCategory]}
              >
                <Ionicons name="folder-outline" size={32} color="#8B5CF6" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, styles.textDark]}>
                  Categories
                </Text>
                <Text style={[styles.cardSubtitle, styles.textDarkDim]}>
                  Manage product categories
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#8B5CF6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardProduct]}
              onPress={() => navigation.navigate("ProductList", {})}
              activeOpacity={0.9}
            >
              <View
                style={[styles.cardIconContainer, styles.iconContainerProduct]}
              >
                <Ionicons name="cube-outline" size={32} color="#10B981" />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, styles.textDark]}>
                  Products
                </Text>
                <Text style={[styles.cardSubtitle, styles.textDarkDim]}>
                  Manage products & variants
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#10B981" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? 40 : 20,
    paddingBottom: 32,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exportButton: {
    padding: 10,
    backgroundColor: "#F0F7FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  greeting: {
    fontSize: 18,
    color: "#666",
    fontWeight: "500",
  },
  userName: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1A1A1A",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  contentSection: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  helpText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 24,
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    height: 120,
  },
  cardExisting: {
    backgroundColor: "#007AFF",
  },
  cardNew: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  cardIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  iconContainerNew: {
    backgroundColor: "#E6F2FF",
  },
  cardBhav: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  iconContainerBhav: {
    backgroundColor: "#FEF9E7",
  },
  cardCategory: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  iconContainerCategory: {
    backgroundColor: "#F3E8FF",
  },
  cardProduct: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  iconContainerProduct: {
    backgroundColor: "#D1FAE5",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  textDark: {
    color: "#1A1A1A",
  },
  textDarkDim: {
    color: "#666",
  },
});

export default HomeScreen;
