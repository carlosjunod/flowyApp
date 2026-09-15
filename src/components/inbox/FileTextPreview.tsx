import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
    [error, setError] = useState(false);
  const open = expanded ?? localOpen;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const token = pb.authStore.token;
    setData(null);
    setError(false);
    void api.previewFile(id).then((r) => {
      if (cancelled || token !== pb.authStore.token) return;
      if (r.error) setError(true);
      else setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [id, open]);
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
          <Text className="mb-2 text-xs text-muted">
            Extracted text preview. Layout, images and charts may differ from
            the original.
          </Text>
          <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
            <Text selectable className="font-sans text-sm leading-6 text-fg">
              {error
                ? 'Could not load preview.'
                : !data
                  ? 'Loading preview…'
                  : data.text || 'No extracted text is available yet.'}
            </Text>
          </ScrollView>
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
