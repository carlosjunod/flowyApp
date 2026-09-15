import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileTextPreview } from '@/components/inbox/FileTextPreview';
import {
  formatFileBytes,
  type FileRetention,
  type ManagedFile,
} from '@/types/files';
import { FileRetentionPicker } from './FileRetentionPicker';
import { StorageAction } from './StorageAction';

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
  const [panel, setPanel] = useState<'preview' | 'options' | null>(null),
    [confirm, setConfirm] = useState(false);
  const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  const state = file.removalPending
    ? 'Cleanup pending'
    : file.analysis.state === 'uploading'
      ? 'Uploading'
      : file.originalAvailable === false
        ? 'Original removed'
        : file.analysis.state === 'queued'
          ? 'Waiting for analysis'
          : file.analysis.state === 'analyzing'
            ? 'Analyzing document'
            : file.analysis.state === 'partial'
              ? 'Partial analysis'
              : file.analysis.state === 'error'
                ? 'Analysis failed'
                : file.analysis.state === 'unsupported'
                  ? 'Not analyzed'
                  : null;
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
              {extension.length <= 5 ? extension : 'FILE'}
            </Text>
          </View>
          <View className="flex-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={file.name}
              accessibilityValue={{
                text: `${formatFileBytes(file.size)}, ${new Date(file.created.replace(' ', 'T')).toLocaleDateString()}`,
              }}
              accessibilityHint="Opens the saved item"
              onPress={() => router.push(`/item/${file.itemId}`)}
              className="min-h-[44px] justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="font-sans text-sm font-medium text-fg">
                {file.name}
              </Text>
              <Text className="mt-1 font-sans text-[13px] leading-5 text-muted">
                {formatFileBytes(file.size)} ·{' '}
                {new Date(file.created.replace(' ', 'T')).toLocaleDateString(
                  undefined,
                  { day: 'numeric', month: 'short', year: 'numeric' },
                )}
              </Text>
            </Pressable>
            {file.duplicateCount > 1 ? (
              <Text className="mt-1 font-sans text-[13px] text-fg">
                {file.duplicateCount} identical copies
              </Text>
            ) : null}
            {state ? (
              <Text className="mt-1 font-sans text-[13px] text-muted">
                {state}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="-ml-3 mt-2 flex-row flex-wrap">
          <StorageAction
            title="Preview"
            label={`Preview text for ${file.name}`}
            icon="eye"
            expanded={panel === 'preview'}
            disabled={busy || file.analysis.state === 'uploading'}
            onPress={() => toggle('preview')}
          />
          {file.originalAvailable ? (
            <StorageAction
              label={`Download ${file.name}`}
              icon="download"
              disabled={busy}
              onPress={onDownload}
            />
          ) : null}
          <StorageAction
            title="Options"
            label={`Options for ${file.name}`}
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
                  Original file
                </Text>
                <StorageAction
                  title="Saved item"
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
                      Eligible for removal from{' '}
                      {new Date(file.retainUntil).toLocaleDateString()}, after
                      complete analysis.
                    </Text>
                  ) : null}
                  <View className="mt-4 border-t border-border pt-3">
                    {confirm ? (
                      <View>
                        <Text
                          accessibilityRole="alert"
                          className="font-sans text-sm font-semibold text-fg"
                        >
                          Remove “{file.name}”?
                        </Text>
                        <Text className="my-2 font-sans text-sm leading-5 text-muted">
                          This cannot be undone. Your saved item, extracted text
                          and notes stay.
                          {file.analysis.state === 'partial'
                            ? ' This document was only partially analyzed.'
                            : ''}{' '}
                          Space is released after cleanup, in at least 15
                          minutes.
                        </Text>
                        <View className="flex-row flex-wrap gap-1">
                          <StorageAction
                            title={busy ? 'Removing…' : 'Confirm removal'}
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
                            title="Keep original"
                            disabled={busy}
                            onPress={() => setConfirm(false)}
                          />
                        </View>
                      </View>
                    ) : (
                      <View className="-ml-3 items-start">
                        <StorageAction
                          title="Remove original"
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
                  {file.removalPending
                    ? 'This original is awaiting cleanup. The extracted text stays available.'
                    : file.originalAvailable === false
                      ? 'The original is no longer available. You can still read the extracted text.'
                      : file.analysis.state === 'unsupported'
                        ? 'This file is stored without extracted text. Keep its original, or delete the saved item to remove the file.'
                        : file.analysis.state === 'error'
                          ? 'Analysis did not finish. Retry it from the saved item before removing this original.'
                          : 'Keep this original while its text is being extracted. You can remove it here when the document is ready.'}
                </Text>
              )}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
