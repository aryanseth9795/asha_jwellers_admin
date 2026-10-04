import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { User } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  user: User;
}

const CustomerInfoSection: React.FC<Props> = ({ user }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Customer Information</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="person" size={20} color="#007AFF" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {user.name}
            </Text>
          </View>
        </View>

        {user.address && (
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="location" size={20} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {user.address}
              </Text>
            </View>
          </View>
        )}

        {user.mobileNumber && (
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="call" size={20} color="#007AFF" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Mobile Number</Text>
              <Text style={styles.infoValue}>{user.mobileNumber}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default CustomerInfoSection;
