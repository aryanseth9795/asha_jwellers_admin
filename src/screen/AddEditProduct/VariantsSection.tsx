import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { FormErrors, LocalVariant } from "./types";
import { styles } from "./styles";

interface Props {
  variants: LocalVariant[];
  errors: FormErrors;
  handleAddVariant: () => void;
  handleEditVariant: (variant: LocalVariant, index: number) => void;
  handleDeleteVariant: (variant: LocalVariant, index: number) => void;
}

const VariantsSection: React.FC<Props> = ({
  variants,
  errors,
  handleAddVariant,
  handleEditVariant,
  handleDeleteVariant,
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Variants</Text>
        <TouchableOpacity
          style={styles.addVariantButton}
          onPress={handleAddVariant}
        >
          <Ionicons name="add-circle" size={24} color="#007AFF" />
          <Text style={styles.addVariantText}>Add Variant</Text>
        </TouchableOpacity>
      </View>

      {variants.length === 0 ? (
        <View>
          <Text style={styles.noVariantsText}>
            No variants added yet. At least one variant is required.
          </Text>
          {errors.variant && (
            <Text style={styles.errorText}>{errors.variant}</Text>
          )}
        </View>
      ) : (
        variants.map((variant, index) => (
          <View key={variant._id || index} style={styles.variantCard}>
            <View style={styles.variantInfo}>
              {variant.size && (
                <Text style={styles.variantDetail}>
                  Size: {variant.size}
                </Text>
              )}
              {variant.weight && (
                <Text style={styles.variantDetail}>
                  Weight: {variant.weight}
                </Text>
              )}
              {!variant.size && !variant.weight && (
                <Text style={styles.variantDetail}>
                  Variant {index + 1}
                </Text>
              )}
              {variant.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
              )}
            </View>
            <View style={styles.variantActions}>
              <TouchableOpacity
                onPress={() => handleEditVariant(variant, index)}
                style={styles.variantActionButton}
              >
                <Ionicons name="pencil" size={18} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteVariant(variant, index)}
                style={styles.variantActionButton}
              >
                <Ionicons name="trash" size={18} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
};

export default VariantsSection;
