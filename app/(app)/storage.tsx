import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StorageUsage } from '@/components/settings/StorageUsage';
import { StorageAction } from '@/components/settings/StorageAction';
import { useAuth } from '@/lib/auth';
import { ENV } from '@/lib/env';
import { useI18n } from '@/lib/i18n';

export default function StorageScreen() {
  const router = useRouter(),
    { user } = useAuth();
  const { t } = useI18n();
  const [limits, setLimits] = useState(false),
    [billingError, setBillingError] = useState(false);
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="flex-row flex-wrap items-center justify-between px-2">
        <StorageAction
          title={t('settings.storage.back')}
          icon="chevron-left"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/settings')
          }
        />
        <StorageAction
          title={t('settings.storage.billing')}
          icon="arrow-up-right"
          tone="action"
          onPress={() =>
            void Linking.openURL(`${ENV.API_BASE_URL}/settings/billing`).catch(
              () => setBillingError(true),
            )
          }
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          padding: 20,
          paddingTop: 12,
          paddingBottom: 40,
        }}
      >
        <Text
          accessibilityRole="header"
          className="text-4xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular' }}
        >
          {t('settings.storage.title')}
        </Text>
        <Text className="mt-2 mb-3 font-sans text-sm leading-5 text-muted">
          {t('settings.storage.intro')}
        </Text>
        {billingError ? (
          <Text
            accessibilityRole="alert"
            className="mb-3 font-sans text-sm text-muted"
          >
            {t('settings.storage.billingFailed')}
          </Text>
        ) : null}
        <StorageUsage key={user?.id} />
        <View className="mt-6 border-t border-border pt-3">
          <View className="-ml-3 items-start">
            <StorageAction
              title={t('settings.storage.uploadLimits')}
              icon={limits ? 'chevron-up' : 'chevron-down'}
              expanded={limits}
              onPress={() => setLimits((v) => !v)}
            />
          </View>
          {limits ? (
            <Text className="mt-1 font-sans text-sm leading-6 text-muted">
              {t('settings.storage.uploadLimitsBody')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
