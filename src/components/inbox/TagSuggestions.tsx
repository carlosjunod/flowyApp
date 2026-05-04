import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { usePatchItem } from '@/hooks/useItems';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

/**
 * Mock list — mirrors the webapp's MOCK_SUGGESTED_TAGS in `TagsArea`. Both
 * platforms switch to `exploration.suggested_tags` once the worker exposes it.
 */
const MOCK_SUGGESTED_TAGS = ['no-code tools', 'video marketing', 'AI creative'];

type Props = { item: Item };

/**
 * AI-suggested tag pills with accept/dismiss. Mirrors `apps/web/components/inbox/
 * ItemDrawer.tsx#TagsArea` (lines 871–897). Renders only when the item is enriched.
 *
 * Accept: patches the item with the new tag merged into existing tags.
 * Dismiss: hides locally for the rest of the session — no persistence yet.
 */
export const TagSuggestions: React.FC<Props> = ({ item }) => {
  const colors = useResolvedColors();
  const patch = usePatchItem();
  const [dismissed, setDismissed] = useState<string[]>([]);

  if (item.exploration?.status !== 'enriched') return null;

  const tags = item.tags ?? [];
  const visible = MOCK_SUGGESTED_TAGS.filter(
    (t) => !tags.includes(t) && !dismissed.includes(t),
  );

  if (visible.length === 0) return null;

  const accept = (tag: string) => {
    patch.mutate({
      id: item.id,
      patch: { tags: [...tags, tag] },
    });
  };

  const dismiss = (tag: string) => {
    setDismissed((prev) => [...prev, tag]);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {visible.map((tag) => (
        <View
          key={`s-${tag}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.accent + 'B3',
            backgroundColor: colors.accent + '0F',
          }}
        >
          <MaterialCommunityIcons name="creation" size={11} color={colors.accent} />
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 11.5,
              color: colors.accent,
            }}
          >
            {tag}
          </Text>
          <Pressable
            onPress={() => accept(tag)}
            hitSlop={6}
            accessibilityLabel={`Accept ${tag}`}
            accessibilityRole="button"
          >
            <Feather name="check" size={11} color={colors.success} />
          </Pressable>
          <Pressable
            onPress={() => dismiss(tag)}
            hitSlop={6}
            accessibilityLabel={`Dismiss ${tag}`}
            accessibilityRole="button"
          >
            <Feather name="x" size={11} color={colors.muted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
};
