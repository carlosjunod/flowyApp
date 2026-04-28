import { Feather } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, Text, View } from 'react-native';

import { useItemActions } from '@/hooks/useItemActions';
import { useSelection } from '@/lib/selection';
import { useResolvedColors } from '@/lib/theme';

const useSafeTabBarHeight = (): number => {
  try {
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
};

export const SelectionActionBar: React.FC = () => {
  const selection = useSelection();
  const actions = useItemActions();
  const colors = useResolvedColors();
  const tabBarHeight = useSafeTabBarHeight();
  const slide = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<'reload' | 'delete' | null>(null);

  useEffect(() => {
    if (selection.mode) {
      setVisible(true);
      Animated.spring(slide, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: 0,
        useNativeDriver: true,
        duration: 160,
      }).start(() => setVisible(false));
    }
  }, [selection.mode, slide]);

  if (!visible) return null;
  const ids = Array.from(selection.selectedIds);
  const count = ids.length;
  const empty = count === 0;

  const onReload = async () => {
    if (empty || busy) return;
    setBusy('reload');
    const res = await actions.reloadMany(ids);
    setBusy(null);
    selection.clear();
    if (!res.ok && 'error' in res) {
      Alert.alert('Reload failed', res.error.message);
      return;
    }
    if (res.ok) {
      const { succeeded, failed } = res.data;
      if (failed.length > 0) {
        Alert.alert(
          'Reload partially complete',
          `${succeeded.length} reloaded · ${failed.length} skipped`,
        );
      }
    }
  };

  const onDelete = async () => {
    if (empty || busy) return;
    setBusy('delete');
    const res = await actions.deleteMany(ids);
    setBusy(null);
    if (!res.ok && 'cancelled' in res) return;
    selection.exit();
    if (!res.ok && 'error' in res) {
      Alert.alert('Delete failed', res.error.message);
      return;
    }
    if (res.ok && res.data.failed.length > 0) {
      Alert.alert(
        'Delete partially complete',
        `${res.data.succeeded.length} deleted · ${res.data.failed.length} failed`,
      );
    }
  };

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: tabBarHeight + 12,
        alignItems: 'center',
        transform: [{ translateY }],
        opacity: slide,
      }}
    >
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Bulk actions"
        className="flex-row items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-card"
        style={{ shadowColor: colors.fg }}
      >
        <Text className="text-sm font-semibold text-fg px-2">
          {count} selected
        </Text>

        <BarButton
          label="Reload"
          icon="refresh-cw"
          onPress={onReload}
          disabled={empty || busy !== null}
          loading={busy === 'reload'}
        />
        <BarButton
          label="Delete"
          icon="trash-2"
          tone="danger"
          onPress={onDelete}
          disabled={empty || busy !== null}
          loading={busy === 'delete'}
        />
        <Pressable
          onPress={() => selection.exit()}
          hitSlop={8}
          accessibilityLabel="Exit selection"
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          className="px-3 py-1.5"
        >
          <Text className="text-sm text-muted">Cancel</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const BarButton: React.FC<{
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  tone?: 'default' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}> = ({ label, icon, tone = 'default', disabled, loading, onPress }) => {
  const colors = useResolvedColors();
  const color = tone === 'danger' ? colors.danger : colors.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      style={({ pressed }) => [
        pressed && !disabled && !loading && { opacity: 0.7 },
        { opacity: disabled ? 0.4 : 1 },
      ]}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
        tone === 'danger' ? 'border border-danger' : 'border border-border'
      }`}
    >
      <Feather name={icon} size={14} color={color} />
      <Text
        className="text-sm font-semibold"
        style={{ color }}
      >
        {loading ? '…' : label}
      </Text>
    </Pressable>
  );
};
