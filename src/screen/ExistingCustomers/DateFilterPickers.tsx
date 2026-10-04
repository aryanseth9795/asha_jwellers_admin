import React from "react";
import { Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

interface Props {
  showDateFromPicker: boolean;
  setShowDateFromPicker: (value: boolean) => void;
  showDateToPicker: boolean;
  setShowDateToPicker: (value: boolean) => void;
  filterDateFrom: Date | null;
  setFilterDateFrom: (value: Date | null) => void;
  filterDateTo: Date | null;
  setFilterDateTo: (value: Date | null) => void;
}

/** Date Pickers */
export const DateFilterPickers: React.FC<Props> = ({
  showDateFromPicker,
  setShowDateFromPicker,
  showDateToPicker,
  setShowDateToPicker,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
}) => (
  <>
    {showDateFromPicker && (
      <DateTimePicker
        value={filterDateFrom || new Date()}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={(event, date) => {
          setShowDateFromPicker(false);
          if (date) setFilterDateFrom(date);
        }}
        maximumDate={filterDateTo || new Date()}
      />
    )}

    {showDateToPicker && (
      <DateTimePicker
        value={filterDateTo || new Date()}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={(event, date) => {
          setShowDateToPicker(false);
          if (date) setFilterDateTo(date);
        }}
        minimumDate={filterDateFrom || undefined}
        maximumDate={new Date()}
      />
    )}
  </>
);
