import React from "react";
import { View } from "react-native";
import { Text } from "../../ui";
import OldJewelleryItemsTable from "../../components/OldJewelleryItemsTable";
import { NewOldJewelleryItem } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  oldJewelleryItems: NewOldJewelleryItem[];
  newJewelleryTotal: number;
  isEditMode: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

const OldJewellerySection: React.FC<Props> = ({
  oldJewelleryItems,
  newJewelleryTotal,
  isEditMode,
  onAdd,
  onEdit,
  onDelete,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Old Jewellery Returned</Text>
      <Text style={styles.sectionSubtitle}>
        Its value is subtracted from the new jewellery on this bill
      </Text>
      <OldJewelleryItemsTable
        items={oldJewelleryItems}
        newJewelleryTotal={newJewelleryTotal}
        editable={isEditMode}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </View>
  );
};

export default OldJewellerySection;
