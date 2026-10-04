import React from "react";
import { View } from "react-native";
import { Text } from "../../ui";
import LendenItemsTable from "../../components/LendenItemsTable";
import { NewLendenItem } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  lendenItems: NewLendenItem[];
  isEditMode: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

const JewelleryItemsSection: React.FC<Props> = ({
  lendenItems,
  isEditMode,
  onAdd,
  onEdit,
  onDelete,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Jewellery Items</Text>
      <LendenItemsTable
        items={lendenItems}
        editable={isEditMode}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </View>
  );
};

export default JewelleryItemsSection;
