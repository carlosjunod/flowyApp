import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth";
import {
  savePushDevice,
  flushPushUnlinks,
  PushDeviceError,
} from "@/lib/pushDevice";
import { pb } from "@/lib/pb";

const ANDROID_PUSH_CHANNEL_ID = "updates";

export interface PushRegistrationResult {
  status: "registered" | "permission-required" | "settings-required" | "error" | "unsupported";
  message: string;
}

let activeRegistration: {
  account: string;
  promise: Promise<PushRegistrationResult>;
} | null = null;

/** A permission is requested only from an explicit settings action. */
async function performPushRegistration(
  user: string,
  requestPermission = false,
): Promise<PushRegistrationResult> {
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return { status: "unsupported", message: "Notifications are available in the mobile app." };
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
      await notifications.setNotificationChannelAsync(ANDROID_PUSH_CHANNEL_ID, {
        name: "Flowy updates",
        importance: notifications.AndroidImportance.HIGH,
        sound: "default",
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
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__)
      console.warn("[push] registration failed", {
        stage,
        code: error instanceof PushDeviceError ? error.code : undefined,
        status: error instanceof PushDeviceError ? error.status : undefined,
        message: error instanceof Error ? error.message : String(error),
      });
    const messages = {
      permission: "Could not check notification permissions. Try again or open your device settings.",
      token: "Could not connect this device to notifications. Check your connection and use an updated Flowy app, then retry.",
      server: "Permission is allowed, but Flowy could not finish setting up notifications. Check your connection and try again.",
    };
    return { status: "error", message: messages[stage] };
  }
}

/** Concurrent auth, foreground, token-listener and settings events share one attempt. */
export function registerPushForCurrentUser(
  requestPermission = false,
): Promise<PushRegistrationResult> {
  const account = pb.authStore.model?.id;
  if (!account)
    return Promise.resolve({
      status: "error",
      message: "Sign in to enable notifications.",
    });
  if (activeRegistration?.account === account) return activeRegistration.promise;
  const promise = performPushRegistration(account, requestPermission).finally(() => {
    if (activeRegistration?.promise === promise) activeRegistration = null;
  });
  activeRegistration = { account, promise };
  return promise;
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
