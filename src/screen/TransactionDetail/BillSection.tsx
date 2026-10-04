import React from "react";
import { View, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { styles } from "./styles";

interface Props {
  mediaPaths: string[];
  isEditMode: boolean;
  mediaTile: number;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  takePhoto: () => void | Promise<void>;
  pickImage: () => void | Promise<void>;
  removeImage: (index: number) => void | Promise<void>;
  setSelectedImageIndex: (index: number | null) => void;
}

const BillSection: React.FC<Props> = ({
  mediaPaths,
  isEditMode,
  mediaTile,
  onStartEdit,
  onCancelEdit,
  takePhoto,
  pickImage,
  removeImage,
  setSelectedImageIndex,
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Bill ({mediaPaths.length} images)
        </Text>
        {!isEditMode ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={onStartEdit}
          >
            <Ionicons name="pencil" size={16} color="#007AFF" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancelEdit}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add media buttons - only in edit mode */}
      {isEditMode && (
        <View style={styles.addMediaRow}>
          <TouchableOpacity style={styles.addButton} onPress={takePhoto}>
            <Ionicons name="camera" size={20} color="#007AFF" />
            <Text style={styles.addButtonText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={pickImage}>
            <Ionicons name="images" size={20} color="#007AFF" />
            <Text style={styles.addButtonText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mediaGrid}>
        {mediaPaths.map((path, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.mediaItem,
              { width: mediaTile, height: mediaTile },
            ]}
            onPress={() =>
              isEditMode ? removeImage(index) : setSelectedImageIndex(index)
            }
            activeOpacity={0.8}
          >
            <Image source={{ uri: path }} style={styles.mediaImage} />
            {isEditMode ? (
              <View style={styles.removeOverlay}>
                <Ionicons name="trash" size={24} color="#fff" />
              </View>
            ) : (
              <View style={styles.mediaOverlay}>
                <Ionicons name="expand" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default BillSection;
