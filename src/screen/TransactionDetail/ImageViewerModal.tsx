import React from "react";
import { View, Image, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
// @ts-ignore
import { ReactNativeZoomableView } from "@dudigital/react-native-zoomable-view";
import { EdgeInsets } from "react-native-safe-area-context";
import { Text } from "../../ui";
import { styles } from "./styles";

interface Props {
  selectedImageIndex: number | null;
  setSelectedImageIndex: (index: number | null) => void;
  mediaPaths: string[];
  insets: EdgeInsets;
}

const ImageViewerModal: React.FC<Props> = ({
  selectedImageIndex,
  setSelectedImageIndex,
  mediaPaths,
  insets,
}) => {
  return (
    <>
      {/* Full Screen Image Viewer */}
      {/* Full Screen Image Viewer with Zoom */}
      <Modal
        visible={selectedImageIndex !== null}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSelectedImageIndex(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={[styles.modalCloseButton, { top: insets.top + 8 }]}
            onPress={() => setSelectedImageIndex(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {selectedImageIndex !== null && (
            <View style={styles.zoomWrapper}>
              <ReactNativeZoomableView
                maxZoom={5}
                minZoom={1}
                zoomStep={0.5}
                initialZoom={1}
                bindToBorders={false}
                captureEvent={true}
                doubleTapZoomToCenter={true}
                style={styles.zoomView}
              >
                <Image
                  source={{ uri: mediaPaths[selectedImageIndex] }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </ReactNativeZoomableView>

              <View
                style={[styles.footerContainer, { bottom: insets.bottom + 16 }]}
              >
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedImageIndex === 0 && styles.navButtonDisabled,
                  ]}
                  onPress={() =>
                    selectedImageIndex > 0 &&
                    setSelectedImageIndex(selectedImageIndex - 1)
                  }
                  disabled={selectedImageIndex === 0}
                >
                  <Ionicons
                    name="chevron-back"
                    size={28}
                    color={selectedImageIndex === 0 ? "#666" : "#fff"}
                  />
                </TouchableOpacity>

                <Text style={styles.footerText}>
                  {selectedImageIndex + 1} / {mediaPaths.length}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.navButton,
                    selectedImageIndex === mediaPaths.length - 1 &&
                      styles.navButtonDisabled,
                  ]}
                  onPress={() =>
                    selectedImageIndex < mediaPaths.length - 1 &&
                    setSelectedImageIndex(selectedImageIndex + 1)
                  }
                  disabled={selectedImageIndex === mediaPaths.length - 1}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={28}
                    color={
                      selectedImageIndex === mediaPaths.length - 1
                        ? "#666"
                        : "#fff"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};

export default ImageViewerModal;
