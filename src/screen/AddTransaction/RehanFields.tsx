import React from "react";
import { View } from "react-native";
import { Text, TextInput } from "../../ui";
import CategoryPicker from "../../components/CategoryPicker";
import { styles } from "./styles";

interface RehanFieldsProps {
  productName: string;
  setProductName: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
}

const RehanFields: React.FC<RehanFieldsProps> = ({
  productName,
  setProductName,
  category,
  setCategory,
  amount,
  setAmount,
}) => (
  <>
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Product Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter product name"
        value={productName}
        onChangeText={setProductName}
        placeholderTextColor="#999"
      />
    </View>

    <View style={styles.inputContainer}>
      <CategoryPicker value={category} onChange={setCategory} />
    </View>

    <View style={styles.inputContainer}>
      <Text style={styles.label}>
        Amount <Text style={styles.required}>*</Text>
      </Text>
      <View style={styles.amountInputWrapper}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0"
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ""))}
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
      </View>
    </View>
  </>
);

export default RehanFields;
