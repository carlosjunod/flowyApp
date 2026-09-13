import { AppIcon } from '@/components/ui/AppIcon';
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeDate } from "@/lib/relativeDate";
import { nextDigestCadence } from "@/lib/digestSettings";
import type { Digest, DigestCadence } from "@/types";

export default function DigestListScreen() {
  const { user } = useAuth();
  const [cadence, setCadence] = useState<DigestCadence | undefined>(),
    [read, setRead] = useState<"read" | "new" | undefined>();
  const query = useInfiniteQuery({
    queryKey: ["digests", user?.id, cadence, read],
    enabled: !!user?.id,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.listDigestPage(pageParam, {
        ...(cadence ? { cadence } : {}),
        ...(read ? { read } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor,
  });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-accent text-base">← Back</Text>
        </Pressable>
        <Link href="/digest-settings" asChild>
          <Pressable hitSlop={8}>
            <Text className="text-accent text-base">Settings</Text>
          </Pressable>
        </Link>
      </View>
      <View className="px-4 pb-3">
        <Text
          className="text-3xl text-fg"
          style={{
            fontFamily: "InstrumentSerif_400Regular",
            letterSpacing: -0.5,
          }}
        >
          Digests
        </Text>
        <Text className="text-sm text-muted mt-1">
          A few ideas worth keeping from what you saved.
        </Text>
      </View>

      <View className="px-4 flex-row gap-4">
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center"
          onPress={() =>
            setCadence(nextDigestCadence(cadence))
          }
        >
          <Text className="text-accent">Cadence: {cadence || "All"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center"
          onPress={() =>
            setRead(
              read === undefined ? "new" : read === "new" ? "read" : undefined,
            )
          }
        >
          <Text className="text-accent">Status: {read || "All"}</Text>
        </Pressable>
      </View>
      {query.isLoading ? (
        <Spinner className="mt-12" size="large" />
      ) : query.error ? (
        <View className="px-6 pt-12 items-center">
          <Text className="text-danger">{query.error.message}</Text>
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center"
            onPress={() => {
              void query.refetch();
            }}
          >
            <Text className="text-accent">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={query.data?.pages.flatMap((page) => page.items) ?? []}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32,
            gap: 8,
          }}
          renderItem={({ item }) => <DigestRow digest={item} />}
          ListEmptyComponent={
            <View className="items-center justify-center px-6 pt-16">
              <View className="mb-3"><AppIcon name="file-text" size={40} /></View>
              <Text className="text-base text-muted text-center">
                {cadence || read ? "No digests match these filters." : "Nothing new to recap yet. Choose your digest schedule in settings when you’re ready."}
              </Text>
            </View>
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Pressable
                accessibilityRole="button"
                disabled={query.isFetchingNextPage}
                onPress={() => {
                  void query.fetchNextPage();
                }}
                className="min-h-11 justify-center"
              >
                <Text className="text-accent">
                  {query.isFetchingNextPage ? "Loading…" : "Load more"}
                </Text>
              </Pressable>
            ) : null
          }
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
        />
      )}
    </SafeAreaView>
  );
}

const DigestRow: React.FC<{ digest: Digest }> = ({ digest }) => (
  <Link href={`/digest/${digest.id}`} asChild>
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      className="rounded-xl border border-border bg-card p-4"
    >
      <Text className="text-xs uppercase text-muted">
        {digest.cadence || "daily"} · {relativeDate(digest.generated_at)} ·{" "}
        {digest.first_opened_at ? "Read" : "New"}
      </Text>
      <Text
        className="text-lg text-fg mt-1"
        style={{ fontFamily: "InstrumentSerif_400Regular" }}
      >
        {digest.content.title || "Your digest"} · {digest.categories_count}{" "}
        {digest.categories_count === 1 ? "category" : "categories"} ·{" "}
        {digest.items_count} {digest.items_count === 1 ? "item" : "items"}
      </Text>
    </Pressable>
  </Link>
);
