import { Feather } from "@expo/vector-icons";
import { useI18n } from "@/lib/i18n";
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
import { LabelError, useLabels } from "@/hooks/useLabels";
import type { LabelKind, LabelPreview } from "@/types/labels";
import type { LabelOrder } from "@/lib/labels";
import { LabelPicker } from "./LabelPicker";
import type { ReadingFilter } from "@/types/inbox-presentation";

export function LabelSection({
  category,
  onCategory,
  tag,
  onTag,
  reading = "all",
  onReading,
}: {
  category: string | null;
  onCategory: (value: string | null) => void;
  tag: string | null;
  onTag: (value: string | null) => void;
  reading?: ReadingFilter;
  onReading?: (value: ReadingFilter) => void;
}) {
  const { t, tKey } = useI18n();
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
  // A translation key. `useLabels` throws `LabelError`, whose message *is* the
  // key, so a failure relabels itself when the language changes.
  const [errorKey, setErrorKey] = useState("");
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);
  const labels =
    (kind === "category" ? query.data?.categories : query.data?.tags) ?? [];
  const select = (name: string | null) => {
    setSelected(name);
    setReplacement(name ?? "");
    setPreview(null);
    setErrorKey("");
  };
  async function review(next: string | null) {
    if (!selected || busy) return;
    setBusy(true);
    setErrorKey("");
    try {
      setPreview({ ...(await loadPreview(kind, selected)), replacement: next });
    } catch (e) {
      setErrorKey(e instanceof LabelError ? e.messageKey : 'inbox.labels.reviewFailed');
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!selected || !preview || busy) return;
    setBusy(true);
    setErrorKey("");
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
      setUpdatedCount(result.count);
    } catch (e) {
      setPreview(null);
      setErrorKey(e instanceof LabelError ? e.messageKey : 'inbox.labels.updateFailed');
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
            {value === "category" ? t('inbox.labels.categories') : t('inbox.labels.tags')}
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
            accessibilityLabel={t('inbox.labels.manage')}
            onPress={() => {
              select(null);
              setUpdatedCount(null);
              setErrorKey("");
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
                onReading?.("all");
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
        activeFilter={!expanded && reading !== "all" && onReading ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('inbox.labels.clearReading')} onPress={() => onReading("all")} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent }}>
            <Text style={{ color: colors.accent, fontSize: 13 }}>{reading === "unread" ? t('inbox.labels.unread') : t('inbox.labels.read')}</Text>
            <Feather name="x" size={14} color={colors.accent} />
          </Pressable>
        ) : null}
      >
        {onReading ? (
          <View accessibilityLabel={t('inbox.labels.readingGroup')} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{t('inbox.labels.reading')}</Text>
            <View style={{ flexDirection: "row", padding: 2, borderRadius: 26, backgroundColor: colors.card }}>
              {(["all", "unread", "read"] as const).map(value => {
                const label = value === "all" ? t('inbox.labels.readingAll') : value === "unread" ? t('inbox.labels.unread') : t('inbox.labels.read');
                return (
                <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === "all" ? t('inbox.labels.readingAllLabel') : label} accessibilityState={{ selected: reading === value }} onPress={() => onReading(value)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 24, backgroundColor: reading === value ? colors.fg : colors.card }}>
                  <Text style={{ color: reading === value ? colors.bg : colors.muted, fontSize: 13, fontFamily: "Inter_500Medium" }}>{label}</Text>
                </Pressable>
              ); })}
            </View>
          </View>
        ) : null}
      </LabelPicker>
      {query.isLoading && (
        <Text className="text-muted text-xs">{t('inbox.labels.loading')}</Text>
      )}
      {query.isError && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void query.refetch()}
        >
          <Text accessibilityRole="alert" className="text-danger text-sm">
            {t('inbox.labels.loadFailed')}
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
            <Text className="text-fg text-xl font-semibold">{t('inbox.labels.dialogTitle')}</Text>
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              className="min-h-11 justify-center px-3"
            >
              <Text className="text-accent">{t('inbox.labels.done')}</Text>
            </Pressable>
          </View>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 16 }}
          >
            <Text className="text-muted text-sm">{t('inbox.labels.dialogIntro')}</Text>
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
                {/* The label itself is the user's own text. */}
                <Text className="text-fg font-semibold">{selected}</Text>
                <Text className="text-fg text-sm">{t('inbox.labels.newName')}</Text>
                <TextInput
                  accessibilityLabel={t('inbox.labels.newNameField')}
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
                <Text className="text-muted text-xs">{t('inbox.labels.mergeHint')}</Text>
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
                    <Text className="text-bg">{t('inbox.labels.rename')}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void review(null)}
                    className="min-h-11 justify-center rounded-lg border border-border px-3"
                  >
                    <Text className="text-danger">{t('inbox.labels.deleteLabel')}</Text>
                  </Pressable>
                </View>
                {preview && (
                  <View className="gap-3 border-t border-border pt-3">
                    <Text accessibilityRole="alert" className="text-fg">
                      {preview.replacement === null
                        ? t('inbox.labels.confirmDelete', { name: selected })
                        : t('inbox.labels.confirmRename', { name: selected, replacement: preview.replacement })}
                      {t('inbox.labels.affects', { count: preview.count })}
                    </Text>
                    <View className="flex-row gap-3">
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || preview.count === 0}
                        onPress={() => void apply()}
                        className="min-h-11 justify-center rounded-lg bg-primary px-3"
                      >
                        <Text className="text-bg">{t('inbox.labels.confirm')}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => setPreview(null)}
                        className="min-h-11 justify-center px-3"
                      >
                        <Text className="text-fg">{t('inbox.labels.cancel')}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
            {busy && <Text className="text-muted">{t('inbox.labels.updating')}</Text>}
            {errorKey && (
              <Text accessibilityRole="alert" className="text-danger">
                {tKey(errorKey)}
              </Text>
            )}
            {updatedCount !== null && (
              <Text accessibilityLiveRegion="polite" className="text-fg">
                {t('inbox.labels.updated', { count: updatedCount })}
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
