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
import { useResolvedColors } from '@/lib/theme';
import { parsePastedUrls } from '@/lib/urls';

type Props = {
  visible: boolean;
  onClose: () => void;
  onStatusChange?: (status: 'idle' | 'working' | 'done') => void;
};

export const BulkImportSheet: React.FC<Props> = ({ visible, onClose, onStatusChange }) => {
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
              Save links
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={22} color={colors.fg} />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-sm text-muted">
              Paste one link, or several separated by spaces or new lines. Saving continues while you use Flowy; processing happens after each link is saved.
            </Text>

            <TextInput accessibilityLabel="Links to save"
              value={text}
              onChangeText={setText}
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
              <Stat label="Links" value={parsed.valid.length} tone="success" />
              <Stat label="Duplicates" value={parsed.duplicates} tone="muted" />
              <Stat label="Invalid" value={parsed.invalid.length} tone="danger" />
            </View>

            {batch ? (
              <View className="rounded-xl border border-border bg-card p-4 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-fg font-semibold">
                    {isDone ? (failedUrls.length ? 'Some links could not be saved' : 'Saved to your inbox') : 'Saving links…'}
                  </Text>
                  <Text className="text-sm text-muted">
                    {batch.processed} / {batch.total}
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
                    {batch.dead_count} {batch.dead_count === 1 ? 'link could' : 'links could'} not be saved. Try again below.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {parsed.invalid.length > 0 && !isWorking ? <Text className="text-danger text-sm">{parsed.invalid.length} invalid entries will be skipped. Check that links start with https://.</Text> : null}
            {failedUrls.length && !isWorking ? <View className="gap-2"><Text className="text-muted text-sm" selectable>{failedUrls.join('\n')}</Text><Button title={`Retry ${failedUrls.length} failed links`} variant="secondary" onPress={() => { setText(failedUrls.join('\n')); void submit(failedUrls); }} /></View> : null}
            {error ? (
              <Text className="text-sm text-danger">{error.message}</Text>
            ) : null}
          </ScrollView>

          <View className="px-4 pb-4 pt-2 gap-2 border-t border-border">
            {isWorking ? <Button title="Continue using Flowy" variant="secondary" onPress={onClose} /> : null}
            {isDone ? (
              <Button title="Done" onPress={() => { reset(); setText(''); onClose(); }} />
            ) : (
              <Button
                title={
                  isWorking
                    ? phase === 'submitting'
                      ? 'Saving…'
                      : 'Saving…'
                    : `Save ${parsed.valid.length || ''} ${parsed.valid.length === 1 ? 'link' : 'links'}`.trim()
                }
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
  const valueColor =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-muted';
  return (
    <View className="flex-1">
      <Text className={`text-2xl font-semibold ${valueColor}`}>{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
};
