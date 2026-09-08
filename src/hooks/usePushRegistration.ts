import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth";
import { savePushDevice, flushPushUnlinks } from "@/lib/pushDevice";
import { pb } from "@/lib/pb";

/** A permission is requested only from an explicit settings action. */
export async function registerPushForCurrentUser(
  requestPermission = false,
): Promise<string> {
  if (!pb.authStore.model?.id) return "Sign in first";
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return "Push requires the mobile app";
  const user = pb.authStore.model.id;
  try {
    const notifications = await import("expo-notifications");
    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== "string" || !projectId)
      return "This build has no push project configured";
    let permission = await notifications.getPermissionsAsync();
    if (permission.status !== "granted" && requestPermission)
      permission = await notifications.requestPermissionsAsync();
    if (permission.status !== "granted")
      return "Push permission is not granted";
    if (Platform.OS === "android")
      await notifications.setNotificationChannelAsync("default", {
        name: "Flowy",
        importance: notifications.AndroidImportance.DEFAULT,
      });
    const token = await notifications.getExpoPushTokenAsync({ projectId });
    if (pb.authStore.model?.id !== user) return "Account changed; try again";
    await savePushDevice(user, token.data);
    return "Push device registered";
  } catch {
    return "Could not register push. Check the build, device and connection.";
  }
}
export function usePushRegistration() {
  const { user } = useAuth();
  useEffect(() => {
    void flushPushUnlinks().catch(() => undefined);
    if (!user) return;
    void registerPushForCurrentUser();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerPushForCurrentUser();
    });
    let tokenSubscription: { remove: () => void } | undefined;
    let active = true;
    void import("expo-notifications")
      .then((notifications) => {
        if (active)
          tokenSubscription = notifications.addPushTokenListener(() => {
            void registerPushForCurrentUser();
          });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
      tokenSubscription?.remove();
    };
  }, [user?.id]);
}
