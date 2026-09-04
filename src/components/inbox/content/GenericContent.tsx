import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

type Tab = 'visual' | 'transcript';

/**
 * Fallback content renderer for items without a specialized type
 * (URLs, screenshots, tweets, TikToks, …). Two tabs:
 *  - "Visual Summary" — concatenates on_screen_text + per-slide AI summaries,
 *    falling back to og_description when none.
 *  - "Transcript" — raw `item.content` (Markdown rendering deferred; web shows
 *    plain whitespace-pre-wrap).
 *
 * Mirrors apps/web/components/inbox/content/GenericContent.tsx.
 */
export const GenericContent: React.FC<{ item: Item }> = ({ item }) => {
  const [tab, setTab] = useState<Tab>('visual');
  const colors = useResolvedColors();

  const visualParts: string[] = [];
  if (item.exploration?.video_insights?.on_screen_text) {
    visualParts.push(item.exploration.video_insights.on_screen_text);
  }
  if (Array.isArray(item.media)) {
    for (const m of item.media) {
      if (m.summary) visualParts.push(m.summary);
    }
  }
  if (!visualParts.length && item.og_description) {
    visualParts.push(item.og_description);
  }

  const visualText = visualParts.join('\n\n');
  const transcriptText = item.content ?? '';

  const active = tab === 'visual' ? visualText : transcriptText;
  const emptyLabel =
    tab === 'visual'
      ? 'No visual summary available for this item.'
      : 'No transcript or extracted text yet.';

  return (
    <View>
      <ContentTabs
        tabs={[
          { id: 'visual', label: 'Visual Summary' },
          { id: 'transcript', label: 'Transcript' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <View
        className="rounded-xl border border-border bg-surface"
        style={{
          minHeight: 80,
          padding: 14,
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 21,
            color: active ? colors.muted : colors.muted,
            fontStyle: active ? 'normal' : 'italic',
            opacity: active ? 1 : 0.7,
          }}
        >
          {active || emptyLabel}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Shared tab-strip primitive — used by Generic + YouTube
// ─────────────────────────────────────────────────────────────

export type TabDef<Id extends string> = { id: Id; label: string };

export function ContentTabs<Id extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<TabDef<Id>>;
  active: Id;
  onChange: (id: Id) => void;
}) {
  const colors = useResolvedColors();
  return (
    <View
      className="flex-row gap-1 rounded-xl bg-surface mb-2.5"
      style={{ padding: 4 }}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: isActive ? colors.fg : 'transparent',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 11.5,
                textAlign: 'center',
                color: isActive ? colors.bg : colors.muted,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
