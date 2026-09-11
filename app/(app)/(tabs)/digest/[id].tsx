import { useChat } from "@/hooks/useChat";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { AppIcon } from "@/components/ui/AppIcon";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeDate } from "@/lib/relativeDate";
import { hostOf } from "@/lib/thumbnails";
import { useResolvedColors } from "@/lib/theme";
import type { Digest, DigestSection } from "@/types";

export default function DigestDetailScreen() {
  const { user } = useAuth();
  const chat = useChat();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery<Digest, Error>({
    queryKey: ["digest", user?.id, id],
    enabled: !!id && !!user,
    queryFn: async () => {
      if (!id) throw new Error("No digest id");
      const res = await api.getDigest(id);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const [notice, setNotice] = useState("");
  useFocusEffect(
    useCallback(() => {
      const mark = () => {
        if (
          query.data &&
          query.data.status !== "source_removed" &&
          id &&
          AppState.currentState === "active"
        )
          void api.readDigest(id);
      };
      const frame = requestAnimationFrame(mark),
        listener = AppState.addEventListener("change", mark);
      return () => {
        cancelAnimationFrame(frame);
        listener.remove();
      };
    }, [query.data, id]),
  );
  const feedback = async (
    target: string,
    value: "useful" | "not_useful" | "not_interested" | null,
  ) => {
    if (!id) return;
    const result = await api.digestFeedback(id, target, value);
    setNotice(
      result.error ? "Could not save feedback. Try again." : "Feedback saved",
    );
    if (!result.error) void query.refetch();
  };
  const open = (source: string) => {
    if (id) void api.digestItemOpened(id, source);
    router.push(`/item/${source}`);
  };

  if (query.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Spinner className="mt-12" size="large" />
      </SafeAreaView>
    );
  }
  if (query.error || !query.data) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
        <Text className="text-base text-danger mb-4">
          {query.error?.message === "DIGEST_NOT_FOUND"
            ? "Report no longer available"
            : "Could not load your report. Check your connection and try again."}
        </Text>
        <Button
          title="Retry"
          variant="secondary"
          onPress={() => {
            void query.refetch();
          }}
        />
        <Button
          title="Back"
          variant="secondary"
          onPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const digest = query.data;
  const highlightAction = (blockId: string, sourceIds: string[], selectedText: string) => (
    <View className="flex-row items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask about this"
        accessibilityHint="Starts a chat draft scoped to this highlight's sources"
        accessibilityState={{ disabled: !chat.ready }}
        disabled={!chat.ready}
        onPress={() => {
          chat.startDigest(digest.id, sourceIds, selectedText);
          router.push("/chat");
        }}
        style={({ pressed }) => [pressed && chat.ready && { opacity: 0.82 }]}
        className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 ${!chat.ready ? "opacity-50" : ""}`}
      >
        <AppIcon name="message-circle" size={17} />
        <Text className="text-sm font-semibold text-fg">Ask about this</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not interested"
        accessibilityHint="Hides this highlight. You can undo this later."
        onPress={() => {
          void feedback(blockId, "not_interested");
        }}
        style={({ pressed }) => [pressed && { opacity: 0.72 }]}
        className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
      >
        <AppIcon name="eye-off" size={18} />
      </Pressable>
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to digests"
          className="min-h-11 justify-center"
          onPress={() => router.back()}
        >
          <Text className="text-accent text-base">← Back</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}
      >
        <View className="gap-1">
          <Text className="text-xs uppercase text-muted">
            {digest.cadence || "digest"} · {relativeDate(digest.generated_at)}
            {digest.content.timezone ? ` · ${digest.content.timezone}` : ""}
          </Text>
          <Text
            className="text-3xl text-fg"
            style={{
              fontFamily: "InstrumentSerif_400Regular",
              letterSpacing: -0.5,
            }}
          >
            {digest.status === "source_removed"
              ? "Report unavailable"
              : digest.content.title || "Your digest"}
          </Text>
          {digest.content.window_start && (
            <Text className="text-sm text-muted">
              {new Date(digest.content.window_start).toLocaleDateString(
                undefined,
                { timeZone: digest.content.timezone },
              )}{" "}
              —{" "}
              {new Date(digest.content.window_end).toLocaleDateString(
                undefined,
                { timeZone: digest.content.timezone },
              )}
            </Text>
          )}
          <Text className="text-sm text-muted">
            {digest.items_count} {digest.items_count === 1 ? "item" : "items"}{" "}
            in the period
          </Text>
        </View>
        {digest.content.tldr && (
          <View className="rounded-2xl border border-border bg-surface p-5 gap-3">
            <Text className="text-lg font-semibold text-fg">TL;DR</Text>
            {digest.content.tldr.bullets.map((b) => (
              <View key={b.id}>
                <Text className="text-base leading-6 text-fg">{b.text}</Text>
                {b.source_item_ids.map((source) => (
                  <Pressable
                    key={source}
                    accessibilityRole="button"
                    onPress={() => open(source)}
                    className="min-h-11 justify-center"
                  >
                    <Text className="text-accent">Open source</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        )}
        {digest.status === "source_removed" ? (
          <Text className="text-fg">
            Report no longer available after a source was removed.
          </Text>
        ) : (
          <>
            {(["ideas", "themes", "highlights", "connections"] as const).map(
              (section) => {
                const blocks = digest.content[section] || [];
                if (blocks.length === 0) return null;
                return (
                <View key={section} className="gap-4">
                  <Text
                    className="text-2xl capitalize text-fg"
                    style={{ fontFamily: "InstrumentSerif_400Regular" }}
                  >
                    {section}
                  </Text>
                  {blocks.map((block) => {
                    const hidden = digest.feedback?.some(
                      (f) =>
                        f.target === block.id && f.value === "not_interested",
                    );
                    return hidden ? (
                      <Button
                        key={block.id}
                        title="Highlight hidden · Undo"
                        variant="secondary"
                        onPress={() => {
                          void feedback(block.id, null);
                        }}
                      />
                    ) : (
                      <View key={block.id} className="gap-2">
                        <SectionCard
                          section={{
                            category: section,
                            summary: block.text,
                            image_urls: [],
                            item_ids: block.source_item_ids,
                          }}
                          open={open}
                        />
                        {section === "highlights" ? (
                          highlightAction(block.id, block.source_item_ids, block.text)
                        ) : (
                          <Button
                            title="Ask about this"
                            variant="secondary"
                            disabled={!chat.ready}
                            onPress={() => {
                              chat.startDigest(digest.id, block.source_item_ids, block.text);
                              router.push("/chat");
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
                );
              },
            )}
            {digest.content.selection && (
              <Text className="text-sm text-muted">
                {digest.content.selection.selected} selected from{" "}
                {digest.content.selection.total} items in the period.
                {digest.content.selection.pending > 0
                  ? " Some saves are still processing and may appear in a later digest."
                  : ""}
                {digest.content.selection.carryover_item_ids.length > 0
                  ? " Includes earlier saves that are ready now."
                  : ""}
              </Text>
            )}
            {digest.content.quality_mode === "fallback" && (
              <Text className="text-muted">
                A selection based on your saved summaries and metadata.
              </Text>
            )}
            <Button
              title="Ask about this digest"
              disabled={!chat.ready}
              onPress={() => {
                chat.startDigest(digest.id);
                router.push("/chat");
              }}
            />
            <Text className="text-sm text-muted">
              Chat uses this report’s sources. Edit your question before
              sending.
            </Text>
            <View className="gap-1">
              <Text className="text-2xl text-fg" style={{ fontFamily: "InstrumentSerif_400Regular" }}>
                Sources
              </Text>
              <Text className="text-sm text-muted">
                Open a saved item or visit its original link.
              </Text>
            </View>
            {digest.sources?.map((source) => {
              const url = source.source_url || source.raw_url;
              return (
                <SourceRow
                  key={source.id}
                  title={source.title}
                  url={url}
                  onOpenItem={() => open(source.id)}
                  onOpenOriginal={url && /^https?:\/\//i.test(url) ? () => { void Linking.openURL(url); } : undefined}
                />
              );
            })}
            <View className="flex-row gap-2">
              <Button title="Useful" variant="secondary" className="flex-1" onPress={() => { void feedback("digest", "useful"); }} />
              <Button title="Not useful" variant="secondary" className="flex-1" onPress={() => { void feedback("digest", "not_useful"); }} />
            </View>
            <Text accessibilityLiveRegion="polite" className="text-fg">
              {notice}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SectionCard: React.FC<{
  section: DigestSection;
  open: (id: string) => void;
}> = ({ section, open }) => (
  <View className="rounded-2xl border border-border bg-card p-4 gap-3">
    <Text
      className="text-xl text-fg"
      style={{ fontFamily: "InstrumentSerif_400Regular", letterSpacing: -0.3 }}
    >
      {section.category}
    </Text>
    <Text className="text-base text-fg leading-6">{section.summary}</Text>
    {section.image_urls.length > 0 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {section.image_urls.map((url, i) => (
          <Image
            key={`${url}-${i}`}
            source={{ uri: url }}
            style={{ width: 88, height: 88, borderRadius: 8 }}
            contentFit="cover"
          />
        ))}
      </ScrollView>
    ) : null}
    {section.item_ids.length > 0 ? (
      <View className="flex-row flex-wrap gap-2 pt-1">
        {section.item_ids.map((id) => (
          <Pressable
            key={id}
            onPress={() => open(id)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            className="px-3 py-1.5 rounded-full bg-surface border border-border"
          >
            <Text className="text-xs text-fg">Open item</Text>
          </Pressable>
        ))}
      </View>
    ) : null}
  </View>
);

type SourceRowProps = {
  title?: string;
  url?: string;
  onOpenItem: () => void;
  onOpenOriginal?: () => void;
};

const SourceRow: React.FC<SourceRowProps> = ({ title, url, onOpenItem, onOpenOriginal }) => {
  const colors = useResolvedColors();
  const [faviconFailed, setFaviconFailed] = useState(false);
  const host = url ? hostOf(url) : null;
  const favicon = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <View className="h-12 w-12 overflow-hidden rounded-xl bg-surface items-center justify-center">
        {favicon && !faviconFailed ? (
          <Image
            source={{ uri: favicon }}
            style={{ width: 30, height: 30 }}
            contentFit="contain"
            transition={150}
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <AppIcon name="file-text" size={22} />
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open saved source: ${title || host || "source"}`}
        accessibilityHint="Opens this item in Flowy"
        className="min-h-11 flex-1 justify-center"
        onPress={onOpenItem}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        <Text className="text-base font-semibold text-fg" numberOfLines={2}>
          {title || host || "Saved source"}
        </Text>
        {host && <Text className="mt-0.5 text-sm text-muted" numberOfLines={1}>{host}</Text>}
      </Pressable>
      {onOpenOriginal && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open original source: ${title || host || "source"}`}
          accessibilityHint="Opens the original link in your browser"
          className="h-11 w-11 items-center justify-center rounded-xl bg-surface"
          onPress={onOpenOriginal}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Feather name="external-link" size={18} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );
};
