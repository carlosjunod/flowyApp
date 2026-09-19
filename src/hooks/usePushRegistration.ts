import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  savePushDevice,
  flushPushUnlinks,
  PushDeviceError,
} from "@/lib/pushDevice";
import { pb } from "@/lib/pb";

const ANDROID_PUSH_CHANNEL_ID = "updates";

export interface PushRegistrationResult {
  status: "registered" | "permission-required" | "settings-required" | "error" | "unsupported";
  /** Translation key under `settings.notifications.*`, rendered by the caller. */
  messageKey: string;
}

let activeRegistration: {
  account: string;
  promise: Promise<PushRegistrationResult>;
} | null = null;

/**
 * A permission is requested only from an explicit settings action.
 *
 * `channelName` is the one string here the *operating system* renders rather
 * than the app, so it cannot be a translation key: it is passed in already
 * translated, and defaults to English for callers without a translator.
 */
async function performPushRegistration(
  user: string,
  requestPermission = false,
  channelName = "Flowy updates",
): Promise<PushRegistrationResult> {
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    return { status: "unsupported", messageKey: "settings.notifications.unsupported" };
  let stage: "permission" | "token" | "server" = "permission";
  try {
    const notifications = await import("expo-notifications");
    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== "string" || !projectId)
      return { status: "error", messageKey: "settings.notifications.outdated" };
    // Android 13 needs a channel before it can present the permission prompt.
    if (Platform.OS === "android")
      await notifications.setNotificationChannelAsync(ANDROID_PUSH_CHANNEL_ID, {
        name: channelName,
        importance: notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    let permission = await notifications.getPermissionsAsync();
    if (permission.status !== "granted" && permission.canAskAgain && requestPermission)
      permission = await notifications.requestPermissionsAsync();
    if (permission.status !== "granted")
      return permission.canAskAgain
        ? { status: "permission-required", messageKey: "settings.notifications.permissionRequired" }
        : { status: "settings-required", messageKey: "settings.notifications.settingsRequired" };
    stage = "token";
    const token = await notifications.getExpoPushTokenAsync({ projectId });
    if (pb.authStore.model?.id !== user)
      return { status: "error", messageKey: "settings.notifications.accountChanged" };
    stage = "server";
    await savePushDevice(user, token.data);
    if (pb.authStore.model?.id !== user)
      return { status: "error", messageKey: "settings.notifications.accountChanged" };
    return { status: "registered", messageKey: "settings.notifications.registered" };
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__)
      console.warn("[push] registration failed", {
        stage,
        code: error instanceof PushDeviceError ? error.code : undefined,
        status: error instanceof PushDeviceError ? error.status : undefined,
        message: error instanceof Error ? error.message : String(error),
      });
    const keys = {
      permission: "settings.notifications.failedPermission",
      token: "settings.notifications.failedToken",
      server: "settings.notifications.failedServer",
    };
    return { status: "error", messageKey: keys[stage] };
  }
}

/** Concurrent auth, foreground, token-listener and settings events share one attempt. */
export function registerPushForCurrentUser(
  requestPermission = false,
  channelName?: string,
): Promise<PushRegistrationResult> {
  const account = pb.authStore.model?.id;
  if (!account)
    return Promise.resolve({
      status: "error",
      messageKey: "settings.notifications.signInFirst",
    });
  if (activeRegistration?.account === account) return activeRegistration.promise;
  const promise = performPushRegistration(account, requestPermission, channelName).finally(() => {
    if (activeRegistration?.promise === promise) activeRegistration = null;
  });
  activeRegistration = { account, promise };
  return promise;
}
export function usePushRegistration() {
  const { user } = useAuth();
  const { t } = useI18n();
  const channelName = t("settings.notifications.channelName");
  useEffect(() => {
    void flushPushUnlinks().catch(() => undefined);
    if (!user) return;
    void registerPushForCurrentUser(false, channelName);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerPushForCurrentUser(false, channelName);
    });
    let tokenSubscription: { remove: () => void } | undefined;
    let active = true;
    void import("expo-notifications")
      .then((notifications) => {
        if (active)
          tokenSubscription = notifications.addPushTokenListener(() => {
            void registerPushForCurrentUser(false, channelName);
          });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
      tokenSubscription?.remove();
    };
    // `channelName` is deliberately excluded: re-running this effect on a
    // language switch would tear down the token listener for no benefit, and
    // the channel is only created once per install anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
