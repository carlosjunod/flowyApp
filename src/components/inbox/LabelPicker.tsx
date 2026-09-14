import React, { useMemo, type ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { orderLabels, type LabelOrder } from "@/lib/labels";
import { useResolvedColors } from "@/lib/theme";
import type { LabelCount } from "@/types/labels";

/** The same counted labels are used for inbox filters and management. */
export function LabelPicker({
  labels,
  selected,
  onSelect,
  order,
  onOrder,
  expanded = true,
  onExpand,
  allCount,
  disabled,
  leading,
  actions,
  onClear,
}: {
  labels: LabelCount[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  order: LabelOrder;
  onOrder: (order: LabelOrder) => void;
  expanded?: boolean;
  onExpand?: () => void;
  allCount?: number;
  disabled?: boolean;
  leading?: ReactNode;
  actions?: ReactNode;
  onClear?: () => void;
}) {
  const colors = useResolvedColors();
  const sorted = useMemo(() => orderLabels(labels, order), [labels, order]);
  const pills = (
    <>
      {onClear && (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
          className="h-11 w-11 items-center justify-center rounded-full bg-card"
        >
          <Feather name="x" size={15} color={colors.muted} />
        </Pressable>
      )}
      {allCount !== undefined && (
        <Pill
          name="All"
          count={allCount}
          active={selected === null}
          onPress={() => onSelect(null)}
          disabled={disabled}
        />
      )}
      {sorted.map((label) => (
        <Pill
          key={label.name}
          {...label}
          active={selected === label.name}
          onPress={() => onSelect(label.name)}
          disabled={disabled}
        />
      ))}
      {!sorted.length && (
        <Text className="py-3 text-muted">No labels yet.</Text>
      )}
    </>
  );
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-1">
        {leading ?? <Text className="text-xs text-muted">Labels</Text>}
        <View className="flex-row items-center">
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
              order === "alphabetical"
                ? "Sorted A to Z. Sort by most saved"
                : "Sorted by most saved. Sort A to Z"
            }
            onPress={() =>
              onOrder(order === "alphabetical" ? "count" : "alphabetical")
            }
            className="h-11 flex-row items-center justify-center gap-1 rounded-lg px-1.5"
          >
            <Feather
              name="bar-chart-2"
              size={14}
              color={colors.muted}
              style={{ transform: [{ rotate: "90deg" }] }}
            />
            <Text className="text-xs text-muted">
              {order === "alphabetical" ? "A–Z" : "9–1"}
            </Text>
          </Pressable>
          {actions}
          {onExpand && (
            <Pressable
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? "Collapse labels" : "Show all labels"
              }
              accessibilityState={{ expanded }}
              onPress={onExpand}
              className="h-11 w-11 items-center justify-center rounded-lg"
            >
              <Feather
                name={expanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.muted}
              />
            </Pressable>
          )}
        </View>
      </View>
      {expanded ? (
        <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
          <View className="flex-row flex-wrap gap-2 pb-1">{pills}</View>
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        >
          {pills}
        </ScrollView>
      )}
    </View>
  );
}
function Pill({
  name,
  count,
  active,
  onPress,
  disabled,
}: LabelCount & { active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={`${name}, ${count} items`}
      onPress={onPress}
      className={`min-h-11 max-w-64 flex-row items-center gap-2 rounded-full px-3.5 ${active ? "bg-fg" : "bg-card"}`}
    >
      <Text
        numberOfLines={1}
        className={`shrink text-sm ${active ? "text-bg" : "text-fg"}`}
      >
        {name}
      </Text>
      <Text className={`text-xs ${active ? "text-bg" : "text-muted"}`}>
        {count}
      </Text>
    </Pressable>
  );
}
