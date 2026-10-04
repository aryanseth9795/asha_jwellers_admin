import React from "react";
import { View, TouchableOpacity } from "react-native";
import { TextInput } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

interface Props {
  filterName: string;
  setFilterName: (value: string) => void;
}

/** Name Search Bar - Always Visible */
export const SearchBar: React.FC<Props> = ({ filterName, setFilterName }) => (
  <View style={styles.searchContainer}>
    <View style={styles.searchInputWrapper}>
      <Ionicons name="search" size={20} color="#666" />
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name..."
        placeholderTextColor="#999"
        value={filterName}
        onChangeText={setFilterName}
      />
      {filterName.length > 0 && (
        <TouchableOpacity onPress={() => setFilterName("")}>
          <Ionicons name="close-circle" size={20} color="#999" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);
