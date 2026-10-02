import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Section, SectionKey } from "../../utils/analytics/report/sections";
import { Text, colors, fontSize } from "../../ui";

/** The four Analytics sections as equal-width tabs that always fit, icon above label (spec §5). */
const SectionBar: React.FC<{
  sections: Section[];
  value: SectionKey;
  onChange: (key: SectionKey) => void;
}> = ({ sections, value, onChange }) => (
  <View style={styles.bar}>
    {sections.map((s) => {
      const active = s.key === value;
      return (
        <TouchableOpacity
          key={s.key}
          style={[styles.tab, active && styles.tabActive]}
          onPress={() => onChange(s.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
        >
          <Ionicons
            name={s.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={active ? colors.goldDeep : colors.textMuted}
          />
          <Text
            style={[styles.label, active && styles.labelActive]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {s.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.goldDeep },
  label: { fontSize: fontSize.caption, fontWeight: "700", color: colors.textMuted },
  labelActive: { color: colors.goldDeep },
});

export default SectionBar;
