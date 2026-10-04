import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput, BottomSheet } from "../../ui";
import { LocalVariant } from "./types";
import { renderImageSource } from "./renderImageSource";
import { styles } from "./styles";

interface Props {
  visible: boolean;
  onClose: () => void;
  editingVariant: LocalVariant | null;
  variantSize: string;
  setVariantSize: (value: string) => void;
  variantWeight: string;
  setVariantWeight: (value: string) => void;
  variantImages: any[];
  handleSaveVariant: () => void;
  onPickImage: () => void;
  handleRemoveImage: (index: number) => void;
}

const VariantSheet: React.FC<Props> = ({
  visible,
  onClose,
  editingVariant,
  variantSize,
  setVariantSize,
  variantWeight,
  setVariantWeight,
  variantImages,
  handleSaveVariant,
  onPickImage,
  handleRemoveImage,
}) => {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={editingVariant ? "Edit Variant" : "Add Variant"}
      footer={
        <TouchableOpacity
          style={styles.modalSaveButton}
          onPress={handleSaveVariant}
        >
          <Text style={styles.modalSaveText}>
            {editingVariant ? "Update Variant" : "Add Variant"}
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Size</Text>
        <TextInput
          style={styles.input}
          value={variantSize}
          onChangeText={setVariantSize}
          placeholder="e.g., 7, 8, 9"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Weight</Text>
        <TextInput
          style={styles.input}
          value={variantWeight}
          onChangeText={setVariantWeight}
          placeholder="e.g., 5g, 10g"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Variant Images</Text>
        <View style={styles.addImageRow}>
          <TouchableOpacity
            style={styles.addImageButton}
            onPress={onPickImage}
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addImageText}>Add Image</Text>
          </TouchableOpacity>
        </View>

        {variantImages.length > 0 && (
          <View style={styles.imageList}>
            {variantImages.map((img, index) => (
              <View key={index} style={styles.imageItem}>
                <Image
                  source={renderImageSource(img)}
                  style={styles.imageThumbnail}
                />
                <Text style={styles.imageUrl} numberOfLines={1}>
                  {typeof img === "string" ? "Remote Image" : img.name}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveImage(index)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={22}
                    color="#FF3B30"
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default VariantSheet;
