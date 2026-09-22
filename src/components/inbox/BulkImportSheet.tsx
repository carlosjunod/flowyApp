import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useBulkImport } from '@/hooks/useBulkImport';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { parsePastedUrls } from '@/lib/urls';

type Props = {
  visible: boolean;
  onClose: () => void;
  onStatusChange?: (status: 'idle' | 'working' | 'done') => void;
};

export const BulkImportSheet: React.FC<Props> = ({ visible, onClose, onStatusChange }) => {
  const { t, tKey, formatNumber } = useI18n();
  const colors = useResolvedColors();
  const [text, setText] = useState('');
  const { phase, batch, error, submit, reset, failedUrls } = useBulkImport();


  const parsed = useMemo(() => parsePastedUrls(text), [text]);
  const isWorking = phase === 'submitting' || phase === 'polling';
  const isDone = phase === 'done';
  useEffect(() => { onStatusChange?.(isWorking ? 'working' : isDone ? 'done' : 'idle'); }, [isWorking, isDone, onStatusChange]);

  const onSubmit = () => {
    if (parsed.valid.length === 0) return;
    void submit(parsed.valid);
  };

  const progressPct = batch && batch.total > 0
    ? Math.min(100, Math.round((batch.processed / batch.total) * 100))
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
            <Text
              className="text-2xl text-fg"
              style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
            >
              {t('inbox.addLinks.title')}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('inbox.addLinks.close')}>
              <Feather name="x" size={22} color={colors.fg} />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-sm text-muted">{t('inbox.addLinks.intro')}</Text>

            <TextInput accessibilityLabel={t('inbox.addLinks.inputLabel')}
              value={text}
              onChangeText={setText}
              // Example URLs, not prose — the same in every language.
              placeholder={'https://example.com\nhttps://news.example/article'}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              editable={!isWorking}
              textAlignVertical="top"
              className="min-h-[110px] rounded-xl border border-border bg-card p-4 text-fg"
              style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }}
            />

            <View className="flex-row gap-4">
              <Stat label={t('inbox.addLinks.statLinks')} value={parsed.valid.length} tone="success" />
              <Stat label={t('inbox.addLinks.statDuplicates')} value={parsed.duplicates} tone="muted" />
              <Stat label={t('inbox.addLinks.statInvalid')} value={parsed.invalid.length} tone="danger" />
            </View>

            {batch ? (
              <View className="rounded-xl border border-border bg-card p-4 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-fg font-semibold">
                    {isDone
                      ? failedUrls.length
                        ? t('inbox.addLinks.partialTitle')
                        : t('inbox.addLinks.doneTitle')
                      : t('inbox.addLinks.progressTitle')}
                  </Text>
                  <Text className="text-sm text-muted">
                    {formatNumber(batch.processed)} / {formatNumber(batch.total)}
                  </Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-surface">
                  <View
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: colors.accent,
                      height: '100%',
                    }}
                  />
                </View>
                {batch.dead_count > 0 ? (
                  <Text className="text-xs text-muted">
                    {t('inbox.addLinks.deadCount', { count: batch.dead_count })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {parsed.invalid.length > 0 && !isWorking ? <Text className="text-danger text-sm">{t('inbox.addLinks.invalidHint', { count: parsed.invalid.length })}</Text> : null}
            {failedUrls.length && !isWorking ? <View className="gap-2"><Text className="text-muted text-sm" selectable>{failedUrls.join('\n')}</Text><Button title={t('inbox.addLinks.retryFailed', { count: failedUrls.length })} variant="secondary" onPress={() => { setText(failedUrls.join('\n')); void submit(failedUrls); }} /></View> : null}
            {error ? (
              <Text accessibilityRole="alert" className="text-sm text-danger">{tKey(error.key, error.vars)}</Text>
            ) : null}
          </ScrollView>

          <View className="px-4 pb-4 pt-2 gap-2 border-t border-border">
            {isWorking ? <Button title={t('inbox.addLinks.keepUsing')} variant="secondary" onPress={onClose} /> : null}
            {isDone ? (
              <Button title={t('inbox.addLinks.done')} onPress={() => { reset(); setText(''); onClose(); }} />
            ) : (
              <Button
                title={isWorking ? t('inbox.addLinks.saving') : t('inbox.addLinks.submit', { count: parsed.valid.length })}
                onPress={onSubmit}
                loading={isWorking}
                disabled={parsed.valid.length === 0}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const Stat: React.FC<{ label: string; value: number; tone: 'success' | 'muted' | 'danger' }> = ({
  label,
  value,
  tone,
}) => {
  const { formatNumber } = useI18n();
  const valueColor =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-muted';
  return (
    <View className="flex-1">
      <Text className={`text-2xl font-semibold ${valueColor}`}>{formatNumber(value)}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
};
