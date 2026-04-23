import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useResolvedColors, useTheme } from '@/lib/theme';

type ThemeOption = 'system' | 'light' | 'dark';

const THEME_OPTIONS: { value: ThemeOption; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const colors = useResolvedColors();
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-4 pt-2 pb-3">
        <Text
          className="text-3xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
        >
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 24 }} className="px-4">
        <Section title="Account">
          <View className="rounded-xl border border-border bg-card px-4 py-3">
            <Text className="text-xs uppercase tracking-wide text-muted">Signed in as</Text>
            <Text className="text-base text-fg mt-1">{user?.email ?? 'Unknown'}</Text>
          </View>
          <Button title="Sign out" variant="danger" onPress={signOut} />
        </Section>

        <Section title="Appearance">
          <View className="rounded-xl border border-border bg-card p-1 flex-row">
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setTheme(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className="flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-lg"
                  style={{ backgroundColor: active ? colors.surface : 'transparent' }}
                >
                  <Feather
                    name={opt.icon}
                    size={16}
                    color={active ? colors.fg : colors.muted}
                  />
                  <Text
                    className="text-sm"
                    style={{
                      color: active ? colors.fg : colors.muted,
                      fontWeight: active ? '600' : '500',
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-xs text-muted px-1">
            System follows your device's appearance setting.
          </Text>
        </Section>

        <Section title="Daily digest">
          <Link href="/digest" asChild>
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-base text-fg">Past digests</Text>
                <Text className="text-xs text-muted mt-1">Browse your daily recaps.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Link>
          <Link href="/digest-settings" asChild>
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-base text-fg">Digest settings</Text>
                <Text className="text-xs text-muted mt-1">Enable + schedule time.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </Section>

        <Section title="About">
          <Row label="Version" value={version} />
          <Row label="Build" value={Constants.expoConfig?.runtimeVersion?.toString() ?? '—'} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="gap-2">
    <Text className="text-xs uppercase tracking-wide text-muted px-1">{title}</Text>
    {children}
  </View>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
    <Text className="text-sm text-fg">{label}</Text>
    <Text className="text-sm text-muted">{value}</Text>
  </View>
);
