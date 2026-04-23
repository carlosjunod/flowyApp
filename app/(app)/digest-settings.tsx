import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useResolvedColors } from '@/lib/theme';
import type { DigestSettings } from '@/types';

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function DigestSettingsScreen() {
  const qc = useQueryClient();
  const colors = useResolvedColors();
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('08:00');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const query = useQuery<DigestSettings, Error>({
    queryKey: ['digestSettings'],
    queryFn: async () => {
      const res = await api.getDigestSettings();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  useEffect(() => {
    if (query.data) {
      setEnabled(query.data.digest_enabled);
      setTime(query.data.digest_time);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: async (patch: Partial<DigestSettings>) => {
      const res = await api.patchDigestSettings(patch);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['digestSettings'], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Save failed'),
  });

  const onSave = () => {
    setError(null);
    if (!HHMM_RE.test(time)) {
      setError('Time must be in HH:MM (24-hour) format, e.g. 08:00');
      return;
    }
    mutation.mutate({ digest_enabled: enabled, digest_time: time });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-accent text-base">← Back</Text>
          </Pressable>
        </View>
        <View className="px-4 pb-4">
          <Text
            className="text-3xl text-fg"
            style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
          >
            Daily digest
          </Text>
          <Text className="text-sm text-muted mt-1">
            Get a daily summary of what you saved, delivered as a push notification.
          </Text>
        </View>

        {query.isLoading ? (
          <Spinner className="mt-12" size="large" />
        ) : (
          <View className="px-4 gap-4">
            <View className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-base text-fg font-semibold">Enable daily digest</Text>
                <Text className="text-xs text-muted mt-1">
                  Generates a recap of items from the past 24h.
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            <View className="rounded-xl border border-border bg-card px-4 py-3">
              <Text className="text-base text-fg font-semibold mb-2">Time (24h, UTC)</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="08:00"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                editable={enabled}
                className="h-11 rounded-lg border border-border bg-bg px-3 text-fg"
                style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
              />
              <Text className="text-xs text-muted mt-2">
                Times are in UTC. Convert from your local timezone manually for now.
              </Text>
            </View>

            {error ? <Text className="text-danger text-sm px-1">{error}</Text> : null}
            {saved ? <Text className="text-success text-sm px-1">Saved</Text> : null}

            <Button
              title="Save"
              loading={mutation.isPending}
              onPress={onSave}
              className="mt-2"
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
