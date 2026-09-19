import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { AliasData } from '@/types';

/**
 * Inbox email-alias screen — mirrors apps/web/app/(app)/settings/inbox/page.tsx
 * + InboxAliasForm.tsx. Self-heals: GET /api/account/alias provisions an alias
 * on first read. POST regenerates (24h cooldown, RATE_LIMITED → 429).
 */
export default function InboxAliasScreen() {
  const colors = useResolvedColors();
  const { t } = useI18n();
  const [data, setData] = useState<AliasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  // `rateLimited` is the one failure with a known code and therefore its own
  // sentence; anything else surfaces the server's message verbatim, because
  // there is no code to map it to.
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  // Every state write here follows an await, and this screen is a pushed
  // route the user can leave at any moment. Without these guards, navigating
  // away mid-request — or within the 1.5s copy-feedback window — updates an
  // unmounted component and leaks the timer.
  const mountedRef = useRef(true);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRateLimited(false);
    const res = await api.getEmailAlias();
    if (!mountedRef.current) return;
    if (res.error) {
      setError(res.error.message);
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
      if (!mountedRef.current) return;
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 1500);
    } catch {
      // Clipboard rarely fails on RN; surface silently.
    }
  }, [data]);

  const onRegenerate = useCallback(() => {
    Alert.alert(
      t('settings.alias.regenerateTitle'),
      t('settings.alias.regenerateBody'),
      [
        { text: t('settings.alias.cancel'), style: 'cancel' },
        {
          text: t('settings.alias.regenerate'),
          style: 'destructive',
          onPress: async () => {
            setRegenerating(true);
            setError(null);
            setRateLimited(false);
            const res = await api.regenerateEmailAlias();
            if (!mountedRef.current) return;
            setRegenerating(false);
            if (res.error) {
              if (res.error.code === 'RATE_LIMITED' || res.error.status === 429) {
                setRateLimited(true);
              } else {
                setError(res.error.message ?? '');
              }
            } else {
              setData(res.data);
            }
          },
        },
      ],
    );
  }, [t]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('settings.alias.back')}
          className="flex-row items-center gap-1.5"
        >
          <Feather name="chevron-left" size={20} color={colors.fg} />
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
          >
            {t('settings.alias.back')}
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
            {t('settings.alias.title')}
          </Text>
          <Text
            className="text-muted"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}
          >
            {t('settings.alias.intro')}
          </Text>
        </View>

        {loading ? (
          <View className="flex-row items-center gap-2">
            <Spinner />
            <Text className="text-muted">{t('settings.alias.loading')}</Text>
          </View>
        ) : error && !data ? (
          <View className="rounded-xl border border-danger bg-danger/10 p-4">
            <Text accessibilityRole="alert" className="text-danger" style={{ fontFamily: 'Inter_500Medium' }}>
              {t('settings.alias.loadFailed', { error })}
            </Text>
            <View className="mt-3">
              <Button title={t('settings.alias.retry')} variant="secondary" onPress={load} />
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
                {t('settings.alias.yourAddress')}
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
                  accessibilityLabel={t('settings.alias.copyLabel')}
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
                    {copied ? t('settings.alias.copied') : t('settings.alias.copy')}
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
                  {t('settings.alias.howItWorks')}
                </Text>
                <Feather
                  name={howOpen ? 'chevron-down' : 'chevron-right'}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              {howOpen ? (
                <View className="px-4 pb-4 gap-2">
                  <Bullet>{t('settings.alias.how1')}</Bullet>
                  <Bullet>{t('settings.alias.how2')}</Bullet>
                  {/* `email` is the literal tag the worker writes, so it is a
                      value interpolated into the sentence, not translated. */}
                  <Bullet>{t('settings.alias.how3', { tag: 'email' })}</Bullet>
                  <Bullet>
                    {t('settings.alias.how4Before')}
                    <Strong>{t('settings.alias.how4Strong')}</Strong>
                    {t('settings.alias.how4After')}
                  </Bullet>
                  <Bullet>{t('settings.alias.how5')}</Bullet>
                </View>
              ) : null}
            </View>

            <View className="rounded-xl border border-border bg-card p-4 flex-row items-center gap-3">
              <View style={{ flex: 1 }}>
                <Text
                  className="text-fg"
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14 }}
                >
                  {t('settings.alias.regenerate')}
                </Text>
                <Text
                  className="text-muted"
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}
                >
                  {t('settings.alias.regenerateHint')}
                </Text>
              </View>
              <Button
                title={regenerating ? t('settings.alias.regenerating') : t('settings.alias.regenerate')}
                variant="secondary"
                loading={regenerating}
                onPress={onRegenerate}
              />
            </View>

            {rateLimited || error ? (
              <Text accessibilityRole="alert" className="text-danger px-1" style={{ fontFamily: 'Inter_500Medium' }}>
                {rateLimited
                  ? t('settings.alias.rateLimited')
                  : t('settings.alias.errorPrefix', { error: error ?? '' })}
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

const Strong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{children}</Text>
);
