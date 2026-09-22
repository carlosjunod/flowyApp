import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { RETENTION_OPTIONS, type FileRetention } from '@/types/files';
import { StorageAction } from './StorageAction';

export function FileRetentionPicker({
  value,
  onSave,
  disabled,
  compact = false,
}: {
  value: FileRetention;
  onSave: (v: FileRetention) => Promise<boolean>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(value),
    [saveError, setSaveError] = useState(false);
  const colors = useResolvedColors();
  const { t, tKey } = useI18n();
  useEffect(() => setDraft(value), [value]);
  async function save() {
    setSaveError(false);
    try {
      if (await onSave(draft)) setOpen(false);
      else setSaveError(true);
    } catch {
      setSaveError(true);
    }
  }
  return (
    <View className={compact ? '' : 'border-y border-border py-4'}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="font-sans text-sm font-medium text-fg">
            {compact
              ? t('settings.storage.retention.titleCompact')
              : t('settings.storage.retention.titleDefault')}
          </Text>
          <Text className="mt-1 font-sans text-sm text-muted">
            {(() => {
              const active = RETENTION_OPTIONS.find((o) => o.value === value);
              return active ? tKey(active.labelKey) : '';
            })()}
          </Text>
        </View>
        <StorageAction
          title={open
            ? t('settings.storage.retention.close')
            : t('settings.storage.retention.change')}
          tone="action"
          expanded={open}
          disabled={disabled}
          onPress={() => {
            setOpen((v) => !v);
            setDraft(value);
            setSaveError(false);
          }}
        />
      </View>
      {open ? (
        <View className="mt-4">
          <View
            accessibilityLabel={
              compact
                ? t('settings.storage.retention.optionsCompact')
                : t('settings.storage.retention.optionsDefault')
            }
          >
            {RETENTION_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityLabel={tKey(o.labelKey)}
                accessibilityState={{ checked: draft === o.value, disabled }}
                disabled={disabled}
                onPress={() => {
                  setDraft(o.value);
                  setSaveError(false);
                }}
                className="min-h-[48px] flex-row items-center gap-3 border-b border-border py-3"
                style={({ pressed }) => ({
                  opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
                })}
              >
                <Feather
                  name={draft === o.value ? 'check-circle' : 'circle'}
                  color={draft === o.value ? colors.accent : colors.muted}
                  size={18}
                />
                <Text className="flex-1 font-sans text-sm text-fg">
                  {tKey(o.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="my-3 font-sans text-[13px] leading-5 text-muted">
            {compact
              ? t('settings.storage.retention.scopeCompact')
              : t('settings.storage.retention.scopeDefault')}
            {draft === 'keep'
              ? t('settings.storage.retention.keepHint')
              : t('settings.storage.retention.removeHint')}
          </Text>
          {saveError ? (
            <Text
              accessibilityRole="alert"
              className="mb-3 font-sans text-sm leading-5 text-fg"
            >
              {t('settings.storage.retention.saveFailed')}
            </Text>
          ) : null}
          <View className="items-start">
            <StorageAction
              title={
                disabled
                  ? t('settings.storage.retention.saving')
                  : compact
                    ? t('settings.storage.retention.apply')
                    : t('settings.storage.retention.savePreference')
              }
              tone="primary"
              disabled={disabled || draft === value}
              onPress={() => void save()}
            />
          </View>
        </View>
      ) : !compact ? (
        <Text className="mt-2 font-sans text-[13px] leading-5 text-muted">
          {t('settings.storage.retention.footer')}
        </Text>
      ) : null}
    </View>
  );
}
