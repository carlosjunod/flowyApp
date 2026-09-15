import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StorageUsage } from '@/components/settings/StorageUsage';
import { StorageAction } from '@/components/settings/StorageAction';
import { useAuth } from '@/lib/auth';
import { ENV } from '@/lib/env';

export default function StorageScreen() {
  const router = useRouter(),
    { user } = useAuth();
  const [limits, setLimits] = useState(false),
    [billingError, setBillingError] = useState(false);
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="flex-row flex-wrap items-center justify-between px-2">
        <StorageAction
          title="Settings"
          icon="chevron-left"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/settings')
          }
        />
        <StorageAction
          title="Plan & billing"
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
          Storage
        </Text>
        <Text className="mt-2 mb-3 font-sans text-sm leading-5 text-muted">
          Your original files, and how long you keep them.
        </Text>
        {billingError ? (
          <Text
            accessibilityRole="alert"
            className="mb-3 font-sans text-sm text-muted"
          >
            Could not open billing. Please try again.
          </Text>
        ) : null}
        <StorageUsage key={user?.id} />
        <View className="mt-6 border-t border-border pt-3">
          <View className="-ml-3 items-start">
            <StorageAction
              title="Upload limits"
              icon={limits ? 'chevron-up' : 'chevron-down'}
              expanded={limits}
              onPress={() => setLimits((v) => !v)}
            />
          </View>
          {limits ? (
            <Text className="mt-1 font-sans text-sm leading-6 text-muted">
              PDF up to 25 MB · images 5 MB · other files 50 MB. Up to 10 files
              and 100 MB per upload. Original files and saved media count toward
              your storage.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
