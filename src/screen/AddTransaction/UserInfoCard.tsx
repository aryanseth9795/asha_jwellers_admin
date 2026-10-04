import React from "react";
import { View } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

interface UserInfoCardProps {
  userName: string;
  userAddress?: string;
  userMobileNumber?: string;
}

const UserInfoCard: React.FC<UserInfoCardProps> = ({
  userName,
  userAddress,
  userMobileNumber,
}) => (
  <View style={styles.userInfoCard}>
    <View style={styles.avatarContainer}>
      <Text style={styles.avatarText}>
        {userName.charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={styles.userDetails}>
      <Text style={styles.userNameText}>{userName}</Text>
      {userAddress && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.infoText} numberOfLines={1}>
            {userAddress}
          </Text>
        </View>
      )}
      {userMobileNumber && (
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={14} color="#666" />
          <Text style={styles.infoText}>{userMobileNumber}</Text>
        </View>
      )}
    </View>
  </View>
);

export default UserInfoCard;
