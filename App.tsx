import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  Text,
} from "react-native";
import * as Updates from "expo-updates";
import HomeScreen from "./src/screen/homeScreen";
import NewCustomerScreen from "./src/screen/NewCustomerScreen";
import ExistingCustomersScreen from "./src/screen/ExistingCustomersScreen";
import UserTransactionsScreen from "./src/screen/UserTransactionsScreen";
import AddTransactionScreen from "./src/screen/AddTransactionScreen";
import TransactionDetailScreen from "./src/screen/TransactionDetailScreen";
import UpdateBhavScreen from "./src/screen/UpdateBhavScreen";
import CategoryListScreen from "./src/screen/CategoryListScreen";
import AddEditCategoryScreen from "./src/screen/AddEditCategoryScreen";
import ProductListScreen from "./src/screen/ProductListScreen";
import AddEditProductScreen from "./src/screen/AddEditProductScreen";
import { RootStackParamList } from "./src/types/entry";
import { initDatabase } from "./src/database/entryDatabase";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const fadeAnim = useState(new Animated.Value(1))[0];

  // Check for OTA updates
  const checkForUpdates = async () => {
    // Skip update check in development
    if (__DEV__) {
      return;
    }

    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setIsUpdating(true);
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update Available",
          "A new version has been downloaded. Restart the app to apply the update.",
          [
            {
              text: "Restart Now",
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
            {
              text: "Later",
              style: "cancel",
              onPress: () => setIsUpdating(false),
            },
          ],
        );
      }
    } catch (error) {
      console.log("Error checking for updates:", error);
    }
  };

  useEffect(() => {
    // Initialize database on app start
    initDatabase();

    // Check for updates
    checkForUpdates();

    // Show splash screen for 1 second
    const timer = setTimeout(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsLoading(false);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [fadeAnim]);

  if (isLoading) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <StatusBar style="light" />
        <Image
          source={require("./assets/splash-icon.png")}
          style={styles.splashIcon}
          resizeMode="stretch"
        />
        {isUpdating && (
          <View style={styles.updateContainer}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.updateText}>Downloading update...</Text>
          </View>
        )}
      </Animated.View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: "#007AFF",
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: "Home", headerShown: false }}
          />
          <Stack.Screen
            name="NewCustomer"
            component={NewCustomerScreen}
            options={{ title: "New Customer" }}
          />
          <Stack.Screen
            name="ExistingCustomers"
            component={ExistingCustomersScreen}
            options={{ title: "Customers" }}
          />
          <Stack.Screen
            name="UserTransactions"
            component={UserTransactionsScreen}
            options={({ route }) => ({ title: route.params.userName })}
          />
          <Stack.Screen
            name="AddTransaction"
            component={AddTransactionScreen}
            options={{ title: "Add Transaction" }}
          />
          <Stack.Screen
            name="TransactionDetail"
            component={TransactionDetailScreen}
            options={{ title: "Details" }}
          />
          <Stack.Screen
            name="UpdateBhav"
            component={UpdateBhavScreen}
            options={{ title: "Update Bhav" }}
          />
          <Stack.Screen
            name="CategoryList"
            component={CategoryListScreen}
            options={{ title: "Categories" }}
          />
          <Stack.Screen
            name="AddEditCategory"
            component={AddEditCategoryScreen}
            options={{ title: "Category" }}
          />
          <Stack.Screen
            name="ProductList"
            component={ProductListScreen}
            options={{ title: "Products" }}
          />
          <Stack.Screen
            name="AddEditProduct"
            component={AddEditProductScreen}
            options={{ title: "Product" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: "#0B1F4B",
    justifyContent: "center",
    alignItems: "center",
  },
  splashIcon: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  loader: {
    marginTop: 30,
  },
  updateContainer: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  updateText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
