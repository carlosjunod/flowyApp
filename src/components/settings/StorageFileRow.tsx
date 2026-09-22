import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileTextPreview } from '@/components/inbox/FileTextPreview';
import { useI18n } from '@/lib/i18n';
import {
  formatFileBytes,
  type FileRetention,
  type ManagedFile,
} from '@/types/files';
import { FileRetentionPicker } from './FileRetentionPicker';
import { StorageAction } from './StorageAction';

/**
 * The row's state caption collapses several independent flags into one line.
 * It resolves to a translation key so the ladder stays readable and the copy
 * stays in the dictionary.
 */
function stateKey(file: ManagedFile): string | null {
  if (file.removalPending) return 'settings.storage.row.cleanupPending';
  if (file.analysis.state === 'uploading') return 'settings.storage.row.uploading';
  if (file.originalAvailable === false) return 'settings.storage.row.originalRemoved';
  if (file.analysis.state === 'queued') return 'settings.storage.row.queued';
  if (file.analysis.state === 'analyzing') return 'settings.storage.row.analyzing';
  if (file.analysis.state === 'partial') return 'settings.storage.row.partial';
  if (file.analysis.state === 'error') return 'settings.storage.row.analysisFailed';
  if (file.analysis.state === 'unsupported') return 'settings.storage.row.notAnalyzed';
  return null;
}

/** Why an original cannot be removed yet — one sentence per reason. */
function lockedKey(file: ManagedFile): string {
  if (file.removalPending) return 'settings.storage.row.lockedCleanup';
  if (file.originalAvailable === false) return 'settings.storage.row.lockedRemoved';
  if (file.analysis.state === 'unsupported') return 'settings.storage.row.lockedUnsupported';
  if (file.analysis.state === 'error') return 'settings.storage.row.lockedError';
  return 'settings.storage.row.lockedPending';
}

export function StorageFileRow({
  file,
  busy,
  onDownload,
  onRemove,
  onRetention,
}: {
  file: ManagedFile;
  busy: boolean;
  onDownload: () => void;
  onRemove: () => Promise<boolean>;
  onRetention: (v: FileRetention) => Promise<boolean>;
}) {
  const router = useRouter();
  const { t, tKey, locale, formatDate } = useI18n();
  const [panel, setPanel] = useState<'preview' | 'options' | null>(null),
    [confirm, setConfirm] = useState(false);
  // Extensions come from the filename, so they are never translated; only the
  // "unknown extension" placeholder is.
  const extension = file.name.split('.').pop()?.toUpperCase() || t('settings.storage.row.fallbackExtension');
  const state = stateKey(file);
  const created = file.created.replace(' ', 'T');
  const toggle = (next: 'preview' | 'options') => {
    setPanel(panel === next ? null : next);
    setConfirm(false);
  };
  return (
    <View className="border-b border-border">
      <View className="pt-4 pb-2">
        <View className="flex-row items-start gap-3">
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="mt-1 h-11 w-10 items-center justify-center rounded-lg border border-border bg-surface"
          >
            <Text className="font-sans text-[9px] font-semibold text-muted">
              {extension.length <= 5 ? extension : t('settings.storage.row.fallbackExtension')}
            </Text>
          </View>
          <View className="flex-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={file.name}
              accessibilityValue={{
                text: `${formatFileBytes(file.size, locale)}, ${formatDate(created)}`,
              }}
              accessibilityHint={t('settings.storage.row.openHint')}
              onPress={() => router.push(`/item/${file.itemId}`)}
              className="min-h-[44px] justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              {/* The filename is the user's own; never translated. */}
              <Text className="font-sans text-sm font-medium text-fg">
                {file.name}
              </Text>
              <Text className="mt-1 font-sans text-[13px] leading-5 text-muted">
                {formatFileBytes(file.size, locale)} ·{' '}
                {formatDate(created, { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </Pressable>
            {file.duplicateCount > 1 ? (
              <Text className="mt-1 font-sans text-[13px] text-fg">
                {t('settings.storage.row.duplicates', { count: file.duplicateCount })}
              </Text>
            ) : null}
            {state ? (
              <Text className="mt-1 font-sans text-[13px] text-muted">
                {tKey(state)}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="-ml-3 mt-2 flex-row flex-wrap">
          <StorageAction
            title={t('settings.storage.row.preview')}
            label={t('settings.storage.row.previewLabel', { name: file.name })}
            icon="eye"
            expanded={panel === 'preview'}
            disabled={busy || file.analysis.state === 'uploading'}
            onPress={() => toggle('preview')}
          />
          {file.originalAvailable ? (
            <StorageAction
              label={t('settings.storage.row.downloadLabel', { name: file.name })}
              icon="download"
              disabled={busy}
              onPress={onDownload}
            />
          ) : null}
          <StorageAction
            title={t('settings.storage.row.options')}
            label={t('settings.storage.row.optionsLabel', { name: file.name })}
            icon={panel === 'options' ? 'x' : 'sliders'}
            expanded={panel === 'options'}
            disabled={busy}
            onPress={() => toggle('options')}
          />
        </View>
      </View>
      {panel ? (
        <View className="mb-4 bg-surface/50 p-4">
          {panel === 'preview' ? (
            <FileTextPreview id={file.id} expanded />
          ) : (
            <>
              <View className="mb-3 flex-row items-center justify-between gap-2">
                <Text className="font-sans text-sm font-medium text-fg">
                  {t('settings.storage.row.originalFile')}
                </Text>
                <StorageAction
                  title={t('settings.storage.row.savedItem')}
                  icon="arrow-up-right"
                  tone="action"
                  onPress={() => router.push(`/item/${file.itemId}`)}
                />
              </View>
              {file.canRemove ? (
                <>
                  <FileRetentionPicker
                    compact
                    value={file.retention || 'keep'}
                    disabled={busy}
                    onSave={onRetention}
                  />
                  {file.retainUntil ? (
                    <Text className="mt-2 font-sans text-[13px] leading-5 text-muted">
                      {t('settings.storage.row.eligibleFrom', {
                        date: formatDate(file.retainUntil),
                      })}
                    </Text>
                  ) : null}
                  <View className="mt-4 border-t border-border pt-3">
                    {confirm ? (
                      <View>
                        <Text
                          accessibilityRole="alert"
                          className="font-sans text-sm font-semibold text-fg"
                        >
                          {t('settings.storage.row.removeTitle', { name: file.name })}
                        </Text>
                        <Text className="my-2 font-sans text-sm leading-5 text-muted">
                          {t('settings.storage.row.removeBody', {
                            partial:
                              file.analysis.state === 'partial'
                                ? t('settings.storage.row.removeBodyPartial')
                                : '',
                          })}
                        </Text>
                        <View className="flex-row flex-wrap gap-1">
                          <StorageAction
                            title={busy
                              ? t('settings.storage.row.removing')
                              : t('settings.storage.row.confirmRemoval')}
                            tone="danger"
                            disabled={busy}
                            onPress={() =>
                              void onRemove().then((ok) => {
                                if (ok) {
                                  setConfirm(false);
                                  setPanel(null);
                                }
                              })
                            }
                          />
                          <StorageAction
                            title={t('settings.storage.row.keepOriginal')}
                            disabled={busy}
                            onPress={() => setConfirm(false)}
                          />
                        </View>
                      </View>
                    ) : (
                      <View className="-ml-3 items-start">
                        <StorageAction
                          title={t('settings.storage.row.removeOriginal')}
                          tone="danger"
                          disabled={busy}
                          onPress={() => setConfirm(true)}
                        />
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <Text className="font-sans text-sm leading-5 text-muted">
                  {tKey(lockedKey(file))}
                </Text>
              )}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
