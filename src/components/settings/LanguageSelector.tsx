import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { LOCALES, LOCALE_LABELS, useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';

/**
 * Interface-language picker, shared by the auth screens and Settings.
 *
 * Three rows: Automatic, then one per supported locale. The language *names*
 * are always written in their own language — someone who has landed in a
 * language they cannot read still needs to recognise the way out, and
 * "Español"/"English" are the only labels on this screen that guarantee that.
 *
 * `compact` drops the explanatory copy for the auth screens, where the selector
 * sits under a short form and the long note would dominate it.
 */
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, detected, explicit, setLocale, useDeviceLocale, t } = useI18n();
  const colors = useResolvedColors();

  const rows: { key: string; label: string; selected: boolean; onPress: () => void }[] = [
    {
      key: 'auto',
      label: t('common.language.automaticDetected', { detected: LOCALE_LABELS[detected] }),
      selected: !explicit,
      onPress: useDeviceLocale,
    },
    ...LOCALES.map((value) => ({
      key: value,
      label: LOCALE_LABELS[value],
      selected: explicit && locale === value,
      onPress: () => setLocale(value),
    })),
  ];

  return (
    <View className="gap-2">
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('common.language.selectorLabel')}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            accessibilityRole="radio"
            accessibilityLabel={row.label}
            accessibilityState={{ checked: row.selected }}
            onPress={row.onPress}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className={`min-h-[48px] flex-row items-center gap-3 px-4 py-3 ${
              index === 0 ? '' : 'border-t border-border'
            }`}
          >
            <Feather
              name={row.selected ? 'check-circle' : 'circle'}
              size={18}
              color={row.selected ? colors.accent : colors.muted}
            />
            <Text className="flex-1 text-base text-fg">{row.label}</Text>
          </Pressable>
        ))}
      </View>
      {compact ? null : (
        <>
          <Text className="px-1 text-xs leading-5 text-muted">
            {t('common.language.followsDevice')}
          </Text>
          <Text className="px-1 text-xs leading-5 text-muted">
            {t('common.language.interfaceOnly')}
          </Text>
          <Text className="px-1 text-xs leading-5 text-muted">
            {t('common.language.digestNote')}
          </Text>
        </>
      )}
    </View>
  );
}
