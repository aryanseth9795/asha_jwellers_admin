import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface Column<R> {
  key: string;
  title: string;
  width: number;
  align?: "left" | "right";
  text: (row: R) => string;
  sortValue?: (row: R) => number | string; // tap the header to sort
  shade?: (row: R) => number; // 0..1, drawn as a bar behind the cell
  render?: (row: R) => React.ReactNode; // replaces text when given
}

/** A sideways-scrolling table; tap a sortable header to sort, tap again to flip. */
const DataTable = <R,>({
  columns,
  rows,
  rowKey,
  initialSort,
  onRowPress,
  emptyText = "No rows in this view",
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  initialSort?: { key: string; desc: boolean };
  onRowPress?: (row: R) => void;
  emptyText?: string;
}) => {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col || !col.sortValue) return rows;
    const value = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort!.desc ? -cmp : cmp;
    });
  }, [rows, columns, sort]);

  if (rows.length === 0) return <Text style={styles.empty}>{emptyText}</Text>;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View style={[styles.row, styles.header]}>
          {columns.map((c) => (
            <TouchableOpacity
              key={c.key}
              disabled={!c.sortValue}
              onPress={() => setSort((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : true }))}
              style={{ width: c.width }}
            >
              <Text style={[styles.headerText, c.align === "right" && styles.right]}>
                {c.title}
                {sort?.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {sorted.map((row) => {
          const cells = (
            <View style={styles.row}>
              {columns.map((c) => {
                const shade = c.shade ? Math.max(0, Math.min(1, c.shade(row))) : 0;
                return (
                  <View key={c.key} style={[styles.cell, { width: c.width }]}>
                    {shade > 0 && <View style={[styles.shade, { width: `${shade * 100}%` }]} />}
                    {c.render ? (
                      c.render(row)
                    ) : (
                      <Text style={[styles.cellText, c.align === "right" && styles.right]} numberOfLines={1}>
                        {c.text(row)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
          return onRowPress ? (
            <TouchableOpacity key={rowKey(row)} onPress={() => onRowPress(row)}>
              {cells}
            </TouchableOpacity>
          ) : (
            <View key={rowKey(row)}>{cells}</View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  header: { backgroundColor: "#FAF1E2" },
  headerText: { fontSize: 11, fontWeight: "800", color: "#8C5B14", paddingVertical: 8, paddingHorizontal: 6 },
  cell: { paddingVertical: 8, paddingHorizontal: 6, justifyContent: "center" },
  cellText: { fontSize: 12.5, color: "#1A1A1A" },
  right: { textAlign: "right" },
  shade: { position: "absolute", left: 0, top: 3, bottom: 3, backgroundColor: "#F3E3C3", borderRadius: 3 },
  empty: { color: "#999", fontSize: 13, paddingVertical: 12 },
});

export default DataTable;
