import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useDeleteItem, useItemById, usePatchItem } from '@/hooks/useItems';
import { useItemStatus } from '@/hooks/useItemStatus';
import { relativeDate } from '@/lib/relativeDate';
import type { Item } from '@/types';

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { data: item, isLoading, error } = useItemById(id);
  useItemStatus(id);

  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Spinner className="mt-12" size="large" />
      </SafeAreaView>
    );
  }
  if (error || !item) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
        <Text className="text-base text-danger mb-4">
          {error?.message ?? 'Item not found'}
        </Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-accent text-base">← Back</Text>
        </Pressable>
        <View className="flex-row gap-4">
          <Pressable onPress={() => setEditing(true)}>
            <Text className="text-accent text-base">Edit</Text>
          </Pressable>
          <DeleteButton id={item.id} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Thumbnail item={item} className="w-full h-56" rounded="lg" />
        <View className="gap-2">
          <Text className="text-2xl font-bold text-fg">{item.title ?? 'Untitled'}</Text>
          <View className="flex-row flex-wrap items-center gap-2">
            {item.category ? <Badge label={item.category} tone="accent" /> : null}
            <Text className="text-sm text-muted">{relativeDate(item.created)}</Text>
            {item.status !== 'ready' ? (
              <Badge
                label={item.status}
                tone={item.status === 'error' ? 'danger' : 'neutral'}
              />
            ) : null}
          </View>
          {item.source_url ? (
            <Pressable onPress={() => Linking.openURL(item.source_url ?? '')}>
              <Text className="text-accent" numberOfLines={1}>
                {item.source_url}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {item.summary ? (
          <View className="gap-1">
            <Text className="text-xs uppercase text-muted">Summary</Text>
            <Text className="text-base text-fg">{item.summary}</Text>
          </View>
        ) : null}
        {(item.tags ?? []).length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {(item.tags ?? []).map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </View>
        ) : null}
        {item.error_msg ? (
          <View className="rounded-xl border border-danger bg-danger/10 p-3">
            <Text className="text-danger font-medium mb-1">Processing error</Text>
            <Text className="text-danger">{item.error_msg}</Text>
          </View>
        ) : null}
        {item.content ? (
          <View>
            <Text className="text-xs uppercase text-muted mb-1">Content</Text>
            <Markdown>{item.content}</Markdown>
          </View>
        ) : null}
      </ScrollView>
      {editing ? (
        <EditModal
          item={item}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const DeleteButton: React.FC<{ id: string }> = ({ id }) => {
  const del = useDeleteItem();
  return (
    <Pressable
      onPress={() => {
        Alert.alert('Delete item?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await del.mutateAsync(id);
                router.back();
              } catch (err) {
                Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown');
              }
            },
          },
        ]);
      }}
    >
      <Text className="text-danger text-base">Delete</Text>
    </Pressable>
  );
};

type EditProps = {
  item: Item;
  onClose: () => void;
};

const EditModal: React.FC<EditProps> = ({ item, onClose }) => {
  const [title, setTitle] = useState(item.title ?? '');
  const [summary, setSummary] = useState(item.summary ?? '');
  const [category, setCategory] = useState(item.category ?? '');
  const [tags, setTags] = useState((item.tags ?? []).join(', '));
  const patch = usePatchItem();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(item.title ?? '');
    setSummary(item.summary ?? '');
    setCategory(item.category ?? '');
    setTags((item.tags ?? []).join(', '));
  }, [item]);

  const save = async () => {
    setError(null);
    try {
      await patch.mutateAsync({
        id: item.id,
        patch: {
          title: title.trim() || undefined,
          summary: summary.trim() || undefined,
          category: category.trim() || undefined,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-bg rounded-t-2xl p-4 gap-3">
          <Text className="text-xl font-semibold text-fg">Edit item</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#94a3b8"
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Summary"
            placeholderTextColor="#94a3b8"
            multiline
            className="min-h-[88px] rounded-xl border border-border bg-card px-3 py-2 text-fg"
          />
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Category"
            placeholderTextColor="#94a3b8"
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="Tags (comma separated)"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          {error ? <Text className="text-danger">{error}</Text> : null}
          <View className="flex-row gap-2 pt-2">
            <View className="flex-1">
              <Button title="Cancel" variant="secondary" onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button title="Save" loading={patch.isPending} onPress={save} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

