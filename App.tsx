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
} from "react-native";
import HomeScreen from "./src/screen/homeScreen";
import NewCustomerScreen from "./src/screen/NewCustomerScreen";
import ExistingCustomersScreen from "./src/screen/ExistingCustomersScreen";
import UserTransactionsScreen from "./src/screen/UserTransactionsScreen";
import AddTransactionScreen from "./src/screen/AddTransactionScreen";
import TransactionDetailScreen from "./src/screen/TransactionDetailScreen";
import { RootStackParamList } from "./src/types/entry";
import { initDatabase } from "./src/database/entryDatabase";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    // Initialize database on app start
    initDatabase();

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
});
