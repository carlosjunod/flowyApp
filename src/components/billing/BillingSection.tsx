import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { useSubscription } from '@/hooks/useSubscription';
import { useResolvedColors } from '@/lib/theme';

// Where Apple sends users to manage or cancel an App Store subscription.
// Guideline 3.1.3 permits (and review expects) this; it is not steering,
// because it manages an existing purchase rather than offering another way
// to buy.
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  plus: 'Plus',
  pro: 'Pro',
};

export const BillingSection: React.FC = () => {
  const colors = useResolvedColors();
  const { data, isPending, isError } = useSubscription();

  if (isPending) {
    return <Row label="Plan" value="…" />;
  }

  if (isError || !data) {
    return <Row label="Plan" value="Unavailable" />;
  }

  const planLabel = PLAN_LABELS[data.plan] ?? data.plan;

  // Free: the only state that offers a purchase.
  if (!data.isPaid) {
    return (
      <Pressable
        onPress={() => router.push('/paywall')}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center justify-between"
      >
        <View className="flex-1">
          <Text className="text-base text-fg">Free plan</Text>
          <Text className="text-xs text-muted mt-1">Upgrade for more saves, AI actions and deep dives.</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    );
  }

  // Billed through the App Store: send them to Apple to manage it.
  if (data.source === 'apple') {
    return (
      <Pressable
        onPress={() => {
          void Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
        }}
        accessibilityRole="link"
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        className="rounded-xl border border-border bg-card px-4 py-3 flex-row items-center justify-between"
      >
        <View className="flex-1">
          <Text className="text-base text-fg">{planLabel}</Text>
          <Text className="text-xs text-muted mt-1">
            Billed through the App Store{renewalSuffix(data.currentPeriodEnd, data.cancelAtPeriodEnd)}
          </Text>
        </View>
        <Feather name="external-link" size={16} color={colors.muted} />
      </Pressable>
    );
  }

  // Billed on the web (Stripe), or a server that does not report `source` yet.
  // Either way: no purchase CTA. Offering in-app purchase to someone who
  // already pays elsewhere would double-charge them.
  return (
    <View className="rounded-xl border border-border bg-card px-4 py-3">
      <Text className="text-base text-fg">{planLabel}</Text>
      <Text className="text-xs text-muted mt-1">
        {data.source === 'stripe' ? 'Billed on the web' : 'Active subscription'}
        {renewalSuffix(data.currentPeriodEnd, data.cancelAtPeriodEnd)}
      </Text>
    </View>
  );
};

const renewalSuffix = (currentPeriodEnd: string | null, cancelAtPeriodEnd: boolean): string => {
  if (!currentPeriodEnd) return '';
  const d = new Date(currentPeriodEnd);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return cancelAtPeriodEnd ? ` · ends ${date}` : ` · renews ${date}`;
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
    <Text className="text-sm text-fg">{label}</Text>
    <Text className="text-sm text-muted">{value}</Text>
  </View>
);
