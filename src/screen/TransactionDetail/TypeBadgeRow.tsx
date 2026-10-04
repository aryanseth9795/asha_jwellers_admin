import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { Rehan } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  transactionType: "rehan" | "lenden";
  rehan: Rehan | null;
}

const TypeBadgeRow: React.FC<Props> = ({ transactionType, rehan }) => {
  return (
    <View style={styles.typeContainer}>
      <View
        style={[
          styles.typeBadge,
          transactionType === "rehan"
            ? styles.rehanBadge
            : styles.lendenBadge,
        ]}
      >
        <Ionicons
          name={
            transactionType === "rehan"
              ? "document-text"
              : "swap-horizontal"
          }
          size={16}
          color={transactionType === "rehan" ? "#2E7D32" : "#E65100"}
        />
        <Text
          style={[
            styles.typeBadgeText,
            transactionType === "rehan"
              ? styles.rehanBadgeText
              : styles.lendenBadgeText,
          ]}
        >
          {transactionType === "rehan" ? "Rehan" : "Len-Den"}
        </Text>
      </View>

      {transactionType === "rehan" && rehan && (
        <View
          style={[
            styles.statusBadge,
            rehan.status === 0 ? styles.statusOpen : styles.statusClosed,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              rehan.status === 0
                ? styles.statusDotOpen
                : styles.statusDotClosed,
            ]}
          />
          <Text style={styles.statusText}>
            {rehan.status === 0 ? "Open" : "Closed"}
          </Text>
        </View>
      )}
    </View>
  );
};

export default TypeBadgeRow;
