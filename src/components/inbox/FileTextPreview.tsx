import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { pb } from '@/lib/pb';
import type { FilePreview } from '@/types/files';
export function FileTextPreview({
  id,
  expanded,
}: {
  id: string;
  expanded?: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const [localOpen, setOpen] = useState(false),
    [data, setData] = useState<FilePreview | null>(null),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0);
  const open = expanded ?? localOpen;
  const retrying = useRef(false);
  // Announcements are spoken by the screen reader, so they must be built with
  // the *current* translator rather than captured when the request started.
  const announce = useRef({ ready: '', failed: '' });
  announce.current = {
    ready: t('inbox.preview.ready'),
    failed: t('inbox.preview.failedAnnounce'),
  };
  useEffect(() => {
    if (!retrying.current || (!data && !error)) return;
    AccessibilityInfo.announceForAccessibility(
      data ? announce.current.ready : announce.current.failed,
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
            {open ? t('inbox.preview.close') : t('inbox.preview.open')}
          </Text>
        </Pressable>
      ) : null}
      {open ? (
        <View className={expanded ? '' : 'rounded-xl border border-border p-3'}>
          <Text
            accessibilityRole="header"
            className="font-sans text-sm font-medium text-fg"
          >
            {t('inbox.preview.heading')}
          </Text>
          <Text className="mb-4 mt-1 font-sans text-[13px] leading-5 text-muted">
            {t('inbox.preview.hint')}
          </Text>
          {error ? (
            <View>
              <Text
                accessibilityRole="alert"
                className="font-sans text-sm text-fg"
              >
                {t('inbox.preview.failed')}
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
                  {t('inbox.preview.retry')}
                </Text>
              </Pressable>
            </View>
          ) : !data ? (
            <View
              accessible
              accessibilityLabel={t('inbox.preview.loading')}
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
                  {data.analysis.pages
                    ? t('inbox.preview.partialPages', {
                        processed: formatNumber(data.analysis.processedPages || 0),
                        total: formatNumber(data.analysis.pages),
                      })
                    : t('inbox.preview.partial')}
                </Text>
              ) : null}
              <ScrollView
                style={{ maxHeight: 280 }}
                nestedScrollEnabled
                accessibilityLabel={t('inbox.preview.extractedOf', { name: data.name })}
              >
                {/* Extracted source text — rendered as-is. */}
                <Text
                  selectable
                  className="font-sans text-sm leading-6 text-fg"
                >
                  {data.text || t('inbox.preview.empty')}
                </Text>
              </ScrollView>
            </>
          )}
          {data?.truncated ? (
            <Text className="mt-2 text-xs text-muted">
              {t('inbox.preview.truncated')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
