import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },
  summaryHeader: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  amountDateRow: {
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 4,
  },
  amountHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  highlightedAmount: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  dateHighlightBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F7FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  dateHighlightText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0a0a0bff",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#007AFF",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#E5E5E5",
  },
  statsRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
    justifyContent: "space-around",
  },
  statItem: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  openRehanIcon: {
    backgroundColor: "#E8F5E9",
  },
  bakiIcon: {
    backgroundColor: "#FFEBEE",
  },
  statAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  openRehanAmount: {
    color: "#2E7D32",
  },
  bakiAmount: {
    color: "#C62828",
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 88,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rehanBadge: {
    backgroundColor: "#E8F5E9",
  },
  lendenBadge: {
    backgroundColor: "#FFF3E0",
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  rehanBadgeText: {
    color: "#2E7D32",
  },
  lendenBadgeText: {
    color: "#E65100",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOpen: {
    backgroundColor: "#E8F5E9",
  },
  statusClosed: {
    backgroundColor: "#FFEBEE",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOpen: {
    backgroundColor: "#4CAF50",
  },
  dotClosed: {
    backgroundColor: "#F44336",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  textOpen: {
    color: "#2E7D32",
  },
  textClosed: {
    color: "#C62828",
  },
  amountText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 8,
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  cardBody: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    flexShrink: 1,
    fontSize: 14,
    color: "#666",
  },
  mediaIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  mediaCount: {
    flex: 1,
    fontSize: 13,
    color: "#999",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    right: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  filterSection: {
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 4,
  },
  openChip: {
    borderColor: "#A5D6A7",
    backgroundColor: "#E8F5E9",
  },
  openChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  openChipTextActive: {
    color: "#fff",
  },
  closedChip: {
    borderColor: "#EF9A9A",
    backgroundColor: "#FFEBEE",
  },
  closedChipActive: {
    backgroundColor: "#C62828",
    borderColor: "#C62828",
  },
  closedChipTextActive: {
    color: "#fff",
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOpenSmall: {
    backgroundColor: "#4CAF50",
  },
  dotClosedSmall: {
    backgroundColor: "#F44336",
  },
  lendenSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
});
