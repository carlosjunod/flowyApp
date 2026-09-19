import React, { useState } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { recipeIngredientLabel, type SemanticContentV1 } from '@/types/semantic';

export function RecipeContent({ content }: { content: SemanticContentV1 }) {
  const [factor, setFactor] = useState(1);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { t, formatNumber } = useI18n();
  const colors = useResolvedColors();
  const servings = content.recipe?.servings;
  const ingredients = content.entries.filter(e => e.recipe?.role === 'ingredient');
  const steps = content.entries.filter(e => e.recipe?.role === 'step');
  const label = { ...styles.label, color: colors.fg };
  const hint = { ...styles.hint, color: colors.muted };
  const heading = { ...styles.heading, color: colors.fg };
  const stepControl = (name: string, symbol: string, onPress: () => void, disabled: boolean) => <Pressable accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ ...styles.stepButton, opacity: disabled ? 0.35 : 1, backgroundColor: pressed ? colors.surface : 'transparent' })}><Text style={{ fontSize: 22, color: colors.fg }}>{symbol}</Text></Pressable>;
  return <View style={styles.root}>
    <View style={{ ...styles.portions, borderColor: colors.border }}>
      <View style={styles.portionsHeading}>
        <View><Text style={label}>{t('inbox.recipe.size')}</Text><Text style={hint}>{servings ? t('inbox.recipe.originalServings', { count: servings }) : t('inbox.recipe.noServings')}</Text></View>
        <View style={{ ...styles.stepper, borderColor: colors.border }}>
          {servings ? stepControl(t('inbox.recipe.fewer'), '−', () => setFactor(Math.max(1, servings * factor - 1) / servings), servings * factor <= 1) : null}
          <Text accessibilityLiveRegion="polite" style={{ ...styles.yield, color: colors.fg }}>{servings ? t('inbox.recipe.servings', { count: Number((servings * factor).toFixed(2)) }) : t('inbox.recipe.multiplier', { count: factor })}</Text>
          {servings ? stepControl(t('inbox.recipe.more'), '+', () => setFactor(Math.min(100, factor + 1 / servings)), factor >= 100) : null}
        </View>
      </View>
      <View style={{ ...styles.presets, backgroundColor: colors.surface }}>
        {[0.5, 1, 2, 3].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n}×`} accessibilityState={{ selected: factor === n }} onPress={() => setFactor(n)}
          style={({ pressed }) => ({ ...styles.preset, backgroundColor: pressed ? colors.border : factor === n ? colors.bg : 'transparent', borderColor: factor === n ? colors.border : 'transparent' })}>
          <Text style={{ fontSize: 14, fontWeight: factor === n ? '600' : '500', color: factor === n ? colors.accent : colors.fg }}>{n === 0.5 ? '½' : n}×</Text>
        </Pressable>)}
      </View>
      <Text style={hint}>{servings ? t('inbox.recipe.scaledHint') : t('inbox.recipe.multiplierHint')}{t('inbox.recipe.unchangedHint')}</Text>
    </View>

    <View>
      <View style={styles.sectionHeading}><Text accessibilityRole="header" style={heading}>{t('inbox.recipe.ingredients')}</Text>{ingredients.length ? <Text style={hint}>{formatNumber(ingredients.length)}</Text> : null}</View>
      {!ingredients.length ? <Text style={hint}>{t('inbox.recipe.noIngredients')}</Text> : <>
        {ingredients.map((entry, index) => {
          const quantity = recipeIngredientLabel(entry, factor).slice(0, -entry.name.length).trim();
          return <View key={entry.id} style={{ ...styles.ingredient, paddingTop: index === 0 ? 0 : 14, borderColor: colors.border }}>
            <View style={{ flex: 1, minWidth: 0 }}><Text selectable style={{ ...styles.body, color: colors.fg }}>{entry.name}</Text>{!entry.recipe?.amount ? <Text selectable style={hint}>{entry.description || t('inbox.recipe.noQuantity')}</Text> : null}</View>
            {quantity ? <Text selectable style={{ ...styles.quantity, color: colors.fg }}>{quantity}</Text> : null}
          </View>;
        })}
        <Pressable accessibilityRole="button" accessibilityLabel={t('inbox.recipe.originalQuantities')} accessibilityState={{ expanded: evidenceOpen }} onPress={() => setEvidenceOpen(v => !v)} style={({ pressed }) => ({ ...styles.evidenceToggle, backgroundColor: pressed ? colors.surface : 'transparent' })}>
          <Text style={hint}>{t('inbox.recipe.originalQuantities')}</Text><Text accessibilityElementsHidden importantForAccessibility="no" style={{ color: colors.muted, fontSize: 18 }}>{evidenceOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {evidenceOpen ? <View><Text style={hint}>{t('inbox.recipe.originalQuantitiesHint')}</Text>{ingredients.map(entry => <View key={entry.id} style={{ paddingVertical: 12 }}><Text style={label}>{entry.name}</Text>{entry.evidence.map((proof, i) => <Text selectable key={i} style={{ ...hint, marginTop: 4 }}>{proof.quote}</Text>)}</View>)}</View> : null}
      </>}
    </View>

    <View>
      <View style={styles.sectionHeading}><Text accessibilityRole="header" style={heading}>{t('inbox.recipe.preparation')}</Text>{steps.length ? <Text style={hint}>{t('inbox.recipe.stepCount', { count: steps.length })}</Text> : null}</View>
      {!steps.length ? <Text style={hint}>{t('inbox.recipe.noSteps')}</Text> : <View style={{ gap: 28 }}>{steps.map((entry, i) => <View key={entry.id} style={styles.step}>
        <Text style={{ ...styles.stepNumber, color: colors.muted }}>{String(i + 1).padStart(2, '0')}</Text>
        <View style={{ flex: 1, minWidth: 0 }}><Text selectable style={{ ...styles.body, fontWeight: '600', marginBottom: 6, color: colors.fg }}>{entry.name}</Text><Text selectable style={{ ...styles.body, color: colors.fg }}>{entry.description || entry.evidence[0]?.quote}</Text></View>
      </View>)}</View>}
    </View>
  </View>;
}

const styles = {
  root: { minWidth: 0, maxWidth: '100%', paddingTop: 8, gap: 32 },
  portions: { gap: 14, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1 },
  portionsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 22 },
  hint: { fontSize: 13, lineHeight: 20, flexShrink: 1 },
  body: { fontSize: 16, lineHeight: 26 },
  heading: { fontSize: 20, fontWeight: '600', lineHeight: 28, letterSpacing: -0.4 },
  stepper: { minHeight: 48, flexDirection: 'row', alignItems: 'center', maxWidth: '100%', borderWidth: 1, borderRadius: 12 },
  stepButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  yield: { minWidth: 92, flexShrink: 1, paddingHorizontal: 6, textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  presets: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', maxWidth: '100%', gap: 4, padding: 4, borderRadius: 12 },
  preset: { minHeight: 44, minWidth: 52, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10, marginBottom: 16 },
  ingredient: { flexDirection: 'row', alignItems: 'baseline', gap: 20, paddingVertical: 14, borderBottomWidth: 1 },
  quantity: { maxWidth: '45%', fontSize: 16, lineHeight: 25, textAlign: 'right', fontWeight: '600', fontVariant: ['tabular-nums'] },
  evidenceToggle: { marginTop: 8, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 4 },
  step: { flexDirection: 'row', gap: 12 },
  stepNumber: { minWidth: 24, paddingTop: 2, fontSize: 13, lineHeight: 24, fontVariant: ['tabular-nums'] },
} satisfies Record<string, ViewStyle | TextStyle>;
