import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { EntryType } from "../../types/entry";
import { styles } from "./styles";

interface EntryTypeSectionProps {
  entryType: EntryType | null;
  setEntryType: (type: EntryType) => void;
}

const EntryTypeSection: React.FC<EntryTypeSectionProps> = ({
  entryType,
  setEntryType,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      Entry Type <Text style={styles.required}>*</Text>
    </Text>

    <View style={styles.typeSelector}>
      <TouchableOpacity
        style={[
          styles.typeButton,
          entryType === "rehan" && styles.typeButtonActive,
        ]}
        onPress={() => setEntryType("rehan")}
      >
        <Ionicons
          name="document-text"
          size={24}
          color={entryType === "rehan" ? "#fff" : "#007AFF"}
        />
        <Text
          style={[
            styles.typeButtonText,
            entryType === "rehan" && styles.typeButtonTextActive,
          ]}
        >
          Rehan
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.typeButton,
          entryType === "lenden" && styles.typeButtonActive,
        ]}
        onPress={() => setEntryType("lenden")}
      >
        <Ionicons
          name="swap-horizontal"
          size={24}
          color={entryType === "lenden" ? "#fff" : "#007AFF"}
        />
        <Text
          style={[
            styles.typeButtonText,
            entryType === "lenden" && styles.typeButtonTextActive,
          ]}
        >
          Len-Den
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default EntryTypeSection;
