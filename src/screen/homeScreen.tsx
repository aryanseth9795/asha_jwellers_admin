import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import { exportData } from "../services/ExportService";
import { BUSINESSES, BusinessId } from "../navigation/menus";
import { ALL_EDGES, MenuCard, Screen, Text, colors, fontSize, radius, space } from "../ui";

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

interface Props {
  navigation: HomeScreenNavigationProp;
}

/** Business picker: Asha Jewellers or SSJ (spec §4). */
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportData();
    } catch (error) {
      console.error("Export failed:", error);
      Alert.alert("Export failed", "Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const openBusiness = (id: BusinessId) =>
    id === "aj" ? navigation.navigate("AshaHome") : navigation.navigate("SsjHome");

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Screen edges={ALL_EDGES}>
      {/* Only while Home is on top, so the dark icons don't leak onto the navy headers. */}
      {isFocused && <StatusBar style="dark" />}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name} numberOfLines={1}>
              Ayush
            </Text>
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={14} color={colors.textDim} />
              <Text style={styles.dateText} numberOfLines={1}>
                {today}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={isExporting}
            accessibilityLabel="Export data"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
            )}
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Choose business</Text>
        <View style={styles.list}>
          {BUSINESSES.map((b) => (
            <MenuCard
              key={b.id}
              size="large"
              title={b.name}
              subtitle={b.subtitle}
              icon={b.icon}
              accent={b.accent}
              tint={b.tint}
              onPress={() => openBusiness(b.id)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  headerText: { flex: 1, minWidth: 0 },
  greeting: { fontSize: fontSize.bodyLg, color: colors.textDim, fontWeight: "500" },
  name: { fontSize: fontSize.display, fontWeight: "800", color: colors.text, marginTop: 2 },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 6,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
  },
  dateText: { flexShrink: 1, fontSize: fontSize.caption + 1, color: colors.textDim, fontWeight: "600" },
  exportButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    minHeight: 56,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 2,
  },
  exportText: { fontSize: fontSize.caption, fontWeight: "700", color: colors.primary },
  sectionTitle: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: "#333",
    marginTop: space.xxl,
    marginBottom: space.md,
    paddingHorizontal: space.xl,
  },
  list: { gap: space.lg, paddingHorizontal: space.xl },
});

export default HomeScreen;
