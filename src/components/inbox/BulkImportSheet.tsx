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
};

export const BulkImportSheet: React.FC<Props> = ({ visible, onClose }) => {
  const colors = useResolvedColors();
  const [text, setText] = useState('');
  const { phase, batch, error, submit, reset } = useBulkImport();

  useEffect(() => {
    if (!visible) {
      setText('');
      reset();
    }
  }, [visible, reset]);

  const parsed = useMemo(() => parsePastedUrls(text), [text]);
  const isWorking = phase === 'submitting' || phase === 'polling';
  const isDone = phase === 'done';

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
              Bulk import
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
              Paste links separated by spaces, commas, or new lines. Dead links are pruned automatically.
            </Text>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={'https://example.com\nhttps://news.example/article'}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              editable={!isWorking}
              textAlignVertical="top"
              className="min-h-[180px] rounded-xl border border-border bg-card p-4 text-fg"
              style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }}
            />

            <View className="flex-row gap-4">
              <Stat label="Valid" value={parsed.valid.length} tone="success" />
              <Stat label="Duplicates" value={parsed.duplicates} tone="muted" />
              <Stat label="Invalid" value={parsed.invalid.length} tone="danger" />
            </View>

            {batch ? (
              <View className="rounded-xl border border-border bg-card p-4 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-fg font-semibold">
                    {isDone ? 'Import complete' : 'Importing…'}
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
                    {batch.dead_count} dead {batch.dead_count === 1 ? 'link' : 'links'} pruned
                  </Text>
                ) : null}
              </View>
            ) : null}

            {error ? (
              <Text className="text-sm text-danger">{error.message}</Text>
            ) : null}
          </ScrollView>

          <View className="px-4 pb-4 pt-2 gap-2 border-t border-border">
            {isDone ? (
              <Button title="Done" onPress={onClose} />
            ) : (
              <Button
                title={
                  isWorking
                    ? phase === 'submitting'
                      ? 'Submitting…'
                      : 'Processing…'
                    : `Import ${parsed.valid.length || ''}`.trim()
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
