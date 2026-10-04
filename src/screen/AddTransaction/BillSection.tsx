import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

interface BillSectionProps {
  selectedImages: string[];
  takePhoto: () => void;
  pickImages: () => void;
  removeImage: (index: number) => void;
}

const BillSection: React.FC<BillSectionProps> = ({
  selectedImages,
  takePhoto,
  pickImages,
  removeImage,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      Bill (Optional){" "}
      <Text style={styles.mediaCount}>({selectedImages.length})</Text>
    </Text>

    <View style={styles.buttonRow}>
      <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
        <Ionicons name="camera" size={20} color="#007AFF" />
        <Text style={styles.mediaButtonText}>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.mediaButton} onPress={pickImages}>
        <Ionicons name="images" size={20} color="#007AFF" />
        <Text style={styles.mediaButtonText}>Gallery</Text>
      </TouchableOpacity>
    </View>

    {selectedImages.length > 0 && (
      <View style={styles.imageGrid}>
        {selectedImages.map((uri, index) => (
          <View key={index} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.image} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(index)}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    )}
  </View>
);

export default BillSection;
