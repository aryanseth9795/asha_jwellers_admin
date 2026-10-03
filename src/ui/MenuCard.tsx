import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, fontSize, radius, space } from "./theme";

export interface MenuCardProps {
  title: string;
  subtitle: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Icon and chevron colour. */
  accent: string;
  /** Icon tile background. */
  tint: string;
  onPress: () => void;
  size?: "regular" | "large";
}

/** A tappable menu row for Home and the business menus (spec §6). Grows with its text; no fixed height. */
const MenuCard: React.FC<MenuCardProps> = ({ title, subtitle, icon, accent, tint, onPress, size = "regular" }) => {
  const large = size === "large";
  return (
    <TouchableOpacity
      style={[styles.card, large && styles.cardLarge]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.icon, large && styles.iconLarge, { backgroundColor: tint }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={large ? 30 : 24} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, large && styles.titleLarge]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={accent} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 72,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardLarge: { minHeight: 104, padding: space.xl, borderRadius: radius.xl },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  iconLarge: { width: 60, height: 60, borderRadius: radius.lg },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.title, fontWeight: "700", color: colors.text },
  titleLarge: { fontSize: fontSize.heading, fontWeight: "800" },
  subtitle: { fontSize: fontSize.caption + 1, color: colors.textDim, marginTop: 2 },
});

export default MenuCard;
