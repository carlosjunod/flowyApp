import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth";
import { savePushDevice, flushPushUnlinks } from "@/lib/pushDevice";
import { pb } from "@/lib/pb";

export interface PushRegistrationResult {
  status: "registered" | "permission-required" | "settings-required" | "error" | "unsupported";
  message: string;
}

/** A permission is requested only from an explicit settings action. */
export async function registerPushForCurrentUser(
  requestPermission = false,
): Promise<PushRegistrationResult> {
  if (!pb.authStore.model?.id) return { status: "error", message: "Sign in to enable notifications." };
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return { status: "unsupported", message: "Notifications are available in the mobile app." };
  const user = pb.authStore.model.id;
  let stage: "permission" | "token" | "server" = "permission";
  try {
    const notifications = await import("expo-notifications");
    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== "string" || !projectId)
      return { status: "error", message: "This app version cannot register notifications. Update the app and try again." };
    // Android 13 needs a channel before it can present the permission prompt.
    if (Platform.OS === "android")
      await notifications.setNotificationChannelAsync("default", {
        name: "Flowy",
        importance: notifications.AndroidImportance.DEFAULT,
      });
    let permission = await notifications.getPermissionsAsync();
    if (permission.status !== "granted" && permission.canAskAgain && requestPermission)
      permission = await notifications.requestPermissionsAsync();
    if (permission.status !== "granted")
      return permission.canAskAgain
        ? { status: "permission-required", message: "Allow notifications to hear when saved items are ready." }
        : { status: "settings-required", message: "Notifications are turned off. Allow them in your device settings, then return to Flowy." };
    stage = "token";
    const token = await notifications.getExpoPushTokenAsync({ projectId });
    if (pb.authStore.model?.id !== user) return { status: "error", message: "Your account changed. Try again." };
    stage = "server";
    await savePushDevice(user, token.data);
    if (pb.authStore.model?.id !== user) return { status: "error", message: "Your account changed. Try again." };
    return { status: "registered", message: "Notifications are enabled on this device. Report notifications follow your report settings." };
  } catch {
    const messages = {
      permission: "Could not check notification permissions. Try again or open your device settings.",
      token: "Could not connect this device to notifications. Check your connection and use an updated Flowy app, then retry.",
      server: "Permission is allowed, but Flowy could not finish setting up notifications. Check your connection and try again.",
    };
    return { status: "error", message: messages[stage] };
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
