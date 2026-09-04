import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useResolvedColors } from '@/lib/theme';
import type { PaywallPlan } from '@/lib/plans';
import type { BillingInterval } from '@/types';

type Props = {
  plan: PaywallPlan;
  interval: BillingInterval;
  /** False when StoreKit has no package for this plan+interval. */
  available: boolean;
  busy: boolean;
  current: boolean;
  onPress: () => void;
};

export const PlanCard: React.FC<Props> = ({
  plan,
  interval,
  available,
  busy,
  current,
  onPress,
}) => {
  const colors = useResolvedColors();
  const price = interval === 'month' ? plan.priceMonth : plan.priceYear;
  const featured = plan.badge === 'most_popular';

  const cta = current ? 'Current plan' : available ? `Choose ${plan.name}` : 'Unavailable';

  return (
    <View
      className={`rounded-2xl border bg-card px-4 py-4 gap-3 ${
        featured ? 'border-accent' : 'border-border'
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg text-fg font-semibold">{plan.name}</Text>
        {featured ? <Badge label="Most popular" tone="accent" /> : null}
      </View>

      <Text className="text-xs text-muted">{plan.tagline}</Text>

      <View className="flex-row items-baseline gap-1">
        <Text className="text-2xl text-fg font-semibold">{price}</Text>
        <Text className="text-xs text-muted">{interval === 'month' ? '/month' : '/year'}</Text>
      </View>

      <View className="gap-1.5">
        {plan.highlights.map((line) => (
          <View key={line} className="flex-row items-start gap-2">
            <Feather name="check" size={14} color={colors.accent} style={{ marginTop: 2 }} />
            <Text className="text-xs text-fg flex-1">{line}</Text>
          </View>
        ))}
      </View>

      <Button
        title={cta}
        variant={featured ? 'accent' : 'secondary'}
        loading={busy}
        disabled={!available || current}
        onPress={onPress}
        accessibilityLabel={`${cta}, ${price} per ${interval}`}
      />
    </View>
  );
};
