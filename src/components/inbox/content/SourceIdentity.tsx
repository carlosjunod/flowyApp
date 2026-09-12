import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Item } from '@/types';
import { githubRepository, readAuthor } from '@/types/source';
import { safeSemanticUrl } from '@/types/semantic';
function External({ url, label }: { url?: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const safe = safeSemanticUrl(url);
  if (!safe) return null;
  return <View><Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { setFailed(false); void Linking.openURL(safe).catch(() => setFailed(true)); }}><Text className="text-accent underline">{label}</Text></Pressable>{failed ? <Text accessibilityRole="alert" className="text-muted">Could not open this link. Try again.</Text> : null}</View>;
}
export function SourceIdentity({ item }: { item: Item }) {
  const author = readAuthor(item);
  const repository = item.source_metadata?.repository ?? githubRepository(item.source_url ?? item.raw_url);
  if (!author && !repository) return null;
  return <View className="mb-4 rounded-xl border border-border p-4 gap-2">
    {author ? <><External url={author.url} label={`@${author.handle}`} />{item.author_key === `instagram:${author.handle}` ? <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => router.push({ pathname: '/(app)/(tabs)/inbox', params: { author: item.author_key } })}><Text className="text-accent underline">View saves by this author</Text></Pressable> : null}</> : null}
    {repository ? <><Text className="text-fg font-semibold">{repository.owner}/{repository.name}</Text>
      {item.source_metadata?.repository?.description ? <Text className="text-muted">{item.source_metadata.repository.description}</Text> : null}
      <External url={githubRepository(repository.url)?.url} label="Open repository" />
      <External url={item.source_metadata?.repository?.homepage} label="Project website" />
      <Text className="text-muted text-xs">{[item.source_metadata?.repository?.language, item.source_metadata?.repository?.license].filter(Boolean).join(' · ')}</Text></> : null}
  </View>;
}
