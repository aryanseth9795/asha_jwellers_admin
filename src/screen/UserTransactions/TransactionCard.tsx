import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { formatInr } from "../../utils/analytics/format";
import { Transaction } from "../../database/entryDatabase";
import { styles } from "./styles";

interface Props {
  item: Transaction;
  formatDate: (dateString: string) => string;
  onOpen: (item: Transaction) => void;
  onDelete: (item: Transaction) => void;
}

const TransactionCard: React.FC<Props> = ({
  item,
  formatDate,
  onOpen,
  onDelete,
}) => (
  <TouchableOpacity
    style={styles.card}
    activeOpacity={0.7}
    onPress={() => {
      onOpen(item);
    }}
  >
    <View style={styles.cardHeader}>
      <View
        style={[
          styles.typeBadge,
          item.type === "rehan" ? styles.rehanBadge : styles.lendenBadge,
        ]}
      >
        <Ionicons
          name={item.type === "rehan" ? "document-text" : "swap-horizontal"}
          size={16}
          color={item.type === "rehan" ? "#2E7D32" : "#E65100"}
        />
        <Text
          style={[
            styles.typeBadgeText,
            item.type === "rehan"
              ? styles.rehanBadgeText
              : styles.lendenBadgeText,
          ]}
        >
          {item.type === "rehan" ? "Rehan" : "Len-Den"}
        </Text>
      </View>

      {/* Status for Rehan or Date for Lenden + Delete Button */}
      <View style={styles.headerRight}>
        {item.type === "rehan" ? (
          <View
            style={[
              styles.statusBadge,
              item.status === 0 ? styles.statusOpen : styles.statusClosed,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                item.status === 0 ? styles.dotOpen : styles.dotClosed,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                item.status === 0 ? styles.textOpen : styles.textClosed,
              ]}
            >
              {item.status === 0 ? "Open" : "Closed"}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {item.type === "lenden" && item.status === 1 && (
              <View
                style={[
                  styles.statusBadge,
                  styles.statusClosed,
                  { paddingVertical: 4, paddingHorizontal: 8 },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    styles.textClosed,
                    { fontSize: 11 },
                  ]}
                >
                  CLOSED
                </Text>
              </View>
            )}
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color="#666" />
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>

    {/* Amount and Date Display */}
    {item.amount && (
      <View style={styles.amountDateRow}>
        <View style={styles.amountHighlight}>
          <Ionicons name="cash" size={20} color="#2E7D32" />
          <Text
            style={styles.highlightedAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatInr(item.amount)}
          </Text>
        </View>
        <View style={styles.dateHighlightBadge}>
          <Ionicons name="calendar" size={14} color="#007AFF" />
          <Text style={styles.dateHighlightText} numberOfLines={1}>
            {formatDate(item.date)}
          </Text>
        </View>
      </View>
    )}

    {/* Lenden Financial Summary */}
    {item.type === "lenden" &&
      (item.discount || item.remaining || item.jama || item.baki) && (
        <View style={styles.lendenSummary}>
          {item.discount ? (
            <View style={styles.summaryChip}>
              <Ionicons name="pricetag" size={12} color="#666" />
              <Text style={styles.summaryChipText} numberOfLines={1}>
                -{formatInr(item.discount)}
              </Text>
            </View>
          ) : null}
          {item.remaining ? (
            <View style={styles.summaryChip}>
              <Ionicons name="wallet" size={12} color="#666" />
              <Text style={styles.summaryChipText} numberOfLines={1}>
                {formatInr(item.remaining)}
              </Text>
            </View>
          ) : null}
          {item.jama ? (
            <View style={[styles.summaryChip, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="arrow-down-circle" size={12} color="#2E7D32" />
              <Text
                style={[styles.summaryChipText, { color: "#2E7D32" }]}
                numberOfLines={1}
              >
                {formatInr(item.jama)}
              </Text>
            </View>
          ) : null}
          {item.baki ? (
            <View style={[styles.summaryChip, { backgroundColor: "#FFEBEE" }]}>
              <Ionicons name="arrow-up-circle" size={12} color="#C62828" />
              <Text
                style={[styles.summaryChipText, { color: "#C62828" }]}
                numberOfLines={1}
              >
                {formatInr(item.baki)}
              </Text>
            </View>
          ) : null}
        </View>
      )}

    {/* Main content - show date for Rehan */}
    <View style={styles.cardBody}>
      {item.type === "rehan" && item.productName && (
        <View style={styles.infoRow}>
          <Ionicons name="cube-outline" size={16} color="#666" />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.productName}
          </Text>
        </View>
      )}

      {item.type === "rehan" && (
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText} numberOfLines={1}>
            Opened: {formatDate(item.date)}
          </Text>
        </View>
      )}
    </View>

    {/* Bill count indicator */}
    <View style={styles.mediaIndicator}>
      <Ionicons name="images-outline" size={16} color="#999" />
      <Text style={styles.mediaCount}>
        {JSON.parse(item.media).length} images
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#CCC" />
    </View>
  </TouchableOpacity>
);

export default TransactionCard;
