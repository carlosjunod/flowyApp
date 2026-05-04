import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { CollapsibleSection } from '@/components/inbox/CollapsibleSection';
import { Shimmer } from '@/components/ui/Shimmer';
import { useResolvedColors } from '@/lib/theme';
import { hostOf } from '@/lib/thumbnails';
import type { ItemExploration } from '@/types';

const stripWww = (h: string) => h.replace(/^www\./, '');

const domainFromUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  const host = hostOf(url);
  return host ? stripWww(host) : null;
};

const splitNotesIntoTakeaways = (notes: string): string[] => {
  const lines = notes
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 6);
  return notes
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
};

const Sparkle: React.FC = () => {
  const colors = useResolvedColors();
  return <MaterialCommunityIcons name="creation" size={11} color={colors.accent} />;
};

const FALLBACK_TAKEAWAYS = [
  'Enrichment surfaced this item for further investigation.',
  'Review the related links below to find canonical sources.',
  'Add or accept suggested tags to keep your library tidy.',
];

type Props = {
  exploration: ItemExploration;
};

/**
 * Stacked, collapsible AI-generated sections rendered after the summary block.
 * Mirrors `apps/web/components/inbox/ItemDrawer.tsx#EnrichedSections` (lines 1019–1242).
 *
 * Renders whatever the worker has populated — synthesis, findings, links,
 * excerpts, video insights — and falls back gracefully when fields are empty.
 */
export const EnrichedSections: React.FC<Props> = ({ exploration }) => {
  const colors = useResolvedColors();

  if (exploration.status === 'exploring') {
    return <EnrichedSkeletons />;
  }

  if (exploration.status === 'error') {
    return (
      <View
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.danger + '4D',
          backgroundColor: colors.danger + '14',
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="alert-triangle" size={14} color={colors.danger} />
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 13,
              color: colors.danger,
            }}
          >
            Enrichment failed
          </Text>
        </View>
        {exploration.error_msg ? (
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12.5,
              lineHeight: 18,
              color: colors.danger,
            }}
          >
            {exploration.error_msg}
          </Text>
        ) : null}
      </View>
    );
  }

  return <EnrichedBody exploration={exploration} />;
};

// ─────────────────────────────────────────────────────────────
// Body
// ─────────────────────────────────────────────────────────────

const EnrichedBody: React.FC<Props> = ({ exploration }) => {
  const colors = useResolvedColors();
  const deep = exploration.deep_analysis;

  const relatedLinks = useMemo(() => {
    const links: { title: string; url?: string; domain?: string; primary?: boolean }[] = [];
    if (exploration.primary_link) {
      links.push({
        title: exploration.primary_link.title || exploration.primary_link.url,
        url: exploration.primary_link.url,
        domain: domainFromUrl(exploration.primary_link.url) ?? undefined,
        primary: true,
      });
    }
    for (const c of exploration.candidates ?? []) {
      links.push({
        title: c.name,
        url: c.url,
        domain: c.url ? (domainFromUrl(c.url) ?? undefined) : undefined,
      });
    }
    return links;
  }, [exploration]);

  const keyTakeaways: string[] = deep?.key_findings?.length
    ? deep.key_findings
    : exploration.notes
      ? splitNotesIntoTakeaways(exploration.notes)
      : FALLBACK_TAKEAWAYS;

  const sourceAnalysis: { key: string; val: string }[] = exploration.video_insights
    ? [
        {
          key: 'frames analyzed',
          val: String(exploration.video_insights.frames_analyzed),
        },
        ...(exploration.video_insights.visual_cues?.length
          ? [
              {
                key: 'visual cues',
                val: exploration.video_insights.visual_cues.slice(0, 3).join(', '),
              },
            ]
          : []),
      ]
    : [];

  return (
    <View>
      {deep?.synthesis ? (
        <CollapsibleSection
          label="Deep-Dive Synthesis"
          trailingIcon={<Sparkle />}
          badge="AI"
        >
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 21,
              color: colors.fg,
            }}
          >
            {deep.synthesis}
          </Text>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        label={deep?.key_findings?.length ? 'Key Findings from Links' : 'Key Takeaways'}
        trailingIcon={<Sparkle />}
        badge="AI"
      >
        <View style={{ gap: 8 }}>
          {keyTakeaways.map((line, i) => (
            <View
              key={`${i}-${line.slice(0, 24)}`}
              style={{ flexDirection: 'row', gap: 10 }}
            >
              <View
                style={{
                  marginTop: 2,
                  height: 20,
                  minWidth: 20,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  backgroundColor: colors.accent + '1A',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    fontSize: 10,
                    color: colors.accent,
                  }}
                >
                  {i + 1}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                  lineHeight: 20,
                  color: colors.muted,
                }}
              >
                {line}
              </Text>
            </View>
          ))}
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        label="Related Links"
        trailingIcon={<Sparkle />}
        badge={relatedLinks.length || undefined}
      >
        {relatedLinks.length ? (
          <View style={{ gap: 6 }}>
            {relatedLinks.map((link, i) => (
              <RelatedLinkRow
                key={`${link.url ?? link.title}-${i}`}
                title={link.title}
                url={link.url}
                domain={link.domain}
                primary={link.primary}
              />
            ))}
          </View>
        ) : (
          <EmptyHint text="No links surfaced yet." />
        )}
      </CollapsibleSection>

      {deep?.link_excerpts?.length ? (
        <CollapsibleSection
          label="Link Excerpts"
          trailingIcon={<Sparkle />}
          badge={deep.link_excerpts.length}
          defaultOpen={false}
        >
          <View style={{ gap: 8 }}>
            {deep.link_excerpts.map((ex, i) => (
              <LinkExcerptCard key={`${ex.url}-${i}`} excerpt={ex} />
            ))}
          </View>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        label="Similar in Library"
        trailingIcon={<Sparkle />}
        defaultOpen={false}
      >
        <EmptyHint text="No similar items found in your library yet." />
      </CollapsibleSection>

      <CollapsibleSection
        label="Source Analysis"
        trailingIcon={<Sparkle />}
        badge="AI"
        defaultOpen={false}
      >
        {sourceAnalysis.length ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {sourceAnalysis.map(({ key, val }) => (
              <View
                key={key}
                style={{
                  flexBasis: '48%',
                  flexGrow: 1,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border + 'B0',
                  backgroundColor: colors.surface,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 9.5,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: colors.muted,
                  }}
                >
                  {key}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12.5,
                    color: colors.fg,
                  }}
                >
                  {val}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyHint text="Source analysis will appear here once the worker emits author / engagement / credibility data." />
        )}
      </CollapsibleSection>

      {exploration.notes ? (
        <CollapsibleSection label="Notes" defaultOpen={false}>
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 12.5,
              lineHeight: 20,
              color: colors.muted,
            }}
          >
            {exploration.notes}
          </Text>
        </CollapsibleSection>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────

const RelatedLinkRow: React.FC<{
  title: string;
  url?: string;
  domain?: string;
  primary?: boolean;
}> = ({ title, url, domain, primary }) => {
  const colors = useResolvedColors();
  const tappable = !!url;
  return (
    <Pressable
      onPress={tappable ? () => Linking.openURL(url!).catch(() => {}) : undefined}
      disabled={!tappable}
      accessibilityRole={tappable ? 'link' : undefined}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border + 'B0',
          backgroundColor: colors.surface,
          paddingHorizontal: 12,
          paddingVertical: 10,
          opacity: pressed && tappable ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {primary ? (
            <View
              style={{
                paddingHorizontal: 4,
                paddingVertical: 1,
                borderRadius: 3,
                backgroundColor: colors.accent + '26',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 9,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: colors.accent,
                }}
              >
                primary
              </Text>
            </View>
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: 'Inter_500Medium',
              fontSize: 13,
              color: colors.fg,
            }}
          >
            {title}
          </Text>
        </View>
        {domain ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              fontFamily: 'Inter_400Regular',
              fontSize: 11,
              color: colors.muted,
            }}
          >
            {domain}
          </Text>
        ) : null}
      </View>
      {tappable ? (
        <Feather name="arrow-up-right" size={14} color={colors.muted} />
      ) : null}
    </Pressable>
  );
};

const LinkExcerptCard: React.FC<{
  excerpt: { url: string; title: string; excerpt: string };
}> = ({ excerpt }) => {
  const colors = useResolvedColors();
  const domain = domainFromUrl(excerpt.url);
  return (
    <View
      style={{
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border + 'B0',
        backgroundColor: colors.surface,
        padding: 12,
      }}
    >
      <Pressable
        onPress={() => Linking.openURL(excerpt.url).catch(() => {})}
        accessibilityRole="link"
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: 'Inter_500Medium',
            fontSize: 12.5,
            color: colors.fg,
          }}
        >
          {excerpt.title || excerpt.url}
        </Text>
        <Feather name="arrow-up-right" size={11} color={colors.muted} />
      </Pressable>
      {domain ? (
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            color: colors.muted,
          }}
        >
          {domain}
        </Text>
      ) : null}
      <Text
        style={{
          marginTop: 8,
          fontFamily: 'Inter_400Regular',
          fontSize: 12,
          lineHeight: 19,
          color: colors.muted,
        }}
      >
        {excerpt.excerpt}
      </Text>
    </View>
  );
};

const EmptyHint: React.FC<{ text: string }> = ({ text }) => {
  const colors = useResolvedColors();
  return (
    <Text
      style={{
        fontFamily: 'Inter_400Regular',
        fontStyle: 'italic',
        fontSize: 12.5,
        lineHeight: 19,
        color: colors.muted + 'B3',
      }}
    >
      {text}
    </Text>
  );
};

// ─────────────────────────────────────────────────────────────
// Skeleton (status === 'exploring')
// ─────────────────────────────────────────────────────────────

const SKELETON_BLOCKS: { label: string; lines: number[] }[] = [
  { label: 'Key Takeaways', lines: [88, 77, 66, 55] },
  { label: 'Related Links', lines: [80, 70, 58] },
  { label: 'Source Analysis', lines: [70, 50] },
];

const EnrichedSkeletons: React.FC = () => {
  const colors = useResolvedColors();
  return (
    <View>
      {SKELETON_BLOCKS.map(({ label, lines }) => (
        <View
          key={label}
          style={{
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border + 'B0',
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 10.5,
              letterSpacing: 1.05,
              textTransform: 'uppercase',
              color: colors.muted,
              marginBottom: 12,
            }}
          >
            {label}
          </Text>
          <View style={{ gap: 8 }}>
            {lines.map((widthPct, i) => (
              <View
                key={i}
                style={{
                  width: `${widthPct}%`,
                  height: 12,
                  borderRadius: 4,
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                }}
              >
                <Shimmer />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

