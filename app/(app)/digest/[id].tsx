import { useChat } from "@/hooks/useChat";
import { useQuery } from "@tanstack/react-query";
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
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeDate } from "@/lib/relativeDate";
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
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-accent text-base">← Back</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}
      >
        <View className="gap-1">
          <Text className="text-xs uppercase text-muted">
            {digest.cadence} · {relativeDate(digest.generated_at)} ·{" "}
            {digest.content.timezone}
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
              (section) => (
                <View key={section} className="gap-4">
                  {(digest.content[section] || []).map((block) => {
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
                        <Button
                          title="Ask about this"
                          variant="secondary"
                          disabled={!chat.ready}
                          onPress={() => {
                            chat.startDigest(digest.id, block.source_item_ids);
                            router.push("/chat");
                          }}
                        />
                        {section === "highlights" && (
                          <Button
                            title="Not interested"
                            variant="secondary"
                            onPress={() => {
                              void feedback(block.id, "not_interested");
                            }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              ),
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
            <Text className="text-xl text-fg">Sources</Text>
            {digest.sources?.map((source) => {
              const url = source.source_url || source.raw_url;
              return (
                <View key={source.id}>
                  <Button
                    title={source.title || "Open source"}
                    variant="secondary"
                    onPress={() => open(source.id)}
                  />
                  {url && /^https?:\/\//i.test(url) && (
                    <Pressable
                      accessibilityRole="link"
                      className="min-h-11 justify-center"
                      onPress={() => {
                        void Linking.openURL(url);
                      }}
                    >
                      <Text className="text-accent">Original source</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            <Button
              title="Useful"
              variant="secondary"
              onPress={() => {
                void feedback("digest", "useful");
              }}
            />
            <Button
              title="Not useful"
              variant="secondary"
              onPress={() => {
                void feedback("digest", "not_useful");
              }}
            />
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
