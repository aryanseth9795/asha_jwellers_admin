import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { PaperSize } from "../../services/bill/geometry";
import { styles } from "./styles";

const PAPERS: PaperSize[] = ["A5", "A4"];

interface Props {
  paper: PaperSize;
  onChange: (paper: PaperSize) => void;
  /** Pages the bill prints on at the current paper; null while it is being planned. */
  pages: number | null;
}

/** The A5 / A4 choice, with a nudge towards A4 when the bill runs past one A5 page. */
const PaperPicker: React.FC<Props> = ({ paper, onChange, pages }) => (
  <>
    <View style={styles.paperRow}>
      <Text style={styles.controlLabel} numberOfLines={1}>
        कागज़
      </Text>
      <View style={styles.segment}>
        {PAPERS.map((p) => {
          const active = p === paper;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.segmentOption, active && styles.segmentOptionActive]}
              onPress={() => onChange(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{p}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>

    {paper === "A5" && pages !== null && pages > 1 && (
      <View style={styles.paperHint}>
        <Ionicons name="information-circle-outline" size={16} color="#B26A00" />
        <Text style={styles.paperHintText}>
          A5 पर {pages} पृष्ठ बनेंगे — एक पृष्ठ के लिए A4 चुनें
        </Text>
      </View>
    )}
  </>
);

export default PaperPicker;
