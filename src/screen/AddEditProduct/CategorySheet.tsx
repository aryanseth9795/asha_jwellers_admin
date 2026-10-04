import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, BottomSheet } from "../../ui";
import { Category } from "../../services/ProductService";
import { styles } from "./styles";

interface Props {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  categoryId: string;
  onSelect: (id: string) => void;
}

const CategorySheet: React.FC<Props> = ({
  visible,
  onClose,
  categories,
  categoryId,
  onSelect,
}) => {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Select Category"
    >
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat._id}
          style={[
            styles.modalItem,
            categoryId === cat._id && styles.modalItemSelected,
          ]}
          onPress={() => {
            onSelect(cat._id);
          }}
        >
          <Text
            style={[
              styles.modalItemText,
              categoryId === cat._id && styles.modalItemTextSelected,
            ]}
          >
            {cat.name}
          </Text>
          {categoryId === cat._id && (
            <Ionicons name="checkmark" size={20} color="#007AFF" />
          )}
        </TouchableOpacity>
      ))}
    </BottomSheet>
  );
};

export default CategorySheet;
