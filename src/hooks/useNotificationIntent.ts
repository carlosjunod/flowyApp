import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState, useSegments } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  notificationIntent,
  type NotificationIntent,
} from "@/lib/notificationIntent";
import { sharedSecureStore } from "@/lib/secureStore";

const PENDING_KEY = "flowy.notification.pending";
const CONSUMED_KEY = "flowy.notification.last-consumed";
export function useNotificationIntent() {
  const { user, ready } = useAuth(),
    navigation = useRootNavigationState(),
    segments = useSegments();
  const [pending, setPending] = useState<NotificationIntent | null>(null),
    seen = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    void sharedSecureStore
      .getItem(PENDING_KEY)
      .then((raw) => {
        if (!raw || !active) return;
        const saved = JSON.parse(raw) as NotificationIntent;
        if (
          typeof saved.key === "string" &&
          /^\/(digest|item)\/[a-z0-9]{15}$/.test(saved.path)
        )
          setPending(saved);
      })
      .catch(() => undefined);
    function link(url: string) {
      try {
        const parsed = new URL(url);
        if (
          !["https:", "flowy:"].includes(parsed.protocol) ||
          (parsed.protocol === "https:" && parsed.hostname !== "tryflowy.app")
        )
          return;
        const match = parsed.pathname.match(
          /^\/(digest|item)\/([a-z0-9]{15})$/,
        );
        if (!match) return;
        const intent = notificationIntent(
          "link-" + Date.now(),
          match[1] === "digest"
            ? { type: "digest", digestId: match[2] }
            : { type: "item", itemId: match[2] },
        );
        if (intent) {
          setPending(intent);
          void sharedSecureStore
            .setItem(PENDING_KEY, JSON.stringify(intent))
            .catch(() => undefined);
        }
      } catch {
        /* Only known internal paths are navigable. */
      }
    }
    const links = Linking.addEventListener("url", (event) => link(event.url));
    void Linking.getInitialURL()
      .then((url) => {
        if (url) link(url);
      })
      .catch(() => undefined);
    async function accept(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const intent = notificationIntent(
        response.notification.request.identifier,
        response.notification.request.content.data,
      );
      if (!intent || seen.current.has(intent.key)) return;
      seen.current.add(intent.key);
      const consumed = await sharedSecureStore.getItem(CONSUMED_KEY);
      if (active && consumed !== intent.key) {
        await sharedSecureStore.setItem(PENDING_KEY, JSON.stringify(intent));
        if (active) setPending(intent);
      }
    }
    let listener: Notifications.EventSubscription | undefined;
    try {
      listener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          void accept(response).catch(() => undefined);
        },
      );
      void Notifications.getLastNotificationResponseAsync()
        .then(accept)
        .catch(() => undefined);
    } catch {
      /* Web or a build without the notification module. */
    }
    return () => {
      active = false;
      listener?.remove();
      links.remove();
    };
  }, []);
  useEffect(() => {
    if (!pending || !ready || !navigation?.key) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Let the auth screen's own successful-login redirect settle first.
    if (segments[0] !== "(app)") return;
    const target = pending;
    setPending(null);
    void sharedSecureStore
      .setItem(CONSUMED_KEY, target.key)
      .then(() => sharedSecureStore.removeItem(PENDING_KEY))
      .catch(() => undefined);
    router.push(target.path);
    void Notifications.clearLastNotificationResponseAsync().catch(
      () => undefined,
    );
  }, [pending, ready, user, navigation?.key, segments]);
}
