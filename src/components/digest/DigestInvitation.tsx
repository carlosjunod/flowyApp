import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { sharedSecureStore } from "@/lib/secureStore";

export function DigestInvitation({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const key = "flowy.digest.invitation." + userId;
  useEffect(() => {
    let active = true;
    void (async () => {
      if (await sharedSecureStore.getItem(key)) return;
      const result = await api.getDigestSettings();
      if (active)
        setVisible(
          !result.error &&
            result.data.revision === 0 &&
            Boolean(result.data.capabilities?.enabled),
        );
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key]);
  if (!visible) return null;
  return (
    <View className="mx-4 my-2 rounded-xl border border-border p-3">
      <Text className="text-fg">{t('digest.invitation.body')}</Text>
      <View className="flex-row gap-5">
        <Pressable
          className="min-h-11 justify-center"
          accessibilityRole="button"
          onPress={() => router.push("/digest-settings")}
        >
          <Text className="text-accent">{t('digest.invitation.choose')}</Text>
        </Pressable>
        <Pressable
          className="min-h-11 justify-center"
          accessibilityRole="button"
          onPress={() => {
            setVisible(false);
            void sharedSecureStore.setItem(key, "1").catch(() => undefined);
          }}
        >
          <Text className="text-muted">{t('digest.invitation.notNow')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
