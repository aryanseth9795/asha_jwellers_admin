import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import { exportBackup, listAutomaticBackups } from "../services/BackupExportService";
import {
  StagedImport,
  applyImport,
  discardStagedImport,
  pickAndStageBackup,
  stageBackupFrom,
} from "../services/BackupImportService";
import { BackupError, ImportMode } from "../backup/format";
import ImportBackupSheet from "../components/ImportBackupSheet";
import { BUSINESSES, BusinessId } from "../navigation/menus";
import { ALL_EDGES, MenuCard, Screen, Text, colors, confirm, fontSize, notify, radius, space, useLayout } from "../ui";

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

interface Props {
  navigation: HomeScreenNavigationProp;
}

/** The service turns every failure into a BackupError with a message meant for the owner. */
const errorText = (error: unknown): string =>
  error instanceof BackupError && error.message ? error.message : "Please try again.";

/** Business picker: Asha Jewellers or SSJ (spec §4). */
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  // Below 340 dp the two buttons stack, so the greeting and the date keep their width.
  const { narrow } = useLayout();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  /** Full-screen progress text while a picked backup is read and checked (backup spec §7). */
  const [phase, setPhase] = React.useState<string | null>(null);
  const [staged, setStaged] = React.useState<StagedImport | null>(null);
  const [applying, setApplying] = React.useState(false);
  const busy = isExporting || isImporting || applying;
  /** One line in the import sheet while it works: the automatic backup first, then the import itself. */
  const [progress, setProgress] = React.useState<string | null>(null);
  /** The newest automatic backup saved before a Replace, or null when there is none. */
  const [previous, setPrevious] = React.useState<{ uri: string; createdAt: Date } | null>(null);

  const refreshPrevious = React.useCallback(async () => {
    setPrevious((await listAutomaticBackups())[0] ?? null);
  }, []);

  // Re-check whenever Home gains focus (a Replace elsewhere may have saved a new automatic backup).
  React.useEffect(() => {
    if (isFocused) refreshPrevious();
  }, [isFocused, refreshPrevious]);

  const handleExport = async () => {
    if (busy) return;
    try {
      setIsExporting(true);
      await exportBackup();
    } catch (error) {
      console.error("Export failed:", error);
      notify.error("Export failed", errorText(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (busy) return;
    setIsImporting(true);
    try {
      const next = await pickAndStageBackup((p) => setPhase(p === "reading" ? "Reading backup…" : "Checking…"));
      // The sheet opens only once there is a preview to show.
      if (next) setStaged(next);
    } catch (error) {
      notify.error("Import failed", errorText(error));
    } finally {
      setPhase(null);
      setIsImporting(false);
    }
  };

  const handleRestorePrevious = async () => {
    if (busy || !previous) return;
    const when = previous.createdAt.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const ok = await confirm({
      tone: "warning",
      title: "Restore previous data?",
      message: `This opens the automatic backup saved on ${when} before your last Replace.`,
      confirmLabel: "Open",
    });
    if (!ok) return;
    setIsImporting(true);
    try {
      setStaged(await stageBackupFrom(previous.uri, (p) => setPhase(p === "reading" ? "Reading backup…" : "Checking…")));
    } catch (error) {
      notify.error("Import failed", errorText(error));
    } finally {
      setPhase(null);
      setIsImporting(false);
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!staged || applying) return;
    if (mode === "replace") {
      const ok = await confirm({
        tone: "danger",
        title: "Replace all data?",
        message:
          "Everything on this phone is replaced by the backup. An automatic backup of the current data is saved first.",
        confirmLabel: "Replace",
      });
      if (!ok) return;
    }
    setApplying(true);
    let announce: () => void;
    try {
      const result = await applyImport(staged, mode, setProgress);
      announce = () =>
        notify.success(
          "Backup imported",
          `${result.inserted} added · ${result.skipped} already here · ${result.conflicts} kept as on this phone`,
        );
    } catch (error) {
      announce = () => notify.error("Import failed", errorText(error));
    }
    // applyImport has deleted the staging folder either way; close the sheet, then tell the owner.
    setApplying(false);
    setProgress(null);
    setStaged(null);
    refreshPrevious();
    announce();
  };

  const closeSheet = () => {
    if (applying || !staged) return;
    discardStagedImport(staged);
    setStaged(null);
  };

  const openBusiness = (id: BusinessId) =>
    id === "aj" ? navigation.navigate("AshaHome") : navigation.navigate("SsjHome");

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Screen edges={ALL_EDGES}>
      {/* Only while Home is on top, so the dark icons don't leak onto the navy headers. */}
      {isFocused && <StatusBar style="dark" />}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name} numberOfLines={1}>
              Ayush
            </Text>
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={14} color={colors.textDim} />
              <Text style={styles.dateText} numberOfLines={2}>
                {today}
              </Text>
            </View>
          </View>
          <View style={[styles.actions, narrow && styles.actionsStacked]}>
            <TouchableOpacity
              style={[styles.actionButton, busy && !isExporting && styles.dimmed]}
              onPress={handleExport}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Export data"
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
              )}
              <Text style={styles.actionText}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, busy && !isImporting && styles.dimmed]}
              onPress={handleImport}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Import backup"
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
              )}
              <Text style={styles.actionText}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>

        {previous ? (
          <TouchableOpacity
            style={[styles.linkButton, busy && styles.dimmed]}
            onPress={handleRestorePrevious}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Restore previous data"
          >
            <Text style={styles.linkText}>Restore previous data</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Choose business</Text>
        <View style={styles.list}>
          {BUSINESSES.map((b) => (
            <MenuCard
              key={b.id}
              size="large"
              title={b.name}
              subtitle={b.subtitle}
              icon={b.icon}
              accent={b.accent}
              tint={b.tint}
              onPress={() => openBusiness(b.id)}
            />
          ))}
        </View>
      </ScrollView>

      {phase ? (
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.progressText} numberOfLines={2}>
              {phase}
            </Text>
          </View>
        </View>
      ) : null}

      <ImportBackupSheet
        visible={staged !== null}
        preview={staged?.preview ?? null}
        busy={applying}
        progress={progress}
        onMerge={() => runImport("merge")}
        onReplace={() => runImport("replace")}
        onClose={closeSheet}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  headerText: { flex: 1, minWidth: 0 },
  greeting: { fontSize: fontSize.bodyLg, color: colors.textDim, fontWeight: "500" },
  name: { fontSize: fontSize.display, fontWeight: "800", color: colors.text, marginTop: 2 },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 6,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
  },
  dateText: { flexShrink: 1, fontSize: fontSize.caption + 1, color: colors.textDim, fontWeight: "600" },
  actions: { flexDirection: "row", gap: space.sm, flexShrink: 0 },
  actionsStacked: { flexDirection: "column" },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    minHeight: 56,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 2,
  },
  actionText: { fontSize: fontSize.caption, fontWeight: "700", color: colors.primary },
  dimmed: { opacity: 0.5 },
  linkButton: {
    alignSelf: "flex-end",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  linkText: { fontSize: fontSize.body, fontWeight: "700", color: colors.primary },
  sectionTitle: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: "#333",
    marginTop: space.xxl,
    marginBottom: space.md,
    paddingHorizontal: space.xl,
  },
  list: { gap: space.lg, paddingHorizontal: space.xl },
  progress: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backdrop,
    padding: space.xl,
  },
  progressCard: {
    alignItems: "center",
    gap: space.md,
    minWidth: 200,
    maxWidth: "100%",
    paddingVertical: space.xl,
    paddingHorizontal: space.xxl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  progressText: { fontSize: fontSize.bodyLg, fontWeight: "700", color: colors.text, textAlign: "center" },
});

export default HomeScreen;
