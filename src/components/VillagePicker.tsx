import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, TextInput, MIN_TOUCH, colors, fontSize, radius, space } from "../ui";
import { getVillages } from "../database/villages";
import { Village, resolveVillage, villageKey } from "../utils/villageNames";

const MAX_SUGGESTIONS = 8;
/** Lets a tap on a suggestion land before the list closes on blur. */
const BLUR_CLOSE_DELAY_MS = 150;

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Village text input with a suggestion list built from the villages already used by customers. */
const VillagePicker: React.FC<Props> = ({ value, onChange, placeholder }) => {
  const [villages, setVillages] = useState<Village[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const latest = useRef(value);
  latest.current = value;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    getVillages()
      .then((list) => alive && setVillages(list))
      .catch(() => {});
    return () => {
      alive = false;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const typed = value.trim();
  const needle = typed.toLowerCase();
  const suggestions = villages.filter((v) => v.name.toLowerCase().includes(needle)).slice(0, MAX_SUGGESTIONS);
  const isNew = typed.length > 0 && !villages.some((v) => villageKey(v.name) === villageKey(typed));

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleBlur = () => {
    const resolved = resolveVillage(latest.current, villages);
    if (resolved !== latest.current) {
      latest.current = resolved;
      onChange(resolved);
    }
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), BLUR_CLOSE_DELAY_MS);
  };

  const pick = (name: string) => {
    latest.current = name;
    onChange(name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const showList = open && (suggestions.length > 0 || isNew);

  return (
    <View>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {showList && (
        <View style={styles.list}>
          {suggestions.map((v) => (
            <TouchableOpacity
              key={v.name}
              style={styles.row}
              onPress={() => pick(v.name)}
              accessibilityRole="button"
              accessibilityLabel={`${v.name}, ${v.count} customers`}
            >
              <Text style={styles.name} numberOfLines={1}>
                {v.name}
              </Text>
              <Text style={styles.count}>{v.count}</Text>
            </TouchableOpacity>
          ))}
          {isNew && (
            <TouchableOpacity
              style={styles.row}
              onPress={() => pick(resolveVillage(typed, villages))}
              accessibilityRole="button"
            >
              <Text style={styles.addNew} numberOfLines={2}>
                + Add "{typed}" as a new village
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#F8F9FA",
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    color: colors.text,
  },
  list: {
    marginTop: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  name: { flex: 1, fontSize: fontSize.bodyLg, color: colors.text },
  count: { marginLeft: space.md, fontSize: fontSize.body, color: colors.textMuted },
  addNew: { flex: 1, fontSize: fontSize.bodyLg, color: colors.primary, fontWeight: "600" },
});

export default VillagePicker;
