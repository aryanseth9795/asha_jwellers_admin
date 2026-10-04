import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { UserWithCounts } from "../../database/entryDatabase";
import { styles } from "./styles";

interface Props {
  item: UserWithCounts;
  onOpen: (item: UserWithCounts) => void;
  onEdit: (item: UserWithCounts) => void;
  onDelete: (item: UserWithCounts) => void;
}

export const CustomerCard: React.FC<Props> = ({ item, onOpen, onEdit, onDelete }) => (
  <TouchableOpacity
    style={styles.card}
    activeOpacity={0.7}
    onPress={() => onOpen(item)}
  >
    <View style={styles.cardHeader}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name}
          {item.nickname ? (
            <Text style={styles.userNickname}> ({item.nickname})</Text>
          ) : null}
        </Text>
        {item.address && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        )}
        {item.mobileNumber && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={14} color="#666" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.mobileNumber}
            </Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => onEdit(item)}
      >
        <Ionicons name="create-outline" size={20} color="#007AFF" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </View>

    {/* Transaction counts */}
    <View style={styles.countsContainer}>
      <View style={styles.countItem}>
        <View style={[styles.countBadge, styles.rehanBadge]}>
          <Text style={styles.countNumber} numberOfLines={1}>
            {item.rehanCount}
          </Text>
        </View>
        <Text style={styles.countLabel}>Rehan</Text>
      </View>
      <View style={styles.countItem}>
        <View style={[styles.countBadge, styles.lendenBadge]}>
          <Text style={styles.countNumber} numberOfLines={1}>
            {item.lendenCount}
          </Text>
        </View>
        <Text style={styles.countLabel}>Len-Den</Text>
      </View>
    </View>
  </TouchableOpacity>
);
