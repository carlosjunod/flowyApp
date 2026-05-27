import { Feather } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { usePatchItem } from '@/hooks/useItems';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

/**
 * Inline tag editor for the detail screen — replaces read-only badges with
 * a chip-row + add-input. Patches via api.patchItem; optimistic UI deferred.
 *
 * Mirrors apps/web/components/inbox/ItemDrawer.tsx tag-add/remove flow.
 */
export const TagEditor: React.FC<{ item: Item }> = ({ item }) => {
  const colors = useResolvedColors();
  const patch = usePatchItem();
  const [draft, setDraft] = useState('');
  const tags = item.tags ?? [];

  const persist = useCallback(
    async (next: string[]) => {
      try {
        await patch.mutateAsync({ id: item.id, patch: { tags: next } });
      } catch {
        // Server rejected; React Query invalidation will refetch the truth.
      }
    },
    [item.id, patch],
  );

  const add = useCallback(() => {
    const value = draft.trim().replace(/^#/, '');
    if (!value) return;
    if (tags.includes(value)) {
      setDraft('');
      return;
    }
    setDraft('');
    void persist([...tags, value]);
  }, [draft, tags, persist]);

  const remove = useCallback(
    (tag: string) => {
      void persist(tags.filter((t) => t !== tag));
    },
    [tags, persist],
  );

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {tags.map((tag) => (
          <View
            key={tag}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingLeft: 10,
              paddingRight: 4,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: colors.fg,
              }}
            >
              {tag}
            </Text>
            <Pressable
              onPress={() => remove(tag)}
              accessibilityLabel={`Remove tag ${tag}`}
              hitSlop={6}
              style={({ pressed }) => [
                {
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="x" size={11} color={colors.muted} />
            </Pressable>
          </View>
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingLeft: 12,
          paddingRight: 4,
        }}
      >
        <Feather name="hash" size={13} color={colors.muted} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder="Add a tag"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            paddingVertical: 8,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            color: colors.fg,
          }}
        />
        {draft.trim() ? (
          <Pressable
            onPress={add}
            accessibilityLabel="Add tag"
            hitSlop={6}
            style={({ pressed }) => [
              {
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: colors.accent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 12,
                color: '#fff',
              }}
            >
              Add
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};
