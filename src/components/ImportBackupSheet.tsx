import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet, Text, colors, fontSize, space } from "../ui";
import type { ImportPreview, TableKey } from "../backup/format";

interface Props {
  visible: boolean;
  preview: ImportPreview | null;
  busy: boolean;
  /** One line shown above the buttons while busy (e.g. "Importing…"). */
  progress?: string | null;
  onMerge: () => void;
  onReplace: () => void;
  onClose: () => void;
}

const ROWS: { key: TableKey; label: string }[] = [
  { key: "customers", label: "Customers" },
  { key: "rehan", label: "Rehan" },
  { key: "rehanTransactions", label: "Rehan diya/jama" },
  { key: "lenden", label: "Len-den" },
  { key: "lendenItems", label: "Bill items" },
  { key: "oldJewellery", label: "Old jewellery" },
  { key: "jamaEntries", label: "Jama payments" },
];

const formatDate = (iso: string | null): string => {
  if (!iso) return "Date unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date unknown";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

const buildWarnings = (preview: ImportPreview): string[] => {
  const out: string[] = [];
  if (preview.billNoClashes.length > 0) {
    out.push(`Bill numbers already used on this phone: ${preview.billNoClashes.join(", ")}`);
  }
  if (preview.missingMedia > 0) {
    out.push(
      preview.missingMedia === 1
        ? "1 photo is missing from the backup"
        : `${preview.missingMedia} photos are missing from the backup`,
    );
  }
  return [...out, ...preview.warnings];
};

const ImportBackupSheet: React.FC<Props> = ({ visible, preview, busy, progress, onMerge, onReplace, onClose }) => {
  const merge = preview?.merge ?? null;
  const subtitle = preview
    ? `${formatDate(preview.createdAt)}${preview.kind === "legacy" ? " · Old backup" : ""}`
    : undefined;

  const footer = preview ? (
    <View style={styles.footer}>
      {busy && progress ? (
        <Text style={styles.progress} numberOfLines={1} accessibilityLiveRegion="polite">
          {progress}
        </Text>
      ) : null}
      {merge ? (
        <TouchableOpacity
          style={[styles.button, styles.primary, busy && styles.disabled]}
          onPress={onMerge}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Safe merge"
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Safe merge</Text>}
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.button, styles.danger, busy && styles.disabled]}
        onPress={onReplace}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Replace and restore"
      >
        {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.dangerText}>Replace & restore</Text>}
      </TouchableOpacity>
    </View>
  ) : undefined;

  const warnings = preview ? buildWarnings(preview) : [];

  return (
    <BottomSheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      title="Import backup"
      subtitle={subtitle}
      footer={footer}
    >
      {preview ? (
        <View>
          <View style={styles.row}>
            <View style={styles.labelCell} />
            <Text style={styles.headCell} numberOfLines={2}>
              In backup
            </Text>
            {merge ? (
              <>
                <Text style={styles.headCell} numberOfLines={2}>
                  New
                </Text>
                <Text style={styles.headCell} numberOfLines={2}>
                  Already here
                </Text>
                <Text style={styles.headCell} numberOfLines={2}>
                  Different
                </Text>
              </>
            ) : null}
          </View>
          {ROWS.map(({ key, label }) => {
            const m = merge ? merge[key] : null;
            return (
              <View key={key} style={[styles.row, styles.dataRow]}>
                <Text style={[styles.labelCell, styles.label]} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.num} numberOfLines={1}>
                  {preview.counts[key]}
                </Text>
                {m ? (
                  <>
                    <Text style={[styles.num, m.insert > 0 && styles.numNew]} numberOfLines={1}>
                      {m.insert}
                    </Text>
                    <Text style={styles.num} numberOfLines={1}>
                      {m.same}
                    </Text>
                    <Text style={[styles.num, m.conflict > 0 && styles.numConflict]} numberOfLines={1}>
                      {m.conflict}
                    </Text>
                  </>
                ) : null}
              </View>
            );
          })}
          {warnings.map((w, i) => (
            <View key={i} style={styles.warning}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.goldDeep} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
};

const COL = 48;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  dataRow: {
    alignItems: "center",
    minHeight: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  labelCell: { flex: 1, flexShrink: 1, minWidth: 0 },
  label: { fontSize: fontSize.body, color: colors.text },
  headCell: {
    width: COL,
    flexShrink: 0,
    textAlign: "right",
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.textDim,
    paddingBottom: space.xs,
  },
  num: {
    width: COL,
    flexShrink: 0,
    textAlign: "right",
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.text,
  },
  numNew: { color: colors.success },
  numConflict: { color: colors.danger },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldLine,
    borderRadius: 10,
    padding: space.md,
    marginTop: space.md,
  },
  warningText: { flex: 1, flexShrink: 1, fontSize: fontSize.body, color: colors.goldDeep },
  footer: { gap: space.sm },
  progress: { fontSize: fontSize.body, fontWeight: "600", color: colors.textDim, textAlign: "center" },
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  primary: { backgroundColor: colors.primary },
  primaryText: { color: colors.white, fontSize: fontSize.bodyLg, fontWeight: "800" },
  danger: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.surface },
  dangerText: { color: colors.danger, fontSize: fontSize.bodyLg, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});

export default ImportBackupSheet;
