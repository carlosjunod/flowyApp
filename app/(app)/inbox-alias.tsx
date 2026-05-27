import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useResolvedColors } from '@/lib/theme';
import type { AliasData } from '@/types';

/**
 * Inbox email-alias screen — mirrors apps/web/app/(app)/settings/inbox/page.tsx
 * + InboxAliasForm.tsx. Self-heals: GET /api/account/alias provisions an alias
 * on first read. POST regenerates (24h cooldown, RATE_LIMITED → 429).
 */
export default function InboxAliasScreen() {
  const colors = useResolvedColors();
  const [data, setData] = useState<AliasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.getEmailAlias();
    if (res.error) {
      setError(res.error.code === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : res.error.message);
    } else {
      setData(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCopy = useCallback(async () => {
    if (!data) return;
    try {
      await Clipboard.setStringAsync(data.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard rarely fails on RN; surface silently.
    }
  }, [data]);

  const onRegenerate = useCallback(() => {
    Alert.alert(
      'Regenerate inbox email?',
      'Mail sent to the old address will stop working immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            setRegenerating(true);
            setError(null);
            const res = await api.regenerateEmailAlias();
            setRegenerating(false);
            if (res.error) {
              if (res.error.code === 'RATE_LIMITED' || res.error.status === 429) {
                setError('RATE_LIMITED');
              } else {
                setError(res.error.message ?? 'REGENERATE_FAILED');
              }
            } else {
              setData(res.data);
            }
          },
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          className="flex-row items-center gap-1.5"
        >
          <Feather name="chevron-left" size={20} color={colors.fg} />
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
          >
            Settings
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }}>
        <View className="gap-2">
          <Text
            className="text-fg"
            style={{
              fontFamily: 'InstrumentSerif_400Regular',
              fontSize: 32,
              lineHeight: 38,
              letterSpacing: -0.5,
            }}
          >
            Email to inbox
          </Text>
          <Text
            className="text-muted"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}
          >
            Forward or send any email to this address and Flowy will summarize it into your inbox.
          </Text>
        </View>

        {loading ? (
          <View className="flex-row items-center gap-2">
            <Spinner />
            <Text className="text-muted">Loading your alias…</Text>
          </View>
        ) : error && !data ? (
          <View className="rounded-xl border border-danger bg-danger/10 p-4">
            <Text className="text-danger" style={{ fontFamily: 'Inter_500Medium' }}>
              Couldn't load your alias: {error}
            </Text>
            <View className="mt-3">
              <Button title="Retry" variant="secondary" onPress={load} />
            </View>
          </View>
        ) : data ? (
          <>
            <View className="rounded-xl border border-border bg-card p-4 gap-2">
              <Text
                className="text-muted"
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 11,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Your inbox address
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <TextInput
                  value={data.email}
                  editable={false}
                  selectTextOnFocus
                  className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-fg"
                  style={{ fontFamily: 'Menlo', fontSize: 14 }}
                />
                <Pressable
                  onPress={onCopy}
                  accessibilityRole="button"
                  accessibilityLabel="Copy address"
                  hitSlop={6}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: copied ? colors.success : colors.surface,
                      borderWidth: 1,
                      borderColor: copied ? colors.success : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={copied ? 'check' : 'copy'}
                    size={14}
                    color={copied ? '#fff' : colors.fg}
                  />
                  <Text
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 13,
                      color: copied ? '#fff' : colors.fg,
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="rounded-xl border border-border bg-card overflow-hidden">
              <Pressable
                onPress={() => setHowOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: howOpen }}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  className="text-fg flex-1"
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14 }}
                >
                  How it works
                </Text>
                <Feather
                  name={howOpen ? 'chevron-down' : 'chevron-right'}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              {howOpen ? (
                <View className="px-4 pb-4 gap-2">
                  <Bullet>Forward or send any email to the address above.</Bullet>
                  <Bullet>Flowy summarizes the body and any attachments (PDFs, photos).</Bullet>
                  <Bullet>
                    Items get an <Mono>email</Mono> tag plus an automatic category.
                  </Bullet>
                  <Bullet>
                    Replies in the same thread <Strong>update the existing item</Strong> instead of
                    creating duplicates.
                  </Bullet>
                  <Bullet>Emails to an unknown address are silently ignored.</Bullet>
                </View>
              ) : null}
            </View>

            <View className="rounded-xl border border-border bg-card p-4 flex-row items-center gap-3">
              <View style={{ flex: 1 }}>
                <Text
                  className="text-fg"
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14 }}
                >
                  Regenerate
                </Text>
                <Text
                  className="text-muted"
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}
                >
                  Once a day. The old address stops working immediately.
                </Text>
              </View>
              <Button
                title={regenerating ? 'Regenerating…' : 'Regenerate'}
                variant="secondary"
                loading={regenerating}
                onPress={onRegenerate}
              />
            </View>

            {error ? (
              <Text className="text-danger px-1" style={{ fontFamily: 'Inter_500Medium' }}>
                {error === 'RATE_LIMITED'
                  ? 'You can only regenerate once per day.'
                  : `Error: ${error}`}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    <Text className="text-muted" style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}>
      •
    </Text>
    <Text
      className="text-muted flex-1"
      style={{ fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 }}
    >
      {children}
    </Text>
  </View>
);

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const colors = useResolvedColors();
  return (
    <Text
      style={{
        fontFamily: 'Menlo',
        fontSize: 11.5,
        backgroundColor: colors.surface,
        paddingHorizontal: 4,
        color: colors.fg,
      }}
    >
      {children}
    </Text>
  );
};

const Strong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{children}</Text>
);
