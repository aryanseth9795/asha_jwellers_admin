import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../../ui";
import { formatInr } from "../../utils/analytics/format";
import { toLocalDate } from "../../utils/dates";
import CategoryPicker from "../../components/CategoryPicker";
import { Rehan, Lenden } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  transactionType: "rehan" | "lenden";
  isEditMode: boolean;
  rehan: Rehan | null;
  lenden: Lenden | null;
  editProductName: string;
  setEditProductName: (value: string) => void;
  editCategory: string;
  setEditCategory: (value: string) => void;
  editAmount: string;
  setEditAmount: (value: string) => void;
  editDiscount: string;
  setEditDiscount: (value: string) => void;
  editRemaining: string;
  editJama: string;
  setEditJama: (value: string) => void;
  editBaki: string;
}

const TransactionDetailsSection: React.FC<Props> = ({
  transactionType,
  isEditMode,
  rehan,
  lenden,
  editProductName,
  setEditProductName,
  editCategory,
  setEditCategory,
  editAmount,
  setEditAmount,
  editDiscount,
  setEditDiscount,
  editRemaining,
  editJama,
  setEditJama,
  editBaki,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Transaction Details</Text>
      <View style={styles.infoCard}>
        {/* Product Name Input or Display */}
        {isEditMode && transactionType === "rehan" ? (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Product Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter product name"
              value={editProductName}
              onChangeText={setEditProductName}
            />
            <View style={{ marginTop: 12 }}>
              <CategoryPicker value={editCategory} onChange={setEditCategory} />
            </View>
          </View>
        ) : transactionType === "rehan" && rehan?.productName ? (
          <View style={styles.infoRow}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#FFF3E0" }]}
            >
              <Ionicons name="cube" size={20} color="#E65100" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Product Name</Text>
              <Text style={styles.infoValue}>{rehan.productName}</Text>
            </View>
          </View>
        ) : null}

        {!isEditMode && transactionType === "rehan" && rehan?.category ? (
          <View style={styles.infoRow}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#FFF3E0" }]}
            >
              <Ionicons name="pricetag" size={20} color="#E65100" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{rehan.category}</Text>
            </View>
          </View>
        ) : null}

        {/* Amount Input or Display */}
        {isEditMode && transactionType === "rehan" ? (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={editAmount}
              onChangeText={(text) => setEditAmount(text.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
            />
          </View>
        ) : !isEditMode && (
            transactionType === "rehan" ? rehan?.amount : lenden?.amount
          ) ? (
          <View style={styles.amountDateRow}>
            <View style={styles.amountHighlight}>
              <Ionicons name="cash" size={22} color="#2E7D32" />
              <Text
                style={styles.amountValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatInr((transactionType === "rehan"
                  ? rehan?.amount
                  : lenden?.amount
                ) ?? 0)}
              </Text>
            </View>
            <View style={styles.dateBadge}>
              <Ionicons name="calendar" size={14} color="#007AFF" />
              <Text style={styles.dateBadgeText}>
                {toLocalDate(
                  transactionType === "rehan"
                    ? rehan?.openDate
                    : lenden?.date,
                )?.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }) ?? "—"}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Lenden-specific fields: Discount */}
        {isEditMode && transactionType === "lenden" ? (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Discount (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={editDiscount}
              onChangeText={(text) =>
                setEditDiscount(text.replace(/[^0-9]/g, ""))
              }
              keyboardType="numeric"
            />
          </View>
        ) : transactionType === "lenden" && lenden?.discount ? (
          <View style={styles.infoRow}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#FFF8E1" }]}
            >
              <Ionicons name="pricetag" size={20} color="#F9A825" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Discount</Text>
              <Text style={styles.infoValue}>
                {formatInr(lenden.discount)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Lenden-specific fields: Remaining */}
        {isEditMode && transactionType === "lenden" ? (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Remaining (₹) <Text style={styles.autoCalcLabel}>(auto)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={editRemaining}
              editable={false}
              keyboardType="numeric"
            />
          </View>
        ) : transactionType === "lenden" && lenden?.remaining ? (
          <View style={styles.infoRow}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#E3F2FD" }]}
            >
              <Ionicons name="wallet" size={20} color="#1976D2" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Remaining</Text>
              <Text style={styles.infoValue}>
                {formatInr(lenden.remaining)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Lenden-specific fields: Jama */}
        {isEditMode && transactionType === "lenden" ? (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Jama (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={editJama}
              onChangeText={(text) =>
                setEditJama(text.replace(/[^0-9]/g, ""))
              }
              keyboardType="numeric"
            />
          </View>
        ) : transactionType === "lenden" && lenden?.jama ? (
          <View style={styles.infoRow}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#E8F5E9" }]}
            >
              <Ionicons
                name="arrow-down-circle"
                size={20}
                color="#2E7D32"
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Jama</Text>
              <Text style={[styles.infoValue, { color: "#2E7D32" }]}>
                {formatInr(lenden.jama)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Lenden-specific fields: Baki */}
        {isEditMode && transactionType === "lenden" ? (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Baki (₹) <Text style={styles.autoCalcLabel}>(auto)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={editBaki}
              editable={false}
              keyboardType="numeric"
            />
          </View>
        ) : transactionType === "lenden" && lenden?.baki ? (
          <View style={styles.infoRow}>
            <View
              style={[styles.iconContainer, { backgroundColor: "#FFEBEE" }]}
            >
              <Ionicons name="arrow-up-circle" size={20} color="#C62828" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Baki</Text>
              <Text style={[styles.infoValue, { color: "#C62828" }]}>
                {formatInr(lenden.baki)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Fallback if no details and not in edit mode */}
        {!isEditMode &&
          !(transactionType === "rehan" && rehan?.productName) &&
          !(transactionType === "rehan" ? rehan?.amount : lenden?.amount) &&
          !(
            transactionType === "lenden" &&
            (lenden?.discount ||
              lenden?.remaining ||
              lenden?.jama ||
              lenden?.baki)
          ) && (
            <Text style={styles.noDetailsText}>
              No additional details provided
            </Text>
          )}
      </View>
    </View>
  );
};

export default TransactionDetailsSection;
