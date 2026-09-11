import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui/AppIcon";
import { useDigestColors, useDigestVars } from "@/lib/digestAppearance";
import { digestTimezones } from "@/lib/digestSettings";

export function DigestChip({
  label,
  selected,
  onPress,
  disabled,
  role = "checkbox",
  compact = false,
  accessibilityLabel,
}: {
  label: string;
  compact?: boolean;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  role?: "checkbox" | "radio";
}) {
  const colors = useDigestColors();
  return (
    <Pressable
      className="active:opacity-70"
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityHint={
        role === "checkbox"
          ? selected
            ? "Included in digests. Tap to exclude."
            : "Excluded from digests. Tap to include."
          : undefined
      }
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        maxWidth: "100%",
        paddingHorizontal: compact ? 6 : 14,
        minWidth: compact ? 44 : undefined,
        justifyContent: "center",
        paddingVertical: 10,
        borderRadius: compact ? 8 : 12,
        borderWidth: 1,
        borderColor: selected ? colors.fg : colors.border,
        backgroundColor: selected ? colors.fg : colors.bg,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {role === "checkbox" && (
        <AppIcon
          name={selected ? "check" : "minus"}
          size={15}
          color={selected ? colors.bg : colors.muted}
        />
      )}
      <Text
        style={{
          color: selected ? colors.bg : colors.muted,
          fontSize: 14,
          fontFamily: selected ? "Inter_500Medium" : "Inter_400Regular",
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DigestSection({
  title,
  subtitle,
  children,
}: React.PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text
          accessibilityRole="header"
          className="text-base font-semibold text-fg"
        >
          {title}
        </Text>
        {subtitle && (
          <Text className="font-sans text-sm text-muted leading-5">
            {subtitle}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

export function DigestAction({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      className="active:opacity-70"
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text className="text-sm text-fg font-medium">{title}</Text>
    </Pressable>
  );
}

export function DigestTimezone({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const colors = useDigestColors();
  const vars = useDigestVars();
  const timezones = useMemo(() => digestTimezones(value), [value]);
  const options = timezones.filter((zone) =>
    zone
      .replaceAll("_", " ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  function choose(zone: string) {
    onChange(zone);
    setOpen(false);
    setSearch("");
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Timezone"
        accessibilityValue={{ text: value }}
        disabled={disabled}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={{ minHeight: 52, opacity: 1 }}
        className="flex-row items-center gap-3 px-4 py-3 bg-bg border border-border rounded-lg"
      >
        <AppIcon name="globe" color={colors.muted} />
        <Text className="font-sans flex-1 text-base text-fg">
          {value.replaceAll("_", " ")}
        </Text>
        <AppIcon name="chevron-right" color={colors.muted} />
      </Pressable>
      <Modal
        visible={open}
        animationType="none"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={[vars, { flex: 1, backgroundColor: colors.bg }]}>
          <View
            className="px-5 pt-3 pb-2 gap-3"
            style={{ width: "100%", maxWidth: 672, alignSelf: "center" }}
          >
            <View className="flex-row items-center justify-between gap-4">
              <Text
                accessibilityRole="header"
                className="text-2xl text-fg font-semibold"
              >
                Timezone
              </Text>
              <DigestAction title="Done" onPress={() => setOpen(false)} />
            </View>
            <Text className="font-sans text-sm text-muted">
              Choose the timezone for your publication schedule.
            </Text>
            <TextInput
              accessibilityLabel="Search timezones"
              placeholder="Search a city or region"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              className="min-h-12 px-4 py-3 rounded-lg bg-bg border border-border text-base text-fg"
            />
            <DigestAction
              title="Use device timezone"
              onPress={() =>
                choose(Intl.DateTimeFormat().resolvedOptions().timeZone)
              }
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              paddingTop: 0,
              maxWidth: 672,
              width: "100%",
              alignSelf: "center",
            }}
          >
            {options.map((zone) => (
              <Pressable
                key={zone}
                accessibilityRole="radio"
                accessibilityLabel={zone.replaceAll("_", " ")}
                accessibilityState={{ checked: zone === value }}
                onPress={() => choose(zone)}
                className="min-h-12 flex-row items-center py-3 gap-3 border-b border-border"
              >
                <Text className="font-sans flex-1 text-base text-fg">
                  {zone.replaceAll("_", " ")}
                </Text>
                {zone === value && (
                  <AppIcon name="check" color={colors.accent} />
                )}
              </Pressable>
            ))}
            {!options.length && (
              <Text className="font-sans py-5 text-muted">
                No matching timezones. Try a nearby city or region.
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
