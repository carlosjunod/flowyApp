import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { api } from '@/lib/api';
import { pb } from '@/lib/pb';
import type { FilePreview } from '@/types/files';
export function FileTextPreview({
  id,
  expanded,
}: {
  id: string;
  expanded?: boolean;
}) {
  const [localOpen, setOpen] = useState(false),
    [data, setData] = useState<FilePreview | null>(null),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0);
  const open = expanded ?? localOpen;
  const retrying = useRef(false);
  useEffect(() => {
    if (!retrying.current || (!data && !error)) return;
    AccessibilityInfo.announceForAccessibility(
      data
        ? 'Text preview ready.'
        : 'Could not load preview. Retry preview is available.',
    );
    retrying.current = false;
  }, [data, error]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const token = pb.authStore.token;
    setData(null);
    setError(false);
    void api
      .previewFile(id)
      .then((r) => {
        if (cancelled || token !== pb.authStore.token) return;
        if (r.error) setError(true);
        else setData(r.data);
      })
      .catch(() => {
        if (!cancelled && token === pb.authStore.token) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, open, version]);
  return (
    <View className="min-w-0">
      {expanded === undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((v) => !v)}
          className="min-h-[44px] justify-center"
        >
          <Text className="text-accent">
            {open ? 'Close preview' : 'Preview text'}
          </Text>
        </Pressable>
      ) : null}
      {open ? (
        <View className={expanded ? '' : 'rounded-xl border border-border p-3'}>
          <Text
            accessibilityRole="header"
            className="font-sans text-sm font-medium text-fg"
          >
            Extracted text
          </Text>
          <Text className="mb-4 mt-1 font-sans text-[13px] leading-5 text-muted">
            Layout, images and charts may differ from the original.
          </Text>
          {error ? (
            <View>
              <Text
                accessibilityRole="alert"
                className="font-sans text-sm text-fg"
              >
                Could not load preview.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  retrying.current = true;
                  setVersion((v) => v + 1);
                }}
                className="mt-2 min-h-[44px] justify-center rounded-lg px-3 active:opacity-70"
              >
                <Text className="font-sans text-sm font-medium text-fg">
                  Retry preview
                </Text>
              </Pressable>
            </View>
          ) : !data ? (
            <View
              accessible
              accessibilityLabel="Loading preview"
              className="gap-3 py-2"
            >
              <View className="h-3 w-4/5 rounded bg-muted/15" />
              <View className="h-3 rounded bg-muted/15" />
              <View className="h-3 w-2/3 rounded bg-muted/15" />
            </View>
          ) : (
            <>
              {data.analysis.state === 'partial' ? (
                <Text className="mb-3 font-sans text-sm leading-5 text-muted">
                  Partial analysis
                  {data.analysis.pages
                    ? `: ${data.analysis.processedPages || 0} of ${data.analysis.pages} pages`
                    : ''}
                  . Open the saved item to retry.
                </Text>
              ) : null}
              <ScrollView
                style={{ maxHeight: 280 }}
                nestedScrollEnabled
                accessibilityLabel={`Extracted text of ${data.name}`}
              >
                <Text
                  selectable
                  className="font-sans text-sm leading-6 text-fg"
                >
                  {data.text || 'No extracted text is available yet.'}
                </Text>
              </ScrollView>
            </>
          )}
          {data?.truncated ? (
            <Text className="mt-2 text-xs text-muted">
              Preview shortened. Open the saved item to read more.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
