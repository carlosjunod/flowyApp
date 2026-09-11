import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useTabsWithTriggers } from 'expo-router/ui';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemReader } from '@/components/inbox/ItemReader';
import { useChat } from '@/hooks/useChat';
import { adaptiveLayout, tabIsVisible } from '@/lib/adaptiveLayout';
import { useResolvedColors } from '@/lib/theme';

const PaneContext = createContext<{
  visible: boolean;
  width: number;
  split: boolean;
  selectedItemId?: string | null;
  onOpenItem?: (id: string) => void;
}>({ visible: false, width: 0, split: false });
export const useAdaptivePane = () => useContext(PaneContext);

const tabs = [
  { name: 'inbox', href: '/inbox' as const, title: 'Inbox', icon: 'inbox' as const },
  { name: 'chat', href: '/chat' as const, title: 'Chat', icon: 'message-square' as const },
  { name: 'digest', href: '/digest' as const, title: 'Digests', icon: 'sunrise' as const },
  { name: 'settings', href: '/settings' as const, title: 'Settings', icon: 'settings' as const },
];

export function AdaptiveTabs() {
  const colors = useResolvedColors();
  const chat = useChat();
  const focused = useIsFocused();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableWidth = Math.max(0, width - insets.left - insets.right);
  const layout = adaptiveLayout(availableWidth, height, fontScale);
  const { state, descriptors, navigation, NavigationContent } = useTabsWithTriggers({
    triggers: tabs.map(tab => ({ ...tab, type: 'internal' as const })),
    backBehavior: 'history',
  });
  const active = state.routes[state.index]!.name;
  const paired = layout.split && (active === 'inbox' || active === 'chat');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const lastPane = useRef(active);
  const openItem = (id: string) => {
    if (layout.split) {
      setSelectedItemId(id);
      lastPane.current = 'inbox';
      navigation.navigate('inbox');
    } else {
      router.push(`/item/${id}`);
    }
  };
  const wasPaired = useRef(paired);
  useEffect(() => {
    if (!wasPaired.current && paired) lastPane.current = active;
    if (wasPaired.current && !layout.split && (active === 'inbox' || active === 'chat') && lastPane.current !== active) {
      navigation.navigate(lastPane.current);
    }
    wasPaired.current = paired;
  }, [layout.split, paired, active, navigation]);
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['inbox', 'chat', active]));
  if (!visited.has(active)) setVisited(new Set([...visited, active]));

  return (
    <NavigationContent>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right', 'bottom']}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {[...state.routes].sort((a, b) => tabs.findIndex(tab => tab.name === a.name) - tabs.findIndex(tab => tab.name === b.name)).map(route => {
            const visible = tabIsVisible(route.name, active, layout.split);
            const paneWidth = paired ? (route.name === 'inbox' ? layout.inboxWidth : layout.chatWidth + 1) : availableWidth;
            return (
              <View key={route.key}
                // Track interaction without interrupting links or changing focus mid-press.
                onTouchStart={() => { if (paired) lastPane.current = route.name; }}
                style={{ display: visible ? 'flex' : 'none', width: paneWidth, flexShrink: 0, minWidth: 0,
                  borderLeftWidth: paired && route.name === 'chat' ? 1 : 0, borderColor: colors.border }}
                accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
                <PaneContext.Provider value={{ visible: visible && focused, width: paneWidth, split: paired, selectedItemId: paired ? selectedItemId : null, onOpenItem: openItem }}>
                  {visited.has(route.name) ? descriptors[route.key]!.render() : null}
                </PaneContext.Provider>
              </View>
            );
          })}
          {paired && active === 'inbox' ? (
            <View style={{ width: layout.chatWidth + 1, minWidth: 0, borderLeftWidth: 1, borderColor: colors.border }}>
              {selectedItemId && focused ? (
                <ItemReader key={selectedItemId} id={selectedItemId} paneWidth={layout.chatWidth} embedded
                  onClose={() => setSelectedItemId(null)} onOpenItem={openItem} />
              ) : (
                <SafeAreaView edges={['top']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
                  <Feather name="book-open" size={32} color={colors.muted} />
                  <Text style={{ color: colors.fg, fontFamily: 'InstrumentSerif_400Regular', fontSize: 30, textAlign: 'center' }}>
                    Select a saved item to start reading
                  </Text>
                </SafeAreaView>
              )}
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, paddingVertical: 4 }}>
          {tabs.map(tab => {
            const selected = tab.name === active;
            const color = selected ? colors.accent : colors.muted;
            const badge = tab.name === 'chat' ? chat.generatingId ? '…' : chat.unread ? '•' : '' : '';
            return (
              <Pressable key={tab.name} accessibilityRole="tab" accessibilityState={{ selected }}
                accessibilityLabel={`${tab.title}${badge === '…' ? ', preparing response' : badge ? ', new response' : ''}`}
                onPress={() => { Keyboard.dismiss(); lastPane.current = tab.name; navigation.navigate(tab.name); }}
                style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <View style={{ flexDirection: 'row', gap: 4 }}><Feather name={tab.icon} size={20} color={color} />{badge ? <Text style={{ color }}>{badge}</Text> : null}</View>
                <Text style={{ fontSize: 11, color }}>{tab.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </NavigationContent>
  );
}
