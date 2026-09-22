import { AppIcon } from '@/components/ui/AppIcon';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { thumbnailFor } from '@/lib/thumbnails';
import { formatCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { Item, ReceiptData, ReceiptItem } from '@/types';

/** Amounts follow the interface locale for grouping; the symbol is the account's. */
function useMoney(): (amount: number) => string {
  const { locale } = useI18n();
  return (amount: number) => formatCurrency(amount, locale);
}

/**
 * Receipt detail renderer. Reads the structured payload from
 * `item.structured_content` (typed as `ReceiptData` when `item.type === 'receipt'`).
 *
 * Mirrors `apps/web/components/inbox/content/ReceiptContent.tsx`. Sections —
 * all collapsible:
 *   - Store card with avatar + original photo expander
 *   - Line items table with per-row OCR confidence flags
 *   - Payment grid (collapsed by default per spec)
 *   - Category Breakdown (computed locally from items[])
 *   - Spending Insights (deterministic — derived from receipt + payment data)
 */
export const ReceiptContent: React.FC<{ item: Item }> = ({ item }) => {
  const { t } = useI18n();
  const money = useMoney();
  const data = item.structured_content as ReceiptData | undefined;
  const thumbnail = thumbnailFor(item);
  const photoUrl = data?.originalPhotoUrl ?? item.original_media_urls?.[0] ?? (thumbnail.kind === 'image' ? thumbnail.uri : undefined);

  // `structured_content` is `unknown` on the wire and this cast does not check
  // anything, so the guard has to. Checking only `store` was not enough: a
  // legacy or partially-extracted receipt that has a store but no line items
  // reaches `data.items.length` / `.map()` / <CategoryBreakdown items={...}>
  // and crashes the detail screen. Require both, and require store.name,
  // which is dereferenced unconditionally below.
  // Checking `store` alone was not enough, and neither is Array.isArray on its
  // own: `{store:{name:'x'}, items:[]}` still reaches PaymentGrid, which
  // dereferences `data.payment.provider`, and `items:[null]` still reaches
  // renderers that read `it.id` / `it.quantity`. Require every shape actually
  // dereferenced below.
  const hasStore = typeof data?.store?.name === 'string';
  const hasItems =
    Array.isArray(data?.items) &&
    data.items.every((it) => typeof it === 'object' && it !== null);
  const hasPayment = typeof data?.payment === 'object' && data.payment !== null;

  if (!data || !hasStore || !hasItems || !hasPayment) {
    return (
      <View className="rounded-xl border border-border bg-surface p-3.5">
        <Text
          className="text-muted"
          style={{ fontFamily: 'Inter_400Regular', fontSize: 12.5, fontStyle: 'italic' }}
        >
          {item.status === 'pending' || item.status === 'processing' ? t('inbox.receipt.pending') : t('inbox.receipt.failed')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 4 }}>
      {/* The store's name is printed on the receipt; it is data, not copy. */}
      <View className="flex-row items-baseline justify-between pb-4"><Text className="text-fg text-lg font-semibold flex-1">{data.store.name}</Text><Text className="text-fg text-2xl font-semibold">{money(data.total)}</Text></View>
      <StoreCard data={data} photoUrl={photoUrl} />
      <LineItemsTable data={data} />
      <PaymentGrid data={data} />
      <CategoryBreakdown items={data.items} />
      <SpendingInsights data={data} />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Store card
// ─────────────────────────────────────────────────────────────

type Gradient = readonly [string, string];

const CATEGORY_GRADIENTS = {
  groceries: ['hsl(135, 50%, 30%)', 'hsl(150, 45%, 22%)'],
  dining: ['hsl(20, 70%, 45%)', 'hsl(15, 65%, 35%)'],
  transport: ['hsl(220, 55%, 45%)', 'hsl(210, 50%, 32%)'],
  household: ['hsl(265, 35%, 45%)', 'hsl(280, 30%, 35%)'],
  health: ['hsl(180, 50%, 40%)', 'hsl(195, 45%, 30%)'],
  entertainment: ['hsl(320, 50%, 50%)', 'hsl(330, 45%, 38%)'],
  education: ['hsl(45, 60%, 45%)', 'hsl(35, 55%, 35%)'],
  other: ['hsl(215, 8%, 38%)', 'hsl(215, 8%, 25%)'],
} as const satisfies Record<string, Gradient>;

const StoreCard: React.FC<{ data: ReceiptData; photoUrl?: string }> = ({ data, photoUrl }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const initial = data.store.name.charAt(0).toUpperCase() || '?';
  const gradient = CATEGORY_GRADIENTS[data.userCategory] ?? CATEGORY_GRADIENTS.other;

  return (
    <Section title={t('inbox.receipt.store')} defaultOpen>
      <View className="flex-row items-start gap-3">
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#fff' }}>
            {initial}
          </Text>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 18 }}
          >
            {data.store.name}
          </Text>
          {data.store.address ? (
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, marginTop: 2 }}
            >
              {data.store.address}
            </Text>
          ) : null}
          {data.store.taxId || data.store.phone ? (
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 11.5, marginTop: 2, opacity: 0.8 }}
            >
              {data.store.taxId ? t('inbox.receipt.taxId', { value: data.store.taxId }) : ''}
              {data.store.taxId && data.store.phone ? ' · ' : ''}
              {data.store.phone ? t('inbox.receipt.phone', { value: data.store.phone }) : ''}
            </Text>
          ) : null}
        </View>
        {photoUrl ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={open ? t('inbox.receipt.collapsePhoto') : t('inbox.receipt.viewPhoto')}
            className="border border-border bg-surface rounded-md"
            style={[
              {
                width: 48,
                height: 64,
                alignItems: 'center',
                justifyContent: 'center',

              },
            ]}
          >
            <Feather name="image" size={14} color="#888" />
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 8, letterSpacing: 0.5, marginTop: 4 }}
            >
              {t('inbox.receipt.photo')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open && photoUrl ? (
        <View className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
          <Image
            source={{ uri: photoUrl }}
            style={{ width: '100%', height: 360 }}
            contentFit="contain"
          />
        </View>
      ) : null}
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────
// Line items
// ─────────────────────────────────────────────────────────────

const ConfidenceFlag: React.FC<{ value: number }> = ({ value }) => {
  if (value >= 0.95) return null;
  const color = value >= 0.85 ? '#B45309' : '#B91C1C';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Feather name="alert-triangle" size={10} color={color} />
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color }}>
        {Math.round(value * 100)}%
      </Text>
    </View>
  );
};

const LineItemsTable: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const { t, formatNumber } = useI18n();
  const money = useMoney();
  const colors = useResolvedColors();
  return (
    <Section title={t('inbox.receipt.items')} badge={formatNumber(data.items.length)} defaultOpen>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* Rows */}
        {data.items.map((it) => (
          <ReceiptItemRow key={it.id} item={it} />
        ))}
        {/* Totals */}
        <View style={{ borderTopWidth: 2, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TotalsRow label={t('inbox.receipt.subtotal')} amount={money(data.subtotal)} muted />
          {data.discountAmount && data.discountAmount > 0 ? (
            // A named promotion is printed on the receipt; only the generic
            // "Discount" fallback is interface copy.
            <TotalsRow
              label={data.discountLabel ?? t('inbox.receipt.discount')}
              amount={`-${money(data.discountAmount)}`}
              variant="discount"
            />
          ) : null}
          {data.taxAmount > 0 ? (
            <TotalsRow label={t('inbox.receipt.tax')} amount={money(data.taxAmount)} muted />
          ) : null}
          {data.tipAmount && data.tipAmount > 0 ? (
            <TotalsRow label={t('inbox.receipt.tip')} amount={money(data.tipAmount)} muted />
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text
              className="text-fg"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, flex: 1 }}
            >
              {t('inbox.receipt.total')}
            </Text>
            <Text
              className="text-fg"
              style={{
                fontFamily: 'Menlo',
                fontSize: 15,
                fontWeight: '700',
                textAlign: 'right',
                width: 100,
              }}
            >
              {money(data.total)}
            </Text>
          </View>
        </View>
      </View>
    </Section>
  );
};

const ReceiptItemRow: React.FC<{ item: ReceiptItem }> = ({ item }) => {
  const { t, formatNumber } = useI18n();
  const money = useMoney();
  const qty = formatNumber(item.quantity, item.quantity % 1 === 0 ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <View className="px-3 py-3 border-t border-border bg-surface gap-1">
      {/* The line item's name is printed on the receipt. */}
      <View className="flex-row items-start gap-4"><Text className="text-fg flex-1 text-base">{item.name}</Text><Text className="text-fg font-semibold">{money(item.totalPrice)}</Text></View>
      <View className="flex-row items-center gap-3"><Text className="text-muted text-sm flex-1">{qty} × {money(item.unitPrice)}</Text>{item.ocrConfidence < 0.95 ? <View className="flex-row items-center gap-1"><Text className="text-muted text-xs">{t('inbox.receipt.checkOriginal')}</Text><ConfidenceFlag value={item.ocrConfidence} /></View> : null}</View>
    </View>
  );
};

const TotalsRow: React.FC<{
  label: string;
  amount: string;
  /** When true, dims the label (visual hierarchy). The amount stays at full
   * foreground contrast — numbers should always be legible. */
  muted?: boolean;
  variant?: 'discount';
}> = ({ label, amount, muted, variant }) => {
  const isDiscount = variant === 'discount';
  const tint = isDiscount ? '#059669' : undefined;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      {isDiscount ? <View style={{ marginRight: 6 }}><AppIcon name="tag" size={12} color={tint} /></View> : null}
      <Text
        className={isDiscount ? '' : muted ? 'text-muted' : 'text-fg'}
        style={{
          flex: 1,
          fontFamily: isDiscount ? 'Inter_500Medium' : 'Inter_400Regular',
          fontSize: 12.5,
          color: tint,
        }}
      >
        {label}
      </Text>
      <Text
        className={isDiscount ? '' : 'text-fg'}
        style={{
          width: 100,
          textAlign: 'right',
          fontFamily: 'Menlo',
          fontSize: 12.5,
          fontWeight: isDiscount || !muted ? '600' : '500',
          color: tint,
        }}
      >
        {amount}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Payment grid
// ─────────────────────────────────────────────────────────────

const PaymentGrid: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const { t } = useI18n();
  const money = useMoney();
  // Provider, card digits and the printed date all come from the receipt.
  const methodLabel = data.payment.provider
    ? `${data.payment.provider}${data.payment.last4 ? ` ···${data.payment.last4}` : ''}`
    : data.payment.method;
  const dateLabel = data.receiptTime
    ? `${data.receiptDate} · ${data.receiptTime}`
    : data.receiptDate;
  const cells: Array<[string, string]> = [
    [t('inbox.receipt.method'), methodLabel],
    [t('inbox.receipt.date'), dateLabel],
    [t('inbox.receipt.total'), money(data.total)],
  ];

  return (
    <Section title={t('inbox.receipt.payment')} defaultOpen={false}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {cells.map(([label, value]) => (
          <View
            key={label}
            className="border border-border bg-surface rounded-lg"
            style={{
              flexBasis: '48%',
              flexGrow: 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text
              className="text-muted"
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 10,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {label}
            </Text>
            <Text
              className="text-fg"
              style={{ fontFamily: 'Inter_500Medium', fontSize: 12.5, marginTop: 2 }}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────
// Category breakdown — computed locally
// ─────────────────────────────────────────────────────────────

interface CategoryRow {
  category: string;
  total: number;
  pct: number;
}

const buildCategoryRows = (items: ReceiptItem[]): CategoryRow[] => {
  if (items.length === 0) return [];
  const sums = new Map<string, number>();
  let grandTotal = 0;
  for (const it of items) {
    const cat = it.category ?? 'other';
    sums.set(cat, (sums.get(cat) ?? 0) + it.totalPrice);
    grandTotal += it.totalPrice;
  }
  if (grandTotal <= 0) return [];
  const rows: CategoryRow[] = [];
  for (const [category, total] of sums) {
    rows.push({ category, total, pct: Math.round((total / grandTotal) * 100) });
  }
  return rows.sort((a, b) => b.total - a.total);
};

/** Worker-assigned category codes; an unknown code falls back to itself. */
const CATEGORY_KEYS: Record<string, string> = {
  dairy: 'inbox.receipt.categories.dairy',
  produce: 'inbox.receipt.categories.produce',
  protein: 'inbox.receipt.categories.protein',
  beverages: 'inbox.receipt.categories.beverages',
  household: 'inbox.receipt.categories.household',
  pantry: 'inbox.receipt.categories.pantry',
  frozen: 'inbox.receipt.categories.frozen',
  snacks: 'inbox.receipt.categories.snacks',
  personal_care: 'inbox.receipt.categories.personal_care',
  other: 'inbox.receipt.categories.other',
};

const CategoryBreakdown: React.FC<{ items: ReceiptItem[] }> = ({ items }) => {
  const { t, tKey, formatNumber } = useI18n();
  const money = useMoney();
  const rows = useMemo(() => buildCategoryRows(items), [items]);
  if (rows.length === 0) return null;

  return (
    <Section title={t('inbox.receipt.breakdown')} sparkle defaultOpen={false}>
      <View style={{ gap: 6 }}>
        {rows.map((row, i) => {
          const key = CATEGORY_KEYS[row.category];
          const display = key ? tKey(key) : row.category;
          const hue = (20 + i * 25) % 360;
          const lightness = 45 + ((i * 3) % 20);
          return (
            <View
              key={row.category}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <Text
                className="text-muted"
                style={{
                  width: 110,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 11.5,
                }}
                numberOfLines={1}
              >
                {display}
              </Text>
              <View
                className="bg-surface"
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.max(row.pct, 1)}%`,
                    height: '100%',
                    backgroundColor: `hsl(${hue}, 65%, ${lightness}%)`,
                    borderRadius: 999,
                  }}
                />
              </View>
              <Text
                className="text-muted"
                style={{
                  width: 70,
                  textAlign: 'right',
                  fontFamily: 'Menlo',
                  fontSize: 11,
                }}
              >
                {money(row.total)}
              </Text>
              <Text
                className="text-muted"
                style={{
                  width: 32,
                  textAlign: 'right',
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 10,
                }}
              >
                {formatNumber(row.pct)}%
              </Text>
            </View>
          );
        })}
      </View>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────
// Spending insights — deterministic, derived from receipt data
// ─────────────────────────────────────────────────────────────

/** Each insight is a key plus its variables; the sentence is assembled by `t`. */
type Insight = { key: string; vars: Record<string, string | number> };

const buildInsights = (data: ReceiptData): Insight[] => {
  const insights: Insight[] = [];

  if (data.discountAmount && data.discountAmount > 0) {
    insights.push({
      key: 'inbox.receipt.insightSaved',
      // `discountLabel` is the promotion's printed name; the fallback is copy.
      vars: { amount: data.discountAmount, label: data.discountLabel ?? '' },
    });
  }

  if (data.items.length > 0) {
    insights.push({
      key: 'inbox.receipt.insightAverage',
      vars: { count: data.items.length, amount: Math.round(data.subtotal / data.items.length) },
    });
  }

  const largest = [...data.items].sort((a, b) => b.totalPrice - a.totalPrice)[0];
  if (largest && data.subtotal > 0) {
    const sharePct = Math.round((largest.totalPrice / data.subtotal) * 100);
    if (sharePct >= 25) {
      insights.push({
        key: 'inbox.receipt.insightLargest',
        vars: { name: largest.name, percent: sharePct },
      });
    }
  }

  if (data.isRecurring) {
    insights.push({
      key: 'inbox.receipt.insightRecurring',
      vars: { frequency: data.recurringFrequency ?? '', store: data.store.name },
    });
  }

  if (data.ocrOverallConfidence > 0 && data.ocrOverallConfidence < 0.85) {
    insights.push({
      key: 'inbox.receipt.insightOcr',
      vars: { percent: Math.round(data.ocrOverallConfidence * 100) },
    });
  }

  return insights;
};

const SpendingInsights: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const { t, tKey } = useI18n();
  const money = useMoney();
  const insights = useMemo(() => buildInsights(data), [data]);
  if (insights.length === 0) return null;

  return (
    <Section title={t('inbox.receipt.insights')} sparkle defaultOpen={false}>
      <View style={{ gap: 8 }}>
        {insights.map((insight, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View
              className="bg-accent/10"
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="info" size={12} />
            </View>
            <Text
              className="text-fg"
              style={{
                flex: 1,
                fontFamily: 'Inter_400Regular',
                fontSize: 12.5,
                lineHeight: 18,
                opacity: 0.85,
              }}
            >
              {tKey(insight.key, {
                ...insight.vars,
                // Money is pre-formatted so the symbol and grouping stay under
                // `formatCurrency`'s control rather than the interpolator's.
                ...(typeof insight.vars.amount === 'number'
                  ? { amount: money(insight.vars.amount) }
                  : {}),
                ...(insight.vars.label === ''
                  ? { label: t('inbox.receipt.discount').toLocaleLowerCase() }
                  : {}),
                ...(insight.vars.frequency === ''
                  ? { frequency: t('inbox.receipt.insightRecurringDefault') }
                  : {}),
              })}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────
// Section primitive — collapsible header matching the web design
// ─────────────────────────────────────────────────────────────

const Section: React.FC<{
  title: string;
  badge?: string;
  sparkle?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, badge, sparkle, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const colors = useResolvedColors();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={4}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,

          },
        ]}
      >
        <Feather
          name={open ? 'chevron-down' : 'chevron-right'}
          size={12}
          color={colors.muted}
        />
        <Text
          className="text-muted"
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10.5,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
        {sparkle ? (
          <Feather name="star" size={10} color={colors.accent} />
        ) : null}
        {badge ? (
          <View
            className="bg-accent/10"
            style={{
              marginLeft: 'auto',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text
              className="text-accent"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10 }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {open ? <View style={{ paddingTop: 4 }}>{children}</View> : null}
    </View>
  );
};
