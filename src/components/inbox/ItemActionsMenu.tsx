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
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

type Variant = 'inline' | 'compact';

type Props = {
  item: Item;
  variant?: Variant;
  onDeleted?: () => void;
};

type Action = { key: 'open' | 'reload' | 'delete'; label: string; destructive?: boolean; disabled?: boolean };

const reportFailure = (title: string, message: string) => {
  Alert.alert(title, message);
};

export const ItemActionsMenu: React.FC<Props> = ({ item, variant = 'inline', onDeleted }) => {
  const colors = useResolvedColors();
  const actions = useItemActions();
  const [androidOpen, setAndroidOpen] = useState(false);

  const reloadDisabled = item.status === 'pending' || item.status === 'processing';

  const buildActions = (): Action[] => [
    { key: 'open', label: 'Open' },
    { key: 'reload', label: 'Reload', disabled: reloadDisabled },
    { key: 'delete', label: 'Delete', destructive: true },
  ];

  const run = async (key: Action['key']) => {
    if (key === 'open') {
      actions.open(item.id);
      return;
    }
    if (key === 'reload') {
      const res = await actions.reloadItem(item.id);
      if (!res.ok) reportFailure('Reload failed', res.error.message);
      return;
    }
    if (key === 'delete') {
      const res = await actions.deleteItem(item.id);
      if (res.ok) onDeleted?.();
      else if (res.error.message !== 'Cancelled') {
        reportFailure('Delete failed', res.error.message);
      }
    }
  };

  const openIOS = () => {
    const list = buildActions();
    const labels = list.map((a) => (a.disabled ? `${a.label} (busy)` : a.label));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, 'Cancel'],
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

  const triggerSize = variant === 'compact' ? 28 : 32;
  const iconSize = variant === 'compact' ? 16 : 18;

  return (
    <>
      <Pressable
        onPress={onPressTrigger}
        hitSlop={8}
        accessibilityLabel="Item actions"
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
                <Text className="text-base text-muted text-center">Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
};
