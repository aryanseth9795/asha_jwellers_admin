import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { renderImageSource } from "./renderImageSource";
import { styles } from "./styles";

interface Props {
  thumbnail: any;
  onPick: () => void;
}

const ThumbnailSection: React.FC<Props> = ({ thumbnail, onPick }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Thumbnail</Text>

      <View style={styles.inputGroup}>
        <TouchableOpacity
          onPress={onPick}
          style={styles.imagePickerButton}
        >
          {thumbnail ? (
            <View style={styles.thumbnailPreview}>
              <Image
                source={renderImageSource(thumbnail)}
                style={styles.fullImage}
              />
              <View style={styles.editOverlay}>
                <Ionicons name="pencil" color="#fff" size={20} />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="image" size={32} color="#ccc" />
              <Text style={styles.placeholderText}>Pick Thumbnail</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ThumbnailSection;
