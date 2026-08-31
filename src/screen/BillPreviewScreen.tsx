import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
} from "react-native";
import { WebView } from "react-native-webview";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, Lenden, User, JamaEntry } from "../types/entry";
import {
  getLendenById,
  getUserById,
  getJamaEntriesByLendenId,
} from "../database/entryDatabase";
import {
  getLendenItems,
  getNextBillNo,
  setLendenBillNo,
} from "../database/lendenItems";
import { buildBillHtml, BillData } from "../services/BillHtmlService";
import { loadTemplateDataUri, sharePdf, printBill } from "../services/BillService";
import { resolveEffectiveAmount } from "../utils/lendenAmount";

type Nav = NativeStackNavigationProp<RootStackParamList, "BillPreview">;
type Rt = RouteProp<RootStackParamList, "BillPreview">;

interface Props {
  navigation: Nav;
  route: Rt;
}

const BillPreviewScreen: React.FC<Props> = ({ route }) => {
  const { lendenId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [html, setHtml] = useState("");
  const [billNo, setBillNo] = useState(0);
  const [billNoText, setBillNoText] = useState("");
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [data, setData] = useState<BillData | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);

      const lenden: Lenden | null = await getLendenById(lendenId);
      if (!lenden) throw new Error("Entry not found");

      const user: User | null = await getUserById(lenden.userId);
      const items = await getLendenItems(lendenId);
      const jama: JamaEntry[] = await getJamaEntriesByLendenId(lendenId);

      // Allocate a bill number the first time this entry is billed, so a
      // reprint always shows the same number.
      let resolvedBillNo = lenden.billNo ?? null;
      if (!resolvedBillNo) {
        resolvedBillNo = await getNextBillNo();
        await setLendenBillNo(lendenId, resolvedBillNo);
      }

      const templateDataUri = await loadTemplateDataUri();
      const amount = resolveEffectiveAmount(lenden, items);

      const billData: BillData = {
        billNo: resolvedBillNo,
        date: lenden.date,
        customer: {
          name: user?.name ?? "",
          address: user?.address ?? null,
          mobile: user?.mobileNumber ?? null,
        },
        items,
        amount,
        discount: lenden.discount ?? 0,
        jamaEntries: jama.map((j) => ({ amount: j.amount, date: j.date })),
        baki: lenden.baki ?? 0,
        showPaymentDetails: false,
        templateDataUri,
      };

      setBillNo(resolvedBillNo);
      setBillNoText(String(resolvedBillNo));
      setData(billData);
    } catch (error) {
      console.error("Error loading bill:", error);
      Alert.alert("Error", "Could not load this bill.");
    } finally {
      setIsLoading(false);
    }
  }, [lendenId]);

  useEffect(() => {
    load();
  }, [load]);

  // Rebuild the HTML whenever the toggle or the bill number changes.
  useEffect(() => {
    if (!data) return;
    setHtml(buildBillHtml({ ...data, showPaymentDetails, billNo }));
  }, [data, showPaymentDetails, billNo]);

  const commitBillNo = async () => {
    const parsed = parseInt(billNoText, 10);
    if (!parsed || parsed === billNo) {
      setBillNoText(String(billNo));
      return;
    }
    await setLendenBillNo(lendenId, parsed);
    setBillNo(parsed);
  };

  const handleShare = async () => {
    try {
      setIsBusy(true);
      await sharePdf(html, billNo);
    } catch (error) {
      console.error("Share failed:", error);
      Alert.alert("Error", "Could not create the PDF.");
    } finally {
      setIsBusy(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsBusy(true);
      await printBill(html);
    } catch (error) {
      console.error("Print failed:", error);
      Alert.alert("Error", "Could not open the print dialog.");
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading || !html) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>बिल नं.</Text>
          <TextInput
            style={styles.billNoInput}
            value={billNoText}
            onChangeText={(t) => setBillNoText(t.replace(/[^0-9]/g, ""))}
            onBlur={commitBillNo}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>भुगतान विवरण</Text>
          <Switch value={showPaymentDetails} onValueChange={setShowPaymentDetails} />
        </View>
      </View>

      <WebView
        style={styles.webview}
        originWhitelist={["*"]}
        source={{ html }}
        scalesPageToFit={true}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.shareAction, isBusy && styles.actionDisabled]}
          onPress={handleShare}
          disabled={isBusy}
        >
          <Ionicons name="share-social" size={20} color="#fff" />
          <Text style={styles.actionText}>शेयर करें</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.action, styles.printAction, isBusy && styles.actionDisabled]}
          onPress={handlePrint}
          disabled={isBusy}
        >
          <Ionicons name="print" size={20} color="#fff" />
          <Text style={styles.actionText}>प्रिंट करें</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  controlLabel: { fontSize: 14, fontWeight: "600", color: "#666" },
  billNoInput: {
    minWidth: 70,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#D0E4FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  webview: { flex: 1, backgroundColor: "#EDEDED" },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  shareAction: { backgroundColor: "#25A244" },
  printAction: { backgroundColor: "#B8860B" },
  actionDisabled: { opacity: 0.5 },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default BillPreviewScreen;
