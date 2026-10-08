import React from "react";
import { View, TouchableOpacity, ActivityIndicator, Switch } from "react-native";
import { Text, TextInput, Screen, LoadError } from "../../ui";
import { WebView } from "react-native-webview";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../../types/entry";
import BillMeasurer from "./BillMeasurer";
import { useBillPreview } from "./useBillPreview";
import { styles } from "./styles";

type Nav = NativeStackNavigationProp<RootStackParamList, "BillPreview">;
type Rt = RouteProp<RootStackParamList, "BillPreview">;

interface Props {
  navigation: Nav;
  route: Rt;
}

const BillPreviewScreen: React.FC<Props> = ({ route }) => {
  const s = useBillPreview(route.params.lendenId);
  const { html, ready, measureHtml, onMeasureMessage } = s.layout;
  const actionsDisabled = s.isBusy || !ready;

  if (s.loadError) {
    return (
      <Screen style={styles.container}>
        <LoadError title="Couldn't load this bill" onRetry={s.load} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      {/* Stays mounted while the spinner gives way to the preview, so the bill is not measured twice. */}
      <BillMeasurer html={measureHtml} onMessage={onMeasureMessage} />
      {s.isLoading || !html ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <BillPreviewBody s={s} html={html} ready={ready} actionsDisabled={actionsDisabled} />
      )}
    </Screen>
  );
};

interface BodyProps {
  s: ReturnType<typeof useBillPreview>;
  html: string;
  ready: boolean;
  actionsDisabled: boolean;
}

/** Controls, the preview and the Share / Print actions. */
const BillPreviewBody: React.FC<BodyProps> = ({ s, html, ready, actionsDisabled }) => {
  return (
    <>
      <View style={styles.controls}>
        <View style={styles.topControlsRow}>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel} numberOfLines={1}>
              बिल नं.
            </Text>
            <TextInput
              style={styles.billNoInput}
              value={s.billNoText}
              onChangeText={(t) => s.setBillNoText(t.replace(/[^0-9]/g, ""))}
              onBlur={s.commitBillNo}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel} numberOfLines={1}>
              भुगतान विवरण
            </Text>
            <Switch value={s.showPaymentDetails} onValueChange={s.togglePaymentDetails} />
          </View>
        </View>

        {s.showPaymentDetails && (
          <TouchableOpacity
            style={styles.nestedControlRow}
            activeOpacity={0.8}
            onPress={() => s.setShowTotalBaki(!s.showTotalBaki)}
          >
            <View style={styles.nestedLabelContainer}>
              <Ionicons name="return-down-forward" size={16} color="#007AFF" />
              <Text style={styles.nestedControlLabel} numberOfLines={1}>
                पिछला व कुल बाकी दिखाएं
              </Text>
            </View>
            <Switch
              value={s.showTotalBaki}
              onValueChange={s.setShowTotalBaki}
              trackColor={{ false: "#D1D1D6", true: "#81B0FF" }}
              thumbColor={s.showTotalBaki ? "#007AFF" : "#F4F3F4"}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.preview}>
        <WebView
          style={styles.webview}
          originWhitelist={["*"]}
          source={{ html }}
          scalesPageToFit={true}
          textZoom={100}
        />
        {!ready && (
          <View style={styles.updating} pointerEvents="none">
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.shareAction, actionsDisabled && styles.actionDisabled]}
          onPress={s.handleShare}
          disabled={actionsDisabled}
        >
          <Ionicons name="share-social" size={20} color="#fff" />
          <Text style={styles.actionText}>शेयर करें</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.action, styles.printAction, actionsDisabled && styles.actionDisabled]}
          onPress={s.handlePrint}
          disabled={actionsDisabled}
        >
          <Ionicons name="print" size={20} color="#fff" />
          <Text style={styles.actionText}>प्रिंट करें</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

export default BillPreviewScreen;
