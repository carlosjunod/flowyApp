import React, { useState } from "react";
import { Platform, Pressable, View, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AppIcon } from "@/components/ui/AppIcon";
import { useTheme } from "@/lib/theme";
import { useDigestColors } from "@/lib/digestAppearance";
import {
  datePickerDate,
  displayTime,
  timePickerDate,
  timePickerValue,
} from "@/lib/digestSettings";

export type DigestDateFieldProps = {
  label: string;
  mode: "time" | "date";
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  disabled?: boolean;
};

export function DigestDateField({
  label,
  mode,
  value,
  onChange,
  minimumDate,
  disabled,
}: DigestDateFieldProps) {
  const [open, setOpen] = useState(false);
  const colors = useDigestColors();
  const { resolved } = useTheme();
  const date = mode === "time" ? timePickerDate(value) : datePickerDate(value);
  const picker = (
    <DateTimePicker
      accessibilityLabel={label}
      value={date}
      mode={mode}
      timeZoneName="Etc/UTC"
      display={Platform.OS === "ios" ? "compact" : "default"}
      themeVariant={resolved}
      accentColor={colors.accent}
      disabled={disabled}
      minimumDate={
        minimumDate ? new Date(`${minimumDate}T00:00:00Z`) : undefined
      }
      onChange={(event, selected) => {
        if (Platform.OS === "android") setOpen(false);
        if (event.type === "set" && selected)
          onChange(
            mode === "time"
              ? timePickerValue(selected)
              : selected.toISOString().slice(0, 10),
          );
      }}
      style={{ minHeight: 48 }}
    />
  );
  if (Platform.OS === "ios")
    return (
      <View style={{ alignSelf: "flex-start", minHeight: 48 }}>{picker}</View>
    );
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{ opacity: disabled ? 0.6 : 1 }}
        className="min-h-12 px-4 py-3 bg-bg border border-border rounded-lg flex-row items-center gap-3"
      >
        <AppIcon
          name={mode === "time" ? "clock" : "calendar"}
          color={colors.accent}
        />
        <Text className="font-sans text-base text-fg">
          {mode === "time"
            ? displayTime(value)
            : date.toLocaleDateString(undefined, {
                timeZone: "UTC",
                dateStyle: "medium",
              })}
        </Text>
        <AppIcon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      {open && picker}
    </>
  );
}
