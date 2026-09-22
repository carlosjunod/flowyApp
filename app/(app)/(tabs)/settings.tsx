import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteAccountSection } from '@/components/settings/DeleteAccountSection';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { ENV } from '@/lib/env';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors, useTheme } from '@/lib/theme';

type ThemeOption = 'system' | 'light' | 'dark';

const THEME_OPTIONS: {
  value: ThemeOption;
  labelKey: 'common.theme.system' | 'common.theme.light' | 'common.theme.dark';
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { value: 'system', labelKey: 'common.theme.system', icon: 'monitor' },
  { value: 'light', labelKey: 'common.theme.light', icon: 'sun' },
  { value: 'dark', labelKey: 'common.theme.dark', icon: 'moon' },
];

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const colors = useResolvedColors();
  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-4 pt-2 pb-3">
        <Text
          className="text-3xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
        >
          {t('settings.index.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 24 }} className="px-4">
        <Section title={t('settings.index.sectionAccount')}>
          <View className="rounded-xl border border-border bg-card px-4 py-3">
            <Text className="text-xs uppercase tracking-wide text-muted">
              {t('settings.index.signedInAs')}
            </Text>
            {/* The address itself is account data, never translated. */}
            <Text className="text-base text-fg mt-1">
              {user?.email ?? t('settings.index.unknownAccount')}
            </Text>
          </View>
          <Button title={t('settings.index.signOut')} variant="danger" onPress={signOut} />
          <DeleteAccountSection />
        </Section>

        <Section title={t('settings.index.sectionStorage')}>
          <Link href="/storage" asChild>
            <Pressable accessibilityRole="link" className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center gap-3" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Feather name="hard-drive" size={20} color={colors.muted} />
              <View className="flex-1">
                <Text className="text-base text-fg">{t('settings.index.storageLabel')}</Text>
                <Text className="text-xs text-muted mt-1">{t('settings.index.storageDesc')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </Section>

        <Section title={t('settings.index.sectionPersonalization')}>
          <Link href="/personalization" asChild>
            <Pressable accessibilityRole="link" className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-base text-fg">{t('settings.index.personalizationLabel')}</Text>
                <Text className="text-xs text-muted mt-1">{t('settings.index.personalizationDesc')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </Section>

        <Section title={t('settings.index.sectionLanguage')}>
          <LanguageSelector />
        </Section>

        <Section title={t('settings.index.sectionAppearance')}>
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
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-xs text-muted px-1">{t('common.theme.systemHint')}</Text>
        </Section>

        <Section title={t('settings.index.sectionNotifications')}>
          <PushNotificationSettings />
        </Section>

        <Section title="Instagram">
          <Link href="/instagram" asChild>
            <Pressable accessibilityRole="link" className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center gap-3" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Feather name="instagram" size={20} color={colors.muted} />
              <View className="flex-1">
                <Text className="text-base text-fg">{t('settings.index.instagramTitle')}</Text>
                <Text className="text-xs text-muted mt-1">{t('settings.index.instagramBody')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </Section>

        <Section title={t('settings.index.sectionInbox')}>
          <Link href="/inbox-alias" asChild>
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-base text-fg">{t('settings.index.aliasLabel')}</Text>
                <Text className="text-xs text-muted mt-1">{t('settings.index.aliasDesc')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </Section>

        <Section title={t('settings.index.sectionDigest')}>
          <Link href="/digest" asChild>
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-base text-fg">{t('settings.index.pastDigestsLabel')}</Text>
                <Text className="text-xs text-muted mt-1">{t('settings.index.pastDigestsDesc')}</Text>
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
                <Text className="text-base text-fg">{t('settings.index.digestSettingsLabel')}</Text>
                <Text className="text-xs text-muted mt-1">{t('settings.index.digestSettingsDesc')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        </Section>

        <Section title={t('settings.index.sectionAbout')}>
          <Row label={t('settings.index.version')} value={version} />
          <Row label={t('settings.index.build')} value={Constants.expoConfig?.runtimeVersion?.toString() ?? '—'} />
          {/* App Store Connect requires a reachable privacy policy, and the
              terms are linked beside it so both live in one obvious place. */}
          <LegalRow label={t('settings.index.privacy')} path="/privacy" />
          <LegalRow label={t('settings.index.terms')} path="/terms" />
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

const LegalRow: React.FC<{ label: string; path: string }> = ({ label, path }) => {
  const colors = useResolvedColors();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(`${ENV.API_BASE_URL}${path}`);
      }}
      accessibilityRole="link"
      accessibilityHint={t('common.a11y.externalLink')}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
    >
      <Text className="text-sm text-fg">{label}</Text>
      <Feather name="external-link" size={16} color={colors.muted} />
    </Pressable>
  );
};
