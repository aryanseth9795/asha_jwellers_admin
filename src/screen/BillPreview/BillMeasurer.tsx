import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { BILL_PROBE_JS } from "../../services/bill/measure";

interface Props {
  html: string | null;
  onMessage: (raw: string) => void;
}

/**
 * Lays the bill's blocks out in a WebView nobody sees and reports their heights. It runs the same engine and fonts
 * as the PDF renderer, so the heights carry over; textZoom stays at 100 so system font scaling cannot skew them.
 */
const BillMeasurer: React.FC<Props> = ({ html, onMessage }) =>
  html ? (
    <View style={styles.offscreen} pointerEvents="none">
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        injectedJavaScript={BILL_PROBE_JS}
        onMessage={(event) => onMessage(event.nativeEvent.data)}
        javaScriptEnabled
        textZoom={100}
      />
    </View>
  ) : null;

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: 0, top: 0, width: 320, height: 320, opacity: 0 },
});

export default BillMeasurer;
