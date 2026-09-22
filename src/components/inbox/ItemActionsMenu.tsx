import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import { useItemActions } from '@/hooks/useItemActions';
import { apiErrorKey } from '@/lib/apiErrors';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

type Variant = 'inline' | 'compact';

type Props = {
  item: Item;
  variant?: Variant;
  onDeleted?: () => void;
};

type Action = { key: 'open' | 'read' | 'reload' | 'delete'; label: string; destructive?: boolean; disabled?: boolean };

export const ItemActionsMenu: React.FC<Props> = ({ item, variant = 'inline', onDeleted }) => {
  const colors = useResolvedColors();
  const { t, tKey } = useI18n();
  const actions = useItemActions();
  const [androidOpen, setAndroidOpen] = useState(false);

  const reloadDisabled = item.status === 'pending' || item.status === 'processing';

  const buildActions = (): Action[] => [
    { key: 'open', label: t('inbox.actionsMenu.open') },
    { key: 'read', label: item.read_at ? t('inbox.actionsMenu.markUnread') : t('inbox.actionsMenu.markRead'), disabled: actions.pending.has(item.id) },
    { key: 'reload', label: item.status === 'error' ? t('inbox.actionsMenu.retryProcessing') : t('inbox.actionsMenu.processAgain'), disabled: reloadDisabled },
    { key: 'delete', label: t('inbox.actionsMenu.delete'), destructive: true },
  ];

  const run = async (key: Action['key']) => {
    if (key === 'open') {
      actions.open(item.id);
      return;
    }
    // Both the title and the body are ours: `ApiError.message` is the server's
    // error *code*, so it is translated via `apiErrorKey` rather than shown.
    if (key === 'read') { const result = await actions.setRead(item.id, !item.read_at); if (!result.ok && 'error' in result) Alert.alert(t('inbox.actionsMenu.readFailedTitle'), tKey(apiErrorKey(result.error))); return; }
    if (key === 'reload') {
      const res = await actions.reloadItem(item.id);
      if (!res.ok && 'error' in res) Alert.alert(t('inbox.actionsMenu.reloadFailedTitle'), tKey(apiErrorKey(res.error)));
      return;
    }
    if (key === 'delete') {
      const res = await actions.deleteItem(item.id);
      if (res.ok) onDeleted?.();
      else if ('error' in res) {
        Alert.alert(t('inbox.actionsMenu.deleteFailedTitle'), tKey(apiErrorKey(res.error)));
      }
    }
  };

  const openIOS = () => {
    const list = buildActions();
    const labels = list.map((a) => (a.disabled ? t('inbox.actionsMenu.busy', { label: a.label }) : a.label));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, t('inbox.actionsMenu.cancel')],
        cancelButtonIndex: labels.length,
        destructiveButtonIndex: list.findIndex((a) => a.destructive),
        disabledButtonIndices: list
          .map((a, i) => (a.disabled ? i : -1))
          .filter((i) => i >= 0),
      },
      (idx) => {
        if (idx === labels.length) return;
        const action = list[idx];
        if (action) void run(action.key);
      },
    );
  };

  const onPressTrigger = () => {
    if (Platform.OS === 'ios') openIOS();
    else setAndroidOpen(true);
  };

  const triggerSize = 44;
  const iconSize = variant === 'compact' ? 16 : 18;

  return (
    <>
      <Pressable
        onPress={onPressTrigger}
        hitSlop={8}
        accessibilityLabel={t('inbox.card.actions')}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        className="items-center justify-center rounded-full border border-border bg-card"
        // eslint-disable-next-line react-native/no-inline-styles
        // height/width set inline because variant size is dynamic
      >
        <View
          style={{
            width: triggerSize,
            height: triggerSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="more-horizontal" size={iconSize} color={colors.muted} />
        </View>
      </Pressable>

      {Platform.OS !== 'ios' ? (
        <Modal
          transparent
          visible={androidOpen}
          animationType="fade"
          onRequestClose={() => setAndroidOpen(false)}
        >
          <Pressable
            className="flex-1 bg-black/40 justify-end"
            onPress={() => setAndroidOpen(false)}
          >
            <Pressable className="bg-card rounded-t-2xl p-2" onPress={() => {}}>
              {buildActions().map((a) => (
                <Pressable
                  key={a.key}
                  disabled={a.disabled}
                  onPress={() => {
                    setAndroidOpen(false);
                    void run(a.key);
                  }}
                  className={`px-4 py-3 rounded-xl ${a.disabled ? 'opacity-40' : ''}`}
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                >
                  <Text
                    className={`text-base ${a.destructive ? 'text-danger' : 'text-fg'} font-medium`}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setAndroidOpen(false)}
                className="px-4 py-3 mt-1 rounded-xl border-t border-border"
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text className="text-base text-muted text-center">{t('inbox.actionsMenu.cancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
};
