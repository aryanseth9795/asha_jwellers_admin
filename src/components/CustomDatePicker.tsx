import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DatePickerProps {
  visible: boolean;
  selectedDate: Date;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

const CustomDatePicker: React.FC<DatePickerProps> = ({
  visible,
  selectedDate,
  onClose,
  onDateSelect,
  minimumDate,
  maximumDate = new Date(),
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [showYearPicker, setShowYearPicker] = useState(false);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    if (maximumDate && date > maximumDate) return true;
    if (minimumDate && date < minimumDate) return true;
    return false;
  };

  const isSelectedDate = (day: number) => {
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentMonth &&
      selectedDate.getFullYear() === currentYear
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear
    );
  };

  const handleDayPress = (day: number) => {
    if (isDateDisabled(day)) return;
    const newDate = new Date(currentYear, currentMonth, day);
    onDateSelect(newDate);
  };

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const canGoNext = () => {
    if (!maximumDate) return true;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    return new Date(nextYear, nextMonth, 1) <= maximumDate;
  };

  const canGoPrev = () => {
    if (!minimumDate) return true;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastDayOfPrevMonth = getDaysInMonth(prevMonth, prevYear);
    return new Date(prevYear, prevMonth, lastDayOfPrevMonth) >= minimumDate;
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = isDateDisabled(day);
      const selected = isSelectedDate(day);
      const today = isToday(day);

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            selected && styles.selectedDay,
            today && !selected && styles.todayDay,
          ]}
          onPress={() => handleDayPress(day)}
          disabled={disabled}
        >
          <Text
            style={[
              styles.dayText,
              disabled && styles.disabledDayText,
              selected && styles.selectedDayText,
              today && !selected && styles.todayDayText,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  // Generate years for picker (5 years back to current year)
  const getYears = () => {
    const years = [];
    const maxYear = maximumDate?.getFullYear() || new Date().getFullYear();
    const minYear = minimumDate?.getFullYear() || maxYear - 10;
    for (let year = maxYear; year >= minYear; year--) {
      years.push(year);
    }
    return years;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Month/Year Navigation */}
          <View style={styles.monthYearRow}>
            <TouchableOpacity
              onPress={goToPrevMonth}
              disabled={!canGoPrev()}
              style={styles.navButton}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={canGoPrev() ? "#007AFF" : "#CCC"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.monthYearButton}
              onPress={() => setShowYearPicker(!showYearPicker)}
            >
              <Text style={styles.monthYearText}>
                {monthNames[currentMonth]} {currentYear}
              </Text>
              <Ionicons
                name={showYearPicker ? "chevron-up" : "chevron-down"}
                size={18}
                color="#007AFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={goToNextMonth}
              disabled={!canGoNext()}
              style={styles.navButton}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={canGoNext() ? "#007AFF" : "#CCC"}
              />
            </TouchableOpacity>
          </View>

          {showYearPicker ? (
            <ScrollView style={styles.yearPicker}>
              {getYears().map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearItem,
                    year === currentYear && styles.yearItemSelected,
                  ]}
                  onPress={() => {
                    setCurrentYear(year);
                    setShowYearPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.yearItemText,
                      year === currentYear && styles.yearItemTextSelected,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <>
              {/* Day Names */}
              <View style={styles.dayNamesRow}>
                {dayNames.map((day) => (
                  <View key={day} style={styles.dayNameCell}>
                    <Text style={styles.dayName}>{day}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>{renderCalendarDays()}</View>
            </>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => onDateSelect(new Date())}
            >
              <Text style={styles.quickButtonText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                onDateSelect(yesterday);
              }}
            >
              <Text style={styles.quickButtonText}>Yesterday</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  monthYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  navButton: {
    padding: 10,
  },
  monthYearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#F0F7FF",
    borderRadius: 20,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  dayNamesRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  dayNameCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  dayName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  disabledDayText: {
    color: "#CCC",
  },
  selectedDay: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
  },
  selectedDayText: {
    color: "#fff",
    fontWeight: "700",
  },
  todayDay: {
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 20,
  },
  todayDayText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  yearPicker: {
    maxHeight: 250,
    paddingHorizontal: 20,
  },
  yearItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  yearItemSelected: {
    backgroundColor: "#F0F7FF",
  },
  yearItemText: {
    fontSize: 16,
    color: "#1A1A1A",
    textAlign: "center",
  },
  yearItemTextSelected: {
    color: "#007AFF",
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 15,
    paddingHorizontal: 20,
  },
  quickButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#F0F7FF",
    borderRadius: 20,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
});

export default CustomDatePicker;
