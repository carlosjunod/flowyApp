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
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import { PlanCard } from '@/components/billing/PlanCard';
import { Spinner } from '@/components/ui/Spinner';
import { matchesTarget, useRefreshSubscription, useSubscription } from '@/hooks/useSubscription';
import { isCurrentProduct } from '@/lib/entitlement';
import { useAuth } from '@/lib/auth';
import {
  beginTransaction,
  endTransaction,
  isTransactionInFlight,
  subscribeTransaction,
} from '@/lib/billingCoordinator';
import { PAYWALL_PLANS, productId } from '@/lib/plans';
import {
  getOfferingPackages,
  isUserCancelled,
  purchaseAs,
  PurchaserIdentityError,
  restoreAs,
} from '@/lib/purchases';
import { useResolvedColors } from '@/lib/theme';
import type { BillingInterval, PaidPlanId } from '@/types';

const INTERVALS: readonly { value: BillingInterval; label: string }[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

export default function PaywallScreen() {
  const colors = useResolvedColors();
  const { user } = useAuth();
  const subscription = useSubscription();
  const refreshSubscription = useRefreshSubscription();

  const [interval, setInterval] = useState<BillingInterval>('year');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PaidPlanId | null>(null);
  const [restoring, setRestoring] = useState(false);

  // The lock is module-scoped, not component-local: the user can close the
  // paywall mid-transaction, and a reopened screen must not be able to start a
  // second one. It also flips synchronously, which `busy`/`restoring` do not —
  // those are state, so a guard reading them sees the previous render and two
  // quick taps would both pass. They only drive what the UI shows.
  const locked = useSyncExternalStore(
    subscribeTransaction,
    isTransactionInFlight,
    isTransactionInFlight,
  );

  // A transaction outlives its screen. Navigating or alerting after unmount
  // would pop whatever the user opened next.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
      if (!pkg) return;
      const userId = user?.id;
      if (!userId) {
        Alert.alert('Not signed in', 'Sign in again to subscribe.');
        return;
      }
      if (!beginTransaction()) return;
      setBusy(plan);
      try {
        // Fail closed: the identity check and the charge happen in one queued
        // section inside purchaseAs, so no sign-out or account switch can slip
        // between them. A purchase made under an anonymous id is charged by
        // Apple and grants nobody.
        await purchaseAs(userId, pkg);

        // The webhook grants the plan server-side; ask the server rather than
        // trusting the local receipt. Wait for THIS plan and interval, not just
        // any paid state — an upgrading subscriber is already paid, so a
        // generic isPaid check would report success before the new transaction
        // was applied.
        const target = { expectedPlan: plan, expectedInterval: interval };
        const { view, aborted } = await refreshSubscription(target);
        // Signed out mid-poll, or the screen is gone: say nothing.
        if (aborted || !mounted.current) return;
        if (matchesTarget(view, target)) {
          router.back();
        } else {
          Alert.alert(
            'Almost there',
            'Your purchase went through. It can take a moment to activate — check Settings again shortly.',
          );
        }
      } catch (err) {
        if (!mounted.current) {
          console.warn('[paywall] purchase failed after unmount:', err);
        } else if (err instanceof PurchaserIdentityError) {
          Alert.alert(
            'Could not confirm your account',
            'We could not verify your account with the App Store. Nothing was charged — please try again in a moment.',
          );
        } else if (!isUserCancelled(err)) {
          console.warn('[paywall] purchase failed:', err);
          Alert.alert('Purchase failed', 'Nothing was charged. Please try again.');
        }
      } finally {
        endTransaction();
        setBusy(null);
      }
    },
    [interval, packageFor, refreshSubscription, user?.id],
  );

  // Required by App Store review: an app selling a subscription without a
  // visible restore control gets rejected.
  const onRestore = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      Alert.alert('Not signed in', 'Sign in again to restore your purchases.');
      return;
    }
    if (!beginTransaction()) return;
    setRestoring(true);
    try {
      await restoreAs(userId);
      const { view, aborted } = await refreshSubscription({ waitForPaid: true });
      if (aborted || !mounted.current) return;
      if (view?.isPaid) {
        Alert.alert('Restored', `Your ${view.plan} plan is active.`);
        router.back();
      } else {
        Alert.alert('Nothing to restore', 'No previous purchase was found for this Apple ID.');
      }
    } catch (err) {
      if (!mounted.current) {
        console.warn('[paywall] restore failed after unmount:', err);
      } else if (err instanceof PurchaserIdentityError) {
        Alert.alert(
          'Could not confirm your account',
          'We could not verify your account with the App Store. Please try again in a moment.',
        );
      } else {
        console.warn('[paywall] restore failed:', err);
        Alert.alert('Restore failed', 'Please try again.');
      }
    } finally {
      endTransaction();
      setRestoring(false);
    }
  }, [refreshSubscription, user?.id]);

  // Compared on plan AND interval: a monthly subscriber must still be able to
  // move to yearly, which is a different product.
  const isCurrent = (planId: PaidPlanId): boolean =>
    isCurrentProduct(subscription.data, planId, interval);
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
        {/* Dismissal is blocked for the whole transaction: leaving mid-flight
            is what lets a second, unlocked paywall be opened over it. */}
        <Pressable
          onPress={() => router.back()}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityState={{ disabled: locked }}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.7 }, locked && { opacity: 0.3 }]}
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
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: locked }}
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
                pkg={packageFor(plan.id)}
                busy={busy === plan.id}
                locked={locked}
                current={isCurrent(plan.id)}
                onPress={() => void onSubscribe(plan.id)}
              />
            ))
          )}

          <Pressable
            onPress={() => void onRestore()}
            disabled={locked}
            accessibilityRole="button"
            accessibilityState={{ disabled: locked }}
            style={({ pressed }) => [pressed && { opacity: 0.7 }, locked && { opacity: 0.5 }]}
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
