import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Switch,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { registerPushForCurrentUser } from "@/hooks/usePushRegistration";
import type { DigestPreferences, DigestSettings } from "@/types";

export default function DigestSettingsScreen() {
  const [view, setView] = useState<DigestSettings | null>(null),
    [draft, setDraft] = useState<DigestPreferences | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  async function load() {
    setMessage("");
    const result = await api.getDigestSettings();
    if (result.error || !result.data.settings) {
      setMessage("Could not load digest settings. Try again.");
      return;
    }
    setView(result.data);
    setDraft(result.data.settings);
  }
  useEffect(() => {
    void load();
  }, []);
  async function showPreview() {
    try {
      const result = await api.listDigestPage(null);
      const row = result.items[0];
      setPreview(
        row
          ? {
              id: row.id,
              text:
                row.content.tldr?.bullets[0]?.text || "Your published report",
            }
          : {
              id: "",
              text: "Fictional example: Two articles explored how short breaks support focus. Compare their evidence by opening the sources.",
            },
      );
    } catch {
      setMessage("Could not load preview. Try again.");
    }
  }
  function change<K extends keyof DigestPreferences>(
    key: K,
    value: DigestPreferences[K],
  ) {
    setDraft((old) => (old ? { ...old, [key]: value } : old));
  }
  async function save() {
    if (!draft || !view) return;
    setBusy(true);
    setMessage("");
    const result = await api.patchDigestSettings({
      ...draft,
      expected_revision: view.revision || 0,
    });
    setBusy(false);
    if (result.error) {
      setMessage(
        result.error.status === 409
          ? "Settings changed on another device. Reload before saving."
          : "Could not save. Check your timezone, times and plan.",
      );
      return;
    }
    setView(result.data);
    setDraft(result.data.settings || draft);
    setMessage("Saved");
  }
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 50 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="min-h-11 justify-center"
        >
          <Text className="text-accent">← Back</Text>
        </Pressable>
        <Text
          className="text-3xl text-fg"
          style={{ fontFamily: "InstrumentSerif_400Regular" }}
        >
          Digests
        </Text>
        <Text className="text-base text-muted">
          A few ideas worth keeping. Weekly is a good place to start. Save your
          choices to subscribe.
        </Text>
        {view && (
          <Text className="text-fg">
            {view.effectivePlan} ·{" "}
            {view.canEnableDaily ? "Up to 1 report/day" : "1 report/week"}
          </Text>
        )}
        {draft && view ? (
          <>
            {(["weekly", "daily"] as const).map((c) => {
              const enabled =
                  c === "daily" ? "daily_enabled" : "weekly_enabled",
                time = c === "daily" ? "daily_local_time" : "weekly_local_time",
                push =
                  c === "daily" ? "daily_push_enabled" : "weekly_push_enabled",
                email =
                  c === "daily"
                    ? "daily_email_enabled"
                    : "weekly_email_enabled";
              return (
                <View
                  key={c}
                  className="border border-border rounded-2xl p-4 gap-3"
                >
                  <View className="flex-row justify-between items-center">
                    <Text className="capitalize text-xl text-fg">{c}</Text>
                    <Switch
                      accessibilityLabel={c + " digest"}
                      value={draft[enabled]}
                      disabled={
                        busy ||
                        (!view.capabilities?.enabled && !draft[enabled]) ||
                        (c === "daily" &&
                          !view.canEnableDaily &&
                          !draft[enabled])
                      }
                      onValueChange={(v) => change(enabled, v)}
                    />
                  </View>
                  <Text className="text-muted">
                    {c === "weekly"
                      ? "The last seven complete local days."
                      : "The previous complete local day."}
                  </Text>
                  {c === "daily" && !view.canEnableDaily && (
                    <Text className="text-muted">
                      Daily requires Starter, Plus or Pro. Weekly is included on
                      Free.
                    </Text>
                  )}
                  {c === "weekly" && (
                    <View>
                      <Text className="text-fg">
                        Day · 1 Monday to 7 Sunday
                      </Text>
                      <TextInput
                        accessibilityLabel="Weekly day"
                        className="min-h-11 border border-border rounded-lg px-3 text-fg"
                        keyboardType="number-pad"
                        value={String(draft.weekly_day)}
                        onChangeText={(v) => change("weekly_day", Number(v))}
                      />
                    </View>
                  )}
                  <Text className="text-fg">Publication time · HH:MM</Text>
                  <TextInput
                    accessibilityLabel={c + " publication time"}
                    className="min-h-11 border border-border rounded-lg px-3 text-fg"
                    value={draft[time]}
                    onChangeText={(v) => change(time, v)}
                    maxLength={5}
                  />
                  <View className="flex-row justify-between items-center">
                    <Text className="text-fg">Push</Text>
                    <Switch
                      accessibilityLabel={c + " push"}
                      value={draft[push]}
                      disabled={!view.capabilities?.push && !draft[push]}
                      onValueChange={(v) => change(push, v)}
                    />
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-fg">Email</Text>
                    <Switch
                      accessibilityLabel={c + " email"}
                      value={draft[email]}
                      disabled={
                        (!view.capabilities?.email || !view.emailVerified) &&
                        !draft[email]
                      }
                      onValueChange={(v) => change(email, v)}
                    />
                  </View>
                  {!view.capabilities?.email && (
                    <Text className="text-muted">
                      Email is temporarily unavailable.
                    </Text>
                  )}
                </View>
              );
            })}
            <Text className="text-fg">Timezone · IANA</Text>
            <TextInput
              accessibilityLabel="Timezone"
              className="min-h-11 border border-border rounded-lg px-3 text-fg"
              value={draft.timezone}
              onChangeText={(v) => change("timezone", v)}
              autoCapitalize="none"
            />
            <Button
              title="Use device timezone"
              variant="secondary"
              onPress={() =>
                change(
                  "timezone",
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                )
              }
            />
            <View className="flex-row gap-4">
              <Button
                title="English"
                variant="secondary"
                onPress={() => change("locale", "en")}
              />
              <Button
                title="Español"
                variant="secondary"
                onPress={() => change("locale", "es")}
              />
            </View>
            <Text className="text-fg">Excluded types · comma separated</Text>
            <TextInput
              accessibilityLabel="Excluded types"
              className="min-h-11 border border-border rounded-lg px-3 text-fg"
              value={draft.excluded_types.join(",")}
              onChangeText={(v) =>
                change(
                  "excluded_types",
                  v
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                )
              }
            />
            <Text className="text-fg">
              Excluded categories · comma separated
            </Text>
            <TextInput
              accessibilityLabel="Excluded categories"
              className="min-h-11 border border-border rounded-lg px-3 text-fg"
              value={draft.excluded_categories.join(",")}
              onChangeText={(v) =>
                change(
                  "excluded_categories",
                  v
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                )
              }
            />
            <Button
              title="Pause for 7 days"
              variant="secondary"
              onPress={() =>
                change(
                  "paused_until",
                  new Date(Date.now() + 7 * 86400000).toISOString(),
                )
              }
            />
            {draft.paused_until && (
              <>
                <Text className="text-muted">
                  Paused until {new Date(draft.paused_until).toLocaleString()}
                </Text>
                <Button
                  title="Resume"
                  variant="secondary"
                  onPress={() => change("paused_until", null)}
                />
              </>
            )}
            <Text className="text-muted">
              {view.emailAddress} ·{" "}
              {view.emailVerified ? "Verified" : "Verification required"}
              {view.emailSuppressed ? " · Email suppressed" : ""}
            </Text>
            {view.next?.map((next) => (
              <Text className="text-muted" key={next.cadence}>
                {next.cadence} ·{" "}
                {next.enabled
                  ? new Date(next.next_run_at).toLocaleString(undefined, {
                      timeZone: view.settings?.timezone,
                    })
                  : "Paused"}{" "}
                · {view.settings?.timezone}
              </Text>
            ))}
            <Button
              title="Preview"
              variant="secondary"
              onPress={() => {
                void showPreview();
              }}
            />
            {preview && (
              <View className="gap-3">
                <Text className="text-fg">
                  {preview.id
                    ? "Your published report"
                    : "Fictional example · no personal content"}
                </Text>
                <Text className="text-muted">{preview.text}</Text>
                {preview.id && (
                  <>
                    <Button
                      title="Open report"
                      onPress={() => router.push(`/digest/${preview.id}`)}
                    />
                    <Button
                      title="Send test email to my verified address"
                      disabled={
                        !view.capabilities?.email || !view.emailVerified
                      }
                      onPress={() => {
                        void api
                          .testDigestEmail(preview.id)
                          .then((result) =>
                            setMessage(
                              result.error
                                ? "Could not queue test email. Save email choice first; limit 1/hour and 3/day."
                                : "Test email queued.",
                            ),
                          );
                      }}
                    />
                  </>
                )}
              </View>
            )}
            <Button
              title="Enable device notifications"
              variant="secondary"
              onPress={() => {
                void registerPushForCurrentUser(true).then(setMessage);
              }}
            />
            <Button
              title="Turn off digests"
              variant="secondary"
              onPress={() =>
                setDraft({
                  ...draft,
                  daily_enabled: false,
                  weekly_enabled: false,
                })
              }
            />
            <Button
              title="Save choices"
              loading={busy}
              disabled={!view.capabilities?.enabled && (draft.daily_enabled || draft.weekly_enabled)}
              onPress={() => {
                void save();
              }}
            />
          </>
        ) : (
          <Button
            title="Retry settings"
            onPress={() => {
              void load();
            }}
          />
        )}
        <Text accessibilityLiveRegion="polite" className="text-fg">
          {message}
        </Text>
        {message.includes("Reload") && (
          <Button
            title="Reload settings"
            onPress={() => {
              void load();
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
