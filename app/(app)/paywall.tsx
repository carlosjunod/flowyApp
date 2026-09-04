// In-app purchase screen.
//
// App Store Review Guideline 3.1.3 forbids steering users to another purchase
// method outside the US storefront, so this screen must never mention the web
// price, a discount, or tryflowy.app. The prices shown here are the App Store
// prices and are higher than the web prices by design.
//
// Entitlement is NEVER granted locally: after a purchase completes we re-read
// the server's subscription view and render from that.

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { PlanCard } from '@/components/billing/PlanCard';
import { Spinner } from '@/components/ui/Spinner';
import { useRefreshSubscription, useSubscription } from '@/hooks/useSubscription';
import { PAYWALL_PLANS, productId } from '@/lib/plans';
import { getOfferingPackages, isUserCancelled, purchase, restore } from '@/lib/purchases';
import { useResolvedColors } from '@/lib/theme';
import type { BillingInterval, PaidPlanId } from '@/types';

const INTERVALS: readonly { value: BillingInterval; label: string }[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

export default function PaywallScreen() {
  const colors = useResolvedColors();
  const subscription = useSubscription();
  const refreshSubscription = useRefreshSubscription();

  const [interval, setInterval] = useState<BillingInterval>('year');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PaidPlanId | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOfferingPackages()
      .then((pkgs) => {
        if (!cancelled) setPackages(pkgs);
      })
      .catch((err) => {
        console.warn('[paywall] offerings failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const packageFor = useCallback(
    (plan: PaidPlanId): PurchasesPackage | null =>
      packages.find((p) => p.product.identifier === productId(plan, interval)) ?? null,
    [packages, interval],
  );

  const onSubscribe = useCallback(
    async (plan: PaidPlanId) => {
      const pkg = packageFor(plan);
      if (!pkg || busy) return;
      setBusy(plan);
      try {
        await purchase(pkg);
        // The webhook grants the plan server-side; ask the server rather than
        // trusting the local receipt.
        const sub = await refreshSubscription({ waitForPaid: true });
        if (sub?.isPaid) {
          router.back();
        } else {
          Alert.alert(
            'Almost there',
            'Your purchase went through. It can take a moment to activate — check Settings again shortly.',
          );
        }
      } catch (err) {
        if (!isUserCancelled(err)) {
          console.warn('[paywall] purchase failed:', err);
          Alert.alert('Purchase failed', 'Nothing was charged. Please try again.');
        }
      } finally {
        setBusy(null);
      }
    },
    [busy, packageFor, refreshSubscription],
  );

  // Required by App Store review: an app selling a subscription without a
  // visible restore control gets rejected.
  const onRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      await restore();
      const sub = await refreshSubscription({ waitForPaid: true });
      if (sub?.isPaid) {
        Alert.alert('Restored', `Your ${sub.plan} plan is active.`);
        router.back();
      } else {
        Alert.alert('Nothing to restore', 'No previous purchase was found for this Apple ID.');
      }
    } catch (err) {
      console.warn('[paywall] restore failed:', err);
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [restoring, refreshSubscription]);

  const currentPlan = subscription.data?.isPaid ? subscription.data.plan : null;
  const storeUnavailable = !loading && packages.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-4 pt-2 pb-3 flex-row items-center justify-between">
        <Text
          className="text-3xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
        >
          Upgrade Flowy
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Feather name="x" size={22} color={colors.muted} />
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 16 }} className="px-4">
          <Text className="text-sm text-muted">Save more, ask more, go deeper.</Text>

          <View className="flex-row self-center rounded-full border border-border bg-card p-1">
            {INTERVALS.map((opt) => {
              const active = interval === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setInterval(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className="px-5 py-2 rounded-full"
                  style={{ backgroundColor: active ? colors.accent : 'transparent' }}
                >
                  <Text
                    className="text-sm"
                    style={{
                      color: active ? '#FFFFFF' : colors.muted,
                      fontWeight: active ? '600' : '500',
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {storeUnavailable ? (
            <View className="rounded-xl border border-border bg-card px-4 py-4">
              <Text className="text-sm text-fg">Plans are unavailable right now.</Text>
              <Text className="text-xs text-muted mt-1">
                We could not reach the App Store. Check your connection and try again.
              </Text>
            </View>
          ) : (
            PAYWALL_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                interval={interval}
                available={packageFor(plan.id) !== null}
                busy={busy === plan.id}
                current={currentPlan === plan.id}
                onPress={() => void onSubscribe(plan.id)}
              />
            ))
          )}

          <Pressable
            onPress={() => void onRestore()}
            disabled={restoring}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && { opacity: 0.7 }, restoring && { opacity: 0.5 }]}
            className="py-3 items-center"
          >
            <Text className="text-sm text-accent font-semibold">
              {restoring ? 'Restoring…' : 'Restore Purchases'}
            </Text>
          </Pressable>

          <Text className="text-xs text-muted text-center">
            Subscriptions renew automatically until cancelled. Manage or cancel any time in your
            Apple ID settings.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
