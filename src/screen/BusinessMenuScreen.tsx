import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/entry";
import { BUSINESSES, MenuRoute } from "../navigation/menus";
import { MenuCard, Screen, Text, colors, fontSize, space } from "../ui";

type Props = NativeStackScreenProps<RootStackParamList, "AshaHome" | "SsjHome">;

/** One business's menu: Asha Jewellers or SSJ (spec §4). */
const BusinessMenuScreen: React.FC<Props> = ({ navigation, route }) => {
  const business = BUSINESSES.find((b) => b.hubRoute === route.name) ?? BUSINESSES[0];
  const open = (target: MenuRoute) => {
    switch (target) {
      case "ExistingCustomers":
        return navigation.navigate("ExistingCustomers");
      case "NewCustomer":
        return navigation.navigate("NewCustomer");
      case "Analytics":
        return navigation.navigate("Analytics");
      case "UpdateBhav":
        return navigation.navigate("UpdateBhav");
      case "CategoryList":
        return navigation.navigate("CategoryList");
      case "ProductList":
        return navigation.navigate("ProductList", {});
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lede}>{business.subtitle}</Text>
        <View style={styles.list}>
          {business.items.map((item) => (
            <MenuCard
              key={item.key}
              title={item.label}
              subtitle={item.subtitle}
              icon={item.icon}
              accent={business.accent}
              tint={business.tint}
              onPress={() => open(item.route)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  lede: { fontSize: fontSize.body, color: colors.textDim, marginBottom: space.lg },
  list: { gap: space.md },
});

export default BusinessMenuScreen;
