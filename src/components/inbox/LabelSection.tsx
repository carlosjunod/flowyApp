import { Feather } from "@expo/vector-icons";
import { useResolvedColors } from "@/lib/theme";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLabels } from "@/hooks/useLabels";
import type { LabelKind, LabelPreview } from "@/types/labels";
import type { LabelOrder } from "@/lib/labels";
import { LabelPicker } from "./LabelPicker";

export function LabelSection({
  category,
  onCategory,
  tag,
  onTag,
}: {
  category: string | null;
  onCategory: (value: string | null) => void;
  tag: string | null;
  onTag: (value: string | null) => void;
}) {
  const colors = useResolvedColors();
  const { query, preview: loadPreview, change } = useLabels();
  const [kind, setKind] = useState<LabelKind>("category");
  const [order, setOrder] = useState<LabelOrder>("alphabetical");
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [replacement, setReplacement] = useState("");
  const [preview, setPreview] = useState<
    (LabelPreview & { replacement: string | null }) | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const labels =
    (kind === "category" ? query.data?.categories : query.data?.tags) ?? [];
  const select = (name: string | null) => {
    setSelected(name);
    setReplacement(name ?? "");
    setPreview(null);
    setError("");
  };
  async function review(next: string | null) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      setPreview({ ...(await loadPreview(kind, selected)), replacement: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!selected || !preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await change({
        kind,
        name: selected,
        replacement: preview.replacement,
        revision: preview.revision,
      });
      const next = preview.replacement?.trim().toLowerCase() ?? null;
      if (kind === "category" && category === selected)
        onCategory(next === "tech" ? "technology" : next);
      if (kind === "tag" && tag === selected) onTag(next);
      select(null);
      setNotice(
        `Updated ${result.count} ${result.count === 1 ? "item" : "items"}.`,
      );
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const tabs = (
    <View className="flex-row gap-1">
      {(["category", "tag"] as const).map((value) => (
        <Pressable
          key={value}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ selected: kind === value }}
          onPress={() => {
            setKind(value);
            select(null);
          }}
          className={`min-h-11 justify-center rounded-lg px-2 ${kind === value ? "bg-card" : ""}`}
        >
          <Text
            className={`text-xs ${kind === value ? "text-fg" : "text-muted"}`}
          >
            {value === "category" ? "Categories" : "Tags"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View className="gap-2">
      <LabelPicker
        leading={tabs}
        actions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage labels"
            onPress={() => {
              select(null);
              setNotice("");
              setOpen(true);
            }}
            className="h-11 w-11 items-center justify-center rounded-lg"
          >
            <Feather name="settings" size={17} color={colors.muted} />
          </Pressable>
        }
        onClear={
          category || tag
            ? () => {
                onCategory(null);
                onTag(null);
              }
            : undefined
        }
        labels={labels}
        selected={kind === "category" ? category : tag}
        onSelect={kind === "category" ? onCategory : onTag}
        order={order}
        onOrder={setOrder}
        expanded={expanded}
        onExpand={() => setExpanded((v) => !v)}
        allCount={query.data?.totalItems}
      />
      {query.isLoading && (
        <Text className="text-muted text-xs">Loading labels…</Text>
      )}
      {query.isError && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void query.refetch()}
        >
          <Text accessibilityRole="alert" className="text-danger text-sm">
            Could not load labels. Tap to retry.
          </Text>
        </Pressable>
      )}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
          <View className="flex-row items-center justify-between px-4">
            <Text className="text-fg text-xl font-semibold">Manage labels</Text>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              className="min-h-11 justify-center px-3"
            >
              <Text className="text-accent">Done</Text>
            </Pressable>
          </View>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 16 }}
          >
            <Text className="text-muted text-sm">
              Rename or remove a label across your whole library. Your saved
              items are kept.
            </Text>
            <LabelPicker
              leading={tabs}
              labels={labels}
              selected={selected}
              onSelect={select}
              order={order}
              onOrder={setOrder}
              disabled={busy}
            />
            {selected && (
              <View className="gap-3 rounded-xl border border-border p-4">
                <Text className="text-fg font-semibold">{selected}</Text>
                <Text className="text-fg text-sm">New name</Text>
                <TextInput
                  accessibilityLabel="New label name"
                  editable={!busy}
                  value={replacement}
                  onChangeText={(v) => {
                    setReplacement(v);
                    setPreview(null);
                  }}
                  maxLength={64}
                  autoCapitalize="none"
                  className="min-h-11 rounded-lg border border-border px-3 text-fg"
                />
                <Text className="text-muted text-xs">
                  An existing name combines the labels.
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    accessibilityRole="button"
                    disabled={
                      busy ||
                      !replacement.trim() ||
                      replacement.trim().toLowerCase() === selected
                    }
                    onPress={() => void review(replacement.trim())}
                    className="min-h-11 justify-center rounded-lg bg-primary px-3 disabled:opacity-40"
                  >
                    <Text className="text-bg">Rename</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void review(null)}
                    className="min-h-11 justify-center rounded-lg border border-border px-3"
                  >
                    <Text className="text-danger">Delete label</Text>
                  </Pressable>
                </View>
                {preview && (
                  <View className="gap-3 border-t border-border pt-3">
                    <Text accessibilityRole="alert" className="text-fg">
                      {preview.replacement === null
                        ? `Delete “${selected}”`
                        : `Rename “${selected}” to “${preview.replacement}”`}
                      ? This affects {preview.count}{" "}
                      {preview.count === 1 ? "item" : "items"}.
                    </Text>
                    <View className="flex-row gap-3">
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || preview.count === 0}
                        onPress={() => void apply()}
                        className="min-h-11 justify-center rounded-lg bg-primary px-3"
                      >
                        <Text className="text-bg">Confirm</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => setPreview(null)}
                        className="min-h-11 justify-center px-3"
                      >
                        <Text className="text-fg">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
            {busy && <Text className="text-muted">Updating…</Text>}
            {error && (
              <Text accessibilityRole="alert" className="text-danger">
                {error}
              </Text>
            )}
            {notice && (
              <Text accessibilityLiveRegion="polite" className="text-fg">
                {notice}
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
