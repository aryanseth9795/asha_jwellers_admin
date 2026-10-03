import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, TextInput, MIN_TOUCH, colors, fontSize, radius, space } from "../ui";
import { getCategoryOptions } from "../database/itemCategories";
import { BASE_CATEGORIES, categoryKey, resolveCategory } from "../utils/itemCategories";

/** Lets a tap on a suggestion land before the list closes on blur. */
const BLUR_CLOSE_DELAY_MS = 150;
const LIST_MAX_HEIGHT = 240;

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Item category input with a dropdown of the base categories and the custom ones already stored.
 * An empty value is allowed here; the Save handler turns it into "Other" with resolveCategory.
 */
const CategoryPicker: React.FC<Props> = ({
  value,
  onChange,
  label = "Category (optional)",
  placeholder = "Choose a category — Other if left empty",
}) => {
  const [options, setOptions] = useState<string[]>(BASE_CATEGORIES);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const latest = useRef(value);
  latest.current = value;
  const edited = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    getCategoryOptions()
      .then((list) => alive && setOptions(list))
      .catch(() => {});
    return () => {
      alive = false;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const typed = value.trim();
  const needle = categoryKey(typed);
  // Focused and empty shows the whole list; typing narrows it to the matches.
  const suggestions = needle ? options.filter((o) => categoryKey(o).includes(needle)) : options;
  const isNew = needle.length > 0 && !options.some((o) => categoryKey(o) === needle);

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    edited.current = false;
    setOpen(true);
  };

  const handleBlur = () => {
    // Only tidy what the user typed this time; merely opening a field must not rewrite a stored category.
    // An empty field stays empty (it saves as Other); Save runs resolveCategory because it does not blur the input.
    if (edited.current && latest.current.trim()) {
      const resolved = resolveCategory(latest.current, options);
      if (resolved !== latest.current) {
        latest.current = resolved;
        onChange(resolved);
      }
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
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={(text) => {
          edited.current = true;
          onChange(text);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoCapitalize="sentences"
        autoCorrect={false}
      />
      {showList && (
        <View style={styles.list}>
          <ScrollView
            style={{ maxHeight: LIST_MAX_HEIGHT }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.row}
                onPress={() => pick(name)}
                accessibilityRole="button"
                accessibilityLabel={name}
              >
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
            {isNew && (
              <TouchableOpacity
                style={styles.row}
                onPress={() => pick(resolveCategory(typed, options))}
                accessibilityRole="button"
              >
                <Text style={styles.addNew} numberOfLines={2}>
                  + Add "{typed}" as a new category
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", color: "#666", marginBottom: 8 },
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
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  name: { fontSize: fontSize.bodyLg, color: colors.text },
  addNew: { fontSize: fontSize.bodyLg, color: colors.primary, fontWeight: "600" },
});

export default CategoryPicker;
