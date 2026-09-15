import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
            {compact ? 'Original retention' : 'Default for new documents'}
          </Text>
          <Text className="mt-1 font-sans text-sm text-muted">
            {RETENTION_OPTIONS.find((o) => o.value === value)?.label}
          </Text>
        </View>
        <StorageAction
          title={open ? 'Close' : 'Change'}
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
                ? 'Original retention options'
                : 'Default retention options'
            }
          >
            {RETENTION_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityLabel={o.label}
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
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="my-3 font-sans text-[13px] leading-5 text-muted">
            {compact
              ? 'This original only. '
              : 'New PDF, Word and PowerPoint uploads on all your devices. Existing files keep their policy. '}
            {draft === 'keep'
              ? 'Keep the original until you choose to remove it.'
              : 'Removed originals cannot be recovered. Extracted text stays. Partial or failed documents keep their originals until analysis is complete.'}
          </Text>
          {saveError ? (
            <Text
              accessibilityRole="alert"
              className="mb-3 font-sans text-sm leading-5 text-fg"
            >
              Could not confirm the save. Your selection is still here. Try
              again.
            </Text>
          ) : null}
          <View className="items-start">
            <StorageAction
              title={
                disabled ? 'Saving…' : compact ? 'Apply' : 'Save preference'
              }
              tone="primary"
              disabled={disabled || draft === value}
              onPress={() => void save()}
            />
          </View>
        </View>
      ) : !compact ? (
        <Text className="mt-2 font-sans text-[13px] leading-5 text-muted">
          Your extracted text stays available when an original is removed.
        </Text>
      ) : null}
    </View>
  );
}
