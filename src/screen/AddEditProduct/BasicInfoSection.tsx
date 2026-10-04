import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../../ui";
import { Category } from "../../services/ProductService";
import { FormErrors } from "./types";
import { styles } from "./styles";

interface Props {
  name: string;
  onChangeName: (value: string) => void;
  description: string;
  onChangeDescription: (value: string) => void;
  errors: FormErrors;
  selectedCategory: Category | undefined;
  onOpenCategory: () => void;
}

const BasicInfoSection: React.FC<Props> = ({
  name,
  onChangeName,
  description,
  onChangeDescription,
  errors,
  selectedCategory,
  onOpenCategory,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Basic Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={name}
          onChangeText={onChangeName}
          placeholder="Enter product name"
          placeholderTextColor="#999"
          maxLength={200}
        />
        {errors.name && (
          <Text style={styles.errorText}>{errors.name}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={onChangeDescription}
          placeholder="Enter product description (optional)"
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={2000}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Category <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={[
            styles.categorySelector,
            errors.category && styles.inputError,
          ]}
          onPress={onOpenCategory}
        >
          <Text
            style={
              selectedCategory
                ? styles.categoryText
                : styles.categoryPlaceholder
            }
          >
            {selectedCategory?.name || "Select a category"}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.category && (
          <Text style={styles.errorText}>{errors.category}</Text>
        )}
      </View>
    </View>
  );
};

export default BasicInfoSection;
