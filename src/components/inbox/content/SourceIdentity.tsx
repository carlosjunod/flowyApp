import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Item } from '@/types';
import { githubRepository, readAuthor } from '@/types/source';
import { safeSemanticUrl } from '@/types/semantic';
import { READER_COPY } from '@/types/reader';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';

function External({ url, label, compact = false }: { url?: string; label: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();
  const colors = useResolvedColors();
  const safe = safeSemanticUrl(url);
  if (!safe) return null;
  return <View><Pressable accessibilityRole="link" accessibilityLabel={label} className="active:opacity-70" style={{ minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
    onPress={() => { setFailed(false); void Linking.openURL(safe).catch(() => setFailed(true)); }}>
    {!compact ? <Text style={{ color: colors.accent, fontFamily: 'Inter_500Medium', fontSize: 14 }}>{label}</Text> : null}
    <Feather name="arrow-up-right" size={compact ? 18 : 14} color={compact ? colors.muted : colors.accent} />
  </Pressable>{failed ? <Text accessibilityRole="alert" className="text-muted text-sm">{t('inbox.source.openFailed')}</Text> : null}</View>;
}

export function SourceIdentity({ item }: { item: Item }) {
  const { t, tKey } = useI18n();
  const colors = useResolvedColors();
  const author = readAuthor(item);
  const repository = item.source_metadata?.repository ?? githubRepository(item.source_url ?? item.raw_url);
  if (!author && !repository) return null;
  return <View style={{ gap: 12 }}>
    {author ? <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Feather name="instagram" size={19} color={colors.muted} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.fg, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 }}>{author.name || `@${author.handle}`}</Text>
          <Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{author.name ? `@${author.handle} · ` : ''}Instagram</Text>
        </View>
        <External url={author.url} label={t('inbox.source.openAuthor', { handle: author.handle })} compact />
      </View>
      {item.author_key === `instagram:${author.handle}` ? <Pressable accessibilityRole="button" className="active:opacity-70" style={{ minHeight: 44, paddingLeft: 56, paddingRight: 12, paddingVertical: 8, marginTop: 4, flexDirection: 'row', gap: 12, alignItems: 'center' }}
        onPress={() => router.push({ pathname: '/(app)/(tabs)/inbox', params: { author: item.author_key } })}>
        <Text style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, color: colors.accent }}>{tKey(READER_COPY.authorSaves)}</Text><Feather name="arrow-right" size={17} color={colors.accent} />
      </Pressable> : null}
    </View> : null}
    {repository ? <View className="rounded-xl border border-border p-4" style={{ gap: 4 }}>
      <Text className="text-fg" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{repository.owner}/{repository.name}</Text>
      {item.source_metadata?.repository?.description ? <Text className="text-muted text-sm leading-6">{item.source_metadata.repository.description}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}><External url={githubRepository(repository.url)?.url} label={t('inbox.source.openRepository')} /><External url={item.source_metadata?.repository?.homepage} label={t('inbox.source.projectWebsite')} /></View>
      <Text className="text-muted text-xs">{[item.source_metadata?.repository?.language, item.source_metadata?.repository?.license].filter(Boolean).join(' · ')}</Text>
    </View> : null}
  </View>;
}
